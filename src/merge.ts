import { Lesson } from "./types";

const LESSON_MERGE_GAP = 1;

export function mergeLessons(lessons: Lesson[]): Lesson[] {
    if (!lessons.length) return [];

    const groups = new Map<string, Lesson[]>();

    for (const lesson of lessons) {
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
