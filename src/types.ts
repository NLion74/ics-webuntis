export interface User {
    school: string;
    username: string;
    password: string;
    baseurl: string;
    friendlyName: string;
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
    teacher: string;
    room: string;
    class: string;
    date: Date;
}

export interface CacheEntry {
    timestamp: number;
    ics: string;
}
