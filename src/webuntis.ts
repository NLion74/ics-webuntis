import { WebUntis } from "webuntis";
import { Lesson, User } from "./types";
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

    const baseUrl = user.baseurl.replace(/^https?:\/\//, "");
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
    endDate: Date
): Promise<Lesson[]> {
    const untis = await getUntisSession(user);

    try {
        const rawTimetable = await untis.getOwnTimetableForRange(
            startDate,
            endDate
        );

        const lessons: Lesson[] = rawTimetable
            .filter((entry: any) => {
                const subject = entry.su?.[0]?.longname?.toLowerCase() ?? "";
                const teacher = entry.te?.[0]?.name?.toLowerCase() ?? "";
                if (entry.code === "cancelled") return false;
                if (subject.startsWith("eva")) return false;
                if (teacher.startsWith("eva")) return false;
                return true;
            })
            .map((entry: any) => ({
                startTime: entry.startTime,
                endTime: entry.endTime,
                subject: entry.su?.[0]?.name || "Event",
                teacher: entry.te?.[0]?.name || "Unknown Teacher",
                room: entry.ro?.[0]?.name || "Unknown Room",
                class:
                    entry.kl?.[1]?.longname ||
                    entry.kl?.[0]?.longname ||
                    "Unknown Class",
                date: parseUntisDate(entry.date),
            }));

        return mergeLessons(lessons);
    } catch (error) {
        await untis.logout();
        sessionCache.delete(user.username);
        throw error;
    }
}
