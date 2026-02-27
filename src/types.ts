export interface User {
    school: string;
    username: string;
    password: string;
    baseurl: string;
    friendlyName: string;
    language?: "en" | "de";
    cancelledDisplay?: "hide" | "mark" | "show";
    accessToken?: string;
}

export interface Config {
    daysBefore: number;
    daysAfter: number;
    cacheDuration: number;
    timezone?: string;
    users: User[];
}

export interface Lesson {
    startTime: number;
    endTime: number;
    subject: string;
    teacher: string[];
    room: string;
    class: string[];
    date: Date;
    lstext: string;
    status: string;
}

export interface CacheEntry {
    timestamp: number;
    ics: string;
}

export enum UntisElementType {
    CLASS = 1,
    TEACHER = 2,
    SUBJECT = 3,
    ROOM = 4,
    STUDENT = 5,
}
