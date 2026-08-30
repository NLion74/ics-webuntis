import { WebUntis, Timegrid, Holiday } from "webuntis";
import { Lesson, User, UntisElementType } from "./types";
import { parseUntisDate, dateToUntisNumber } from "./utils";
import { mergeLessons } from "./merge";

interface SessionEntry {
    untis: WebUntis;
    timestamp: number;
}

export const sessionCache = new Map<string, SessionEntry>();
export const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getUntisSession(user: User): Promise<WebUntis> {
    const cached = sessionCache.get(user.username);
    const now = Date.now();

    if (cached && now - cached.timestamp < SESSION_TTL_MS) {
        return cached.untis;
    }

    if (cached) {
        try {
            await cached.untis.logout();
        } catch {}
        sessionCache.delete(user.username);
    }

    const baseUrl = user.baseurl
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

    const untis = new WebUntis(
        user.school,
        user.username,
        user.password,
        baseUrl,
    );

    try {
        await untis.login();
    } catch (error) {
        throw Object.assign(
            error instanceof Error ? error : new Error(String(error)),
            { authError: true },
        );
    }

    sessionCache.set(user.username, { untis, timestamp: now });

    return untis;
}

function invalidateSession(user: User, untis: WebUntis): void {
    sessionCache.delete(user.username);
    untis.logout().catch(() => {});
}

function isRestrictedEntry(entry: any): boolean {
    return !entry.su?.length && !entry.te?.length && !entry.ro?.length;
}

export async function fetchTimetable(
    user: User,
    startDate: Date,
    endDate: Date,
    type?: "class" | "room" | "teacher" | "subject",
    id?: string | number,
): Promise<Lesson[]> {
    const untis = await getUntisSession(user);

    try {
        if (startDate > endDate) {
            throw Object.assign(new Error("startDate must be before endDate"), {
                code: 400,
            });
        }

        const schoolyear = await untis.getCurrentSchoolyear();

        const clampedStartDate = new Date(
            Math.max(startDate.getTime(), schoolyear.startDate.getTime()),
        );
        const clampedEndDate = new Date(
            Math.min(endDate.getTime(), schoolyear.endDate.getTime()),
        );

        if (clampedStartDate > clampedEndDate) {
            throw Object.assign(
                new Error(
                    "Requested range does not overlap with the current school year",
                ),
                { code: 400 },
            );
        }

        let numericId: number | undefined;

        if (type && id !== undefined) {
            console.log(`Resolving ${type} name "${id}" to numeric ID`);
            try {
                const idStr = String(id).toLowerCase();

                switch (type) {
                    case "class": {
                        const classes = await untis.getClasses(
                            true,
                            schoolyear.id,
                        );
                        numericId = classes.find(
                            (c) =>
                                c.name.toLowerCase() === idStr ||
                                c.longName.toLowerCase() === idStr,
                        )?.id;
                        break;
                    }
                    case "room": {
                        const rooms = await untis.getRooms(true);
                        numericId = rooms.find(
                            (r) =>
                                r.name.toLowerCase() === idStr ||
                                r.longName.toLowerCase() === idStr,
                        )?.id;
                        break;
                    }
                    case "teacher": {
                        const teachers = await untis.getTeachers(true);
                        numericId = teachers.find(
                            (t) =>
                                t.name.toLowerCase() === idStr ||
                                t.longName.toLowerCase() === idStr,
                        )?.id;
                        break;
                    }
                    case "subject": {
                        const subjects = await untis.getSubjects(true);
                        numericId = subjects.find(
                            (s) =>
                                s.name.toLowerCase() === idStr ||
                                s.longName.toLowerCase() === idStr,
                        )?.id;
                        break;
                    }
                }
            } catch (err) {
                console.warn(
                    `Failed to resolve ${type} name "${id}" to numeric ID:`,
                    err,
                );
            }

            if (!numericId) {
                const parsed = Number(id);
                if (!isNaN(parsed)) {
                    numericId = parsed;
                } else {
                    throw Object.assign(
                        new Error(
                            `No ${type} found matching "${id}" (case-insensitive)`,
                        ),
                        { code: 404, reason: "id_not_found" },
                    );
                }
            }
        }

        let rawTimetable: any[];
        if (!type || numericId === undefined) {
            rawTimetable = await untis.getOwnTimetableForRange(
                clampedStartDate,
                clampedEndDate,
            );
        } else {
            const typeMap: Record<string, UntisElementType> = {
                class: UntisElementType.CLASS,
                teacher: UntisElementType.TEACHER,
                subject: UntisElementType.SUBJECT,
                room: UntisElementType.ROOM,
            };

            rawTimetable = await untis.getTimetableForRange(
                clampedStartDate,
                clampedEndDate,
                numericId,
                typeMap[type],
                true,
            );
        }

        if (!rawTimetable || rawTimetable.length === 0) {
            throw Object.assign(new Error("No timetable found"), {
                code: 404,
                reason: "empty_range",
            });
        }

        const lessons: Lesson[] = rawTimetable
            .filter((entry: any) => {
                const subject = entry.su?.[0]?.longname?.toLowerCase() ?? "";
                const teacher = entry.te?.[0]?.name?.toLowerCase() ?? "";
                if (subject.startsWith("eva")) return false;
                if (teacher.startsWith("eva")) return false;
                return true;
            })
            .map((entry: any) => ({
                startTime: entry.startTime,
                endTime: entry.endTime,
                subject:
                    entry.su?.[0]?.name || entry.sg || entry.lstext || "Event",
                teacher: entry.te?.map((t: any) => t.name) || [
                    "Unknown Teacher",
                ],
                room: entry.ro?.[0]?.name || "Unknown Room",
                class: entry.kl?.map((k: any) => k.name) || ["Unknown Class"],
                date: parseUntisDate(entry.date),
                lstext: entry.lstext || "No Text",
                status: entry.code || "confirmed",
                allDay: isRestrictedEntry(entry),
            }));

        if (lessons.length === 0) {
            throw Object.assign(new Error("No timetable found"), {
                code: 404,
                reason: "empty_range",
            });
        }

        const timegrids: Timegrid[] = await untis.getTimegrid();

        const validTimegrids = timegrids.filter(
            (tg) => tg.timeUnits.length > 0,
        );

        if (validTimegrids.length === 0) {
            return mergeLessons(lessons, 0, 0);
        }

        const schoolStartTime = Math.min(
            ...validTimegrids.flatMap((tg) =>
                tg.timeUnits.map((u) => u.startTime),
            ),
        );

        const schoolEndTime = Math.max(
            ...validTimegrids.flatMap((tg) =>
                tg.timeUnits.map((u) => u.endTime),
            ),
        );

        const merged = mergeLessons(lessons, schoolStartTime, schoolEndTime);

        return merged.map((l) => ({
            ...l,
            allDay:
                !!l.allDay &&
                l.startTime <= schoolStartTime &&
                l.endTime >= schoolEndTime,
        }));
    } catch (error: any) {
        const isKnownAppError = typeof error?.code === "number";
        if (error?.authError || !isKnownAppError) {
            invalidateSession(user, untis);
        }
        throw error;
    }
}

export async function fetchHolidays(
    user: User,
    startDate: Date,
    endDate: Date,
): Promise<Lesson[]> {
    const untis = await getUntisSession(user);
    try {
        const holidays: Holiday[] = await untis.getHolidays();
        const startNum = dateToUntisNumber(startDate);
        const endNum = dateToUntisNumber(endDate);

        return holidays
            .filter((h) => h.endDate >= startNum && h.startDate <= endNum)
            .map((h) => ({
                startTime: 0,
                endTime: 0,
                subject: h.longName || h.name,
                teacher: [],
                room: "",
                class: [],
                date: parseUntisDate(h.startDate),
                endDate: parseUntisDate(h.endDate),
                lstext: h.longName || h.name,
                status: "confirmed",
                allDay: true,
            }));
    } catch (error) {
        console.warn(
            `Failed to fetch holidays for ${user.friendlyName}:`,
            error,
        );
        return [];
    }
}
