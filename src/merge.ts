import { Lesson } from "./types";

const LESSON_MERGE_GAP = 1;

export function mergeLessons(
    lessons: Lesson[],
    schoolStartTime: number,
    schoolEndTime: number
): Lesson[] {
    if (!lessons.length) return [];

    const clampedLessons = lessons
        .map((lesson) => {
            const startTime = Math.max(lesson.startTime, schoolStartTime);
            const endTime = Math.min(lesson.endTime, schoolEndTime);

            if (startTime >= endTime) return null;

            return { ...lesson, startTime, endTime };
        })
        .filter(Boolean) as Lesson[];

    const groups = new Map<string, Lesson[]>();

    for (const lesson of clampedLessons) {
        const key = `${lesson.date.toDateString()}|${lesson.subject}|${
            lesson.teacher
        }|${lesson.room}|${lesson.class}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(lesson);
    }

    const merged: Lesson[] = [];

    for (const group of groups.values()) {
        group.sort((a, b) => a.startTime - b.startTime);

        let current = { ...group[0] };
        for (const lesson of group.slice(1)) {
            if (lesson.startTime <= current.endTime + LESSON_MERGE_GAP) {
                current.endTime = Math.max(current.endTime, lesson.endTime);
            } else {
                merged.push(current);
                current = { ...lesson };
            }
        }
        merged.push(current);
    }

    merged.sort(
        (a, b) =>
            a.date.getTime() - b.date.getTime() || a.startTime - b.startTime
    );
    return merged;
}
