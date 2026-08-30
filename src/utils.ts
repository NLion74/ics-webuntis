export function parseUntisDate(untisDate: number): Date {
    const str = untisDate.toString();
    const year = parseInt(str.slice(0, 4), 10);
    const month = parseInt(str.slice(4, 6), 10) - 1;
    const day = parseInt(str.slice(6, 8), 10);
    return new Date(year, month, day);
}

export function utcDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function dateToUntisNumber(d: Date): number {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
