import ical, { ICalEventStatus } from "ical-generator";
import { Lesson } from "./types";
import { TFunction } from 'i18next';

export function lessonsToIcs(
    lessons: Lesson[],
    timezone: string,
    requestedTimetable: string,
    t: TFunction // Add translation function parameter
): string {
    const cal = ical({ name: t('calendar.name'), timezone });

    for (const l of lessons) {
        const startHour = Math.floor(l.startTime / 100);
        const startMinute = l.startTime % 100;
        const endHour = Math.floor(l.endTime / 100);
        const endMinute = l.endTime % 100;

        const unknownTeacher = t('calendar.unknown_teacher');
        const unknownClass = t('calendar.unknown_class');

        const teacherCount = l.teacher.length;
        const teacherList = l.teacher.slice(0, 3).join(", ");
        const teacherSummary =
            teacherCount > 3
                ? `${teacherList} ...+${teacherCount - 3}`
                : teacherList;

        const classCount = l.class.length;
        const classList = l.class.slice(0, 3).join(", ");
        const classSummary =
            classCount > 3 ? `${classList} ...+${classCount - 3}` : classList;

        // hide or use alternative text for ics SUMMARY if subject is unknown
        const calSummary = [
            l.status === "cancelled" ? `⛔ [${t('calendar.cancelled')}]` : "",
            l.subject === "Event" ? l.lstext : l.subject,
            teacherSummary !== unknownTeacher && `(${teacherSummary})`,
            teacherSummary !== unknownTeacher &&
                classSummary !== unknownClass &&
                "-",
            classSummary !== unknownClass && `(${classSummary})`,
        ]
            .filter(Boolean)
            .join(" ");

        const calDescription = `${t('calendar.subject')}: ${
            l.subject
        }\n${t('calendar.teacher')}: ${l.teacher.join(", ")}\n${t('calendar.room')}: ${
            l.room
        }\n${t('calendar.class')}: ${l.class.join(
            ", "
        )}\n${t('calendar.timetable')}: ${requestedTimetable}\n${t('calendar.status')}: ${l.status}\nlstext: ${
            l.lstext
        }`;

        let calStatus;
        switch (l.status) {
            case "cancelled":
                calStatus = "CANCELLED";
                break;
            case "irregular":
            case "confirmed":
            default:
                calStatus = "CONFIRMED";
                break;
        }

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
            summary: calSummary,
            location: l.room,
            description: calDescription,

            status: calStatus as ICalEventStatus,
        });
    }

    return cal.toString();
}
