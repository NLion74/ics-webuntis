import express from "express";
import i18nextMiddleware from "i18next-http-middleware";
import i18next from "./i18n";
import { configManager } from "./config";
import { fetchTimetable, fetchHolidays } from "./webuntis";
import { lessonsToIcs } from "./ics";
import { CacheHandler } from "./cacheHandler";
import { Lesson, User } from "./types";
import accessHandler from "./accessHandler";

const CANCELLED_DISPLAY_VALUES: NonNullable<User["cancelledDisplay"]>[] = [
    "hide",
    "mark",
    "show",
];

async function main() {
    await configManager.init();
    console.log(`Loaded config from ${configManager.configPath}`);

    const app = express();

    app.use(i18nextMiddleware.handle(i18next));

    const icsCache = new CacheHandler(configManager.config.cacheDuration);

    function sendIcs(res: express.Response, filename: string, ics: string) {
        const safeFilename = filename.replace(/[^a-z0-9-_]/gi, "_");
        return res
            .setHeader("Content-Type", "text/calendar")
            .setHeader(
                "Content-Disposition",
                `attachment; filename="${safeFilename}.ics"`,
            )
            .send(ics);
    }

    function normalizeParam(param: string | string[] | undefined): string {
        if (!param) return "";

        if (Array.isArray(param)) {
            return param[0]?.trim().toLowerCase() ?? "";
        }

        return param.trim().toLowerCase();
    }

    function resolveCancelledDisplay(
        raw: unknown,
        userDefault: User["cancelledDisplay"] | undefined,
    ): NonNullable<User["cancelledDisplay"]> {
        if (
            typeof raw === "string" &&
            (CANCELLED_DISPLAY_VALUES as string[]).includes(raw)
        ) {
            return raw as NonNullable<User["cancelledDisplay"]>;
        }
        return userDefault || "mark";
    }

    function getDateRange(): { startDate: Date; endDate: Date } {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - configManager.config.daysBefore);
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + configManager.config.daysAfter);
        return { startDate, endDate };
    }

    async function fetchAllEntries(
        user: User,
        startDate: Date,
        endDate: Date,
        type?: "class" | "room" | "teacher" | "subject",
        id?: string,
    ): Promise<Lesson[]> {
        const [lessons, holidays] = await Promise.all([
            fetchTimetable(user, startDate, endDate, type, id).catch((err) => {
                if (err?.code === 404 && err?.reason === "empty_range") {
                    return [] as Lesson[];
                }
                throw err;
            }),
            fetchHolidays(user, startDate, endDate),
        ]);

        return [...lessons, ...holidays];
    }

    app.get("/timetable/:name", accessHandler, async (req, res) => {
        try {
            const user = configManager.config.users.find(
                (u: User) =>
                    u.friendlyName.toLowerCase() ===
                    normalizeParam(req.params.name),
            );

            if (user?.language && !req.query.lang) {
                await req.i18n.changeLanguage(user.language);
            }

            if (!user)
                return res.status(404).send(req.t("errors.user_not_found"));

            const cancelledDisplay = resolveCancelledDisplay(
                req.query.cancelledDisplay,
                user.cancelledDisplay,
            );
            const cacheKey = `${user.username}:${req.i18n.language}:${cancelledDisplay}`;
            const cacheEntry = icsCache.get(cacheKey);
            if (cacheEntry) {
                return sendIcs(res, user.friendlyName, cacheEntry.ics);
            }

            const { startDate, endDate } = getDateRange();

            const entries = await fetchAllEntries(user, startDate, endDate);
            if (entries.length === 0) {
                return res.status(404).send(req.t("errors.no_timetable"));
            }

            const ics = lessonsToIcs(
                entries,
                configManager.config.timezone || "Europe/Berlin",
                user.friendlyName,
                req.t,
                cancelledDisplay,
            );

            icsCache.set(cacheKey, ics);

            return sendIcs(res, user.friendlyName, ics);
        } catch (err: any) {
            if (err.code === 404) {
                return res.status(404).send(err.message);
            }
            if (err.code === 400) {
                return res.status(400).send(err.message);
            }
            console.error(err);
            res.status(500).send(req.t("errors.fetch_error"));
        }
    });

    app.get("/timetable/:name/:type/:id", accessHandler, async (req, res) => {
        try {
            const name = normalizeParam(req.params.name);
            const rawType = normalizeParam(req.params.type);
            const rawId = normalizeParam(req.params.id);

            const user = configManager.config.users.find(
                (u: User) => u.friendlyName.toLowerCase() === name,
            );

            if (user?.language && !req.query.lang) {
                await req.i18n.changeLanguage(user.language);
            }

            if (!user)
                return res.status(404).send(req.t("errors.user_not_found"));

            const type = ["class", "room", "teacher", "subject"].includes(
                rawType,
            )
                ? (rawType as "class" | "room" | "teacher" | "subject")
                : undefined;

            const id = rawId || undefined;

            const cancelledDisplay = resolveCancelledDisplay(
                req.query.cancelledDisplay,
                user.cancelledDisplay,
            );
            const cacheKey = `${user.username}:${type || "own"}:${id || ""}:${req.i18n.language}:${cancelledDisplay}`;
            const cacheEntry = icsCache.get(cacheKey);
            if (cacheEntry) {
                return sendIcs(res, `${name}-${type || "own"}`, cacheEntry.ics);
            }

            const { startDate, endDate } = getDateRange();

            console.log(
                `Fetching timetable for ${user.friendlyName}, type=${type}, id=${id}`,
            );

            const entries = await fetchAllEntries(
                user,
                startDate,
                endDate,
                type,
                id,
            );

            console.log(`Fetched ${entries.length} entries`);

            if (entries.length === 0) {
                return res.status(404).send(req.t("errors.no_timetable"));
            }

            const ics = lessonsToIcs(
                entries,
                configManager.config.timezone || "Europe/Berlin",
                `${user.friendlyName} - ${type || "own"} ${id || ""}`,
                req.t,
                cancelledDisplay,
            );

            icsCache.set(cacheKey, ics);

            return sendIcs(
                res,
                `${name}-${type || "own"}-${id?.toLowerCase() || ""}`,
                ics,
            );
        } catch (err: any) {
            if (err.code === 404) {
                return res.status(404).send(err.message);
            }
            if (err.code === 400) {
                return res.status(400).send(err.message);
            }
            console.error(err);
            res.status(500).send(req.t("errors.fetch_error"));
        }
    });

    const PORT = 7464;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

main();
