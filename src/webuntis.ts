import { WebUntis, Timegrid } from "webuntis";
import { Lesson, User, UntisElementType } from "./types";
import { parseUntisDate } from "./utils";
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

    const baseUrl = user.baseurl
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

    const untis = new WebUntis(
        user.school,
        user.username,
        user.password,
        baseUrl
    );

    await untis.login();
    sessionCache.set(user.username, { untis, timestamp: now });

    return untis;
}

export async function fetchTimetable(
    user: User,
    startDate: Date,
    endDate: Date,
    type?: "class" | "room" | "teacher" | "subject",
    id?: string | number
): Promise<Lesson[]> {
    const untis = await getUntisSession(user);

    try {
        let numericId: number | undefined;

        if (type && id !== undefined) {
            console.log(`Resolving ${type} name "${id}" to numeric ID`);
            try {
                const schoolyear = await untis.getCurrentSchoolyear();
                const idStr = String(id).toLowerCase(); // ✅ normalize input

                switch (type) {
                    case "class": {
                        const classes = await untis.getClasses(
                            true,
                            schoolyear.id
                        );
                        numericId = classes.find(
                            (c) =>
                                c.name.toLowerCase() === idStr ||
                                c.longName.toLowerCase() === idStr
                        )?.id;
                        break;
                    }
                    case "room": {
                        const rooms = await untis.getRooms(true);
                        numericId = rooms.find(
                            (r) =>
                                r.name.toLowerCase() === idStr ||
                                r.longName.toLowerCase() === idStr
                        )?.id;
                        break;
                    }
                    case "teacher": {
                        const teachers = await untis.getTeachers(true);
                        numericId = teachers.find(
                            (t) =>
                                t.name.toLowerCase() === idStr ||
                                t.longName.toLowerCase() === idStr
                        )?.id;
                        break;
                    }
                    case "subject": {
                        const subjects = await untis.getSubjects(true);
                        numericId = subjects.find(
                            (s) =>
                                s.name.toLowerCase() === idStr ||
                                s.longName.toLowerCase() === idStr
                        )?.id;
                        break;
                    }
                }
            } catch (err) {
                console.warn(
                    `Failed to resolve ${type} name "${id}" to numeric ID:`,
                    err
                );
            }

            if (!numericId) {
                const parsed = Number(id);
                if (!isNaN(parsed)) numericId = parsed;
                else
                    throw new Error(
                        `Could not resolve ${type} ID from "${id}"`
                    );
            }
        }

        let rawTimetable: any[];
        if (!type || numericId === undefined) {
            rawTimetable = await untis.getOwnTimetableForRange(
                startDate,
                endDate
            );
        } else {
            const typeMap: Record<string, UntisElementType> = {
                class: UntisElementType.CLASS,
                teacher: UntisElementType.TEACHER,
                subject: UntisElementType.SUBJECT,
                room: UntisElementType.ROOM,
            };

            rawTimetable = await untis.getTimetableForRange(
                startDate,
                endDate,
                numericId,
                typeMap[type],
                true
            );
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
                subject: entry.su?.[0]?.name || "Event",
                teacher: entry.te?.map((t: any) => t.name) || [
                    "Unknown Teacher",
                ],
                room: entry.ro?.[0]?.name || "Unknown Room",
                class: entry.kl?.map((k: any) => k.name) || ["Unknown Class"],
                date: parseUntisDate(entry.date),
                lstext: entry.lstext || "No Text",
                status: entry.code || "confirmed",
            }));

        const timegrids: Timegrid[] = await untis.getTimegrid();

        const validTimegrids = timegrids.filter(
            (tg) => tg.timeUnits.length > 0
        );

        if (validTimegrids.length === 0) {
            return mergeLessons(lessons, 0, 0);
        }

        // Get lesson with earliest start time and latest end time
        const schoolStartTime = Math.min(
            ...validTimegrids.flatMap((tg) =>
                tg.timeUnits.map((u) => u.startTime)
            )
        );

        const schoolEndTime = Math.max(
            ...validTimegrids.flatMap((tg) =>
                tg.timeUnits.map((u) => u.endTime)
            )
        );

        return mergeLessons(lessons, schoolStartTime, schoolEndTime);
    } catch (error) {
        await untis.logout();
        sessionCache.delete(user.username);
        throw error;
    }
}
