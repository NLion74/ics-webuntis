import ical, { ICalEventStatus } from "ical-generator";
import { Lesson } from "./types";

export function lessonsToIcs(lessons: Lesson[], timezone: string): string {
    const cal = ical({ name: "WebUntis Timetable", timezone });

    for (const l of lessons) {
        const startHour = Math.floor(l.startTime / 100);
        const startMinute = l.startTime % 100;
        const endHour = Math.floor(l.endTime / 100);
        const endMinute = l.endTime % 100;

        cal.createEvent({
            start: new Date(
                l.date.getFullYear(),
                l.date.getMonth(),
                l.date.getDate(),
                startHour,
                startMinute
            ),
            end: new Date(
                l.date.getFullYear(),
                l.date.getMonth(),
                l.date.getDate(),
                endHour,
                endMinute
            ),
            summary: `${l.subject} (${l.class})`,
            description: `Teacher: ${l.teacher}\nRoom: ${l.room}`,
            location: l.room,
            status: "CONFIRMED" as ICalEventStatus,
        });
    }

    return cal.toString();
}
