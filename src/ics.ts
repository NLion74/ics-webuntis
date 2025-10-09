import ical, { ICalEventStatus } from "ical-generator";
import { Lesson } from "./types";

export function lessonsToIcs(
    lessons: Lesson[],
    timezone: string,
    requestedTimetable: string
): string {
    const cal = ical({ name: "WebUntis Timetable", timezone });

    for (const l of lessons) {
        const startHour = Math.floor(l.startTime / 100);
        const startMinute = l.startTime % 100;
        const endHour = Math.floor(l.endTime / 100);
        const endMinute = l.endTime % 100;

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

        const bkRemark = l.bkRemark;
        const lstext = l.lstext;
        const status = l.status;
        const activityType = l.activityType;
        let calSummary;
        let calDescription;
        if (activityType === 'Unterricht') {
           calSummary = `${l.subject} (${teacherSummary}) - ${classSummary}`;
           calDescription = `Subject: ${l.subject}\nTeacher: ${l.teacher.join(
                ", "
            )}\nRoom: ${l.room}\nClass: ${l.class.join(
                ", "
            )}\nTimetable: ${requestedTimetable}`
        } else  {// if (activityType === 'Besprechnung') { <--- intended typo in (schoolspecific?) api reply :C --->
           calSummary = `${lstext}`;
           calDescription = `Attendees: ${l.teacher.join(
                ", "
            )}\nRoom: ${l.room}\nClass: ${l.class.join(
                ", "
            )}\nTimetable: ${requestedTimetable}`;
        }
        let calStatus = "CONFIRMED";
        if (status === "cancelled"){
            calStatus = "CANCELLED";
            calDescription = `Status: Cancellation\n${calDescription}`;
        } else if (status === "irregular"){
            calSummary = `~! ${calSummary}`;
            calDescription = `Status: Substitution\n${calDescription}`;
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
