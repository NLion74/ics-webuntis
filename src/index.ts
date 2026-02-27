import express from "express";
import i18nextMiddleware from "i18next-http-middleware";
import i18next from "./i18n";
import { configManager } from "./config";
import { fetchTimetable } from "./webuntis";
import { lessonsToIcs } from "./ics";
import { CacheHandler } from "./cacheHandler";
import { User } from "./types";
import accessHandler from "./accessHandler";

async function main() {
    await configManager.init();
    console.log(`Loaded config from ${configManager.configPath}`);

    const app = express();

    app.use(i18nextMiddleware.handle(i18next));

    const icsCache = new CacheHandler(configManager.config.cacheDuration);

    function sendIcs(res: express.Response, filename: string, ics: string) {
        return res
            .setHeader("Content-Type", "text/calendar")
            .setHeader(
                "Content-Disposition",
                `attachment; filename=${filename}.ics`,
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

            const cancelledDisplay =
                (req.query.cancelledDisplay as User["cancelledDisplay"]) ||
                user.cancelledDisplay ||
                "mark";
            const cacheKey = `${user.username}:${req.i18n.language}:${cancelledDisplay}`;
            const cacheEntry = icsCache.get(cacheKey);
            if (cacheEntry) {
                return sendIcs(res, user.friendlyName, cacheEntry.ics);
            }

            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(
                today.getDate() - configManager.config.daysBefore,
            );
            const endDate = new Date(today);
            endDate.setDate(today.getDate() + configManager.config.daysAfter);

            const lessons = await fetchTimetable(user, startDate, endDate);
            if (!lessons || lessons.length === 0) {
                return res.status(404).send(req.t("errors.no_timetable"));
            }
            const ics = lessonsToIcs(
                lessons,
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
                (u: User) =>
                    u.friendlyName.toLowerCase() === name.toLowerCase(),
            );

            if (user?.language && !req.query.lang) {
                await req.i18n.changeLanguage(user.language);
            }

            if (!user)
                return res.status(404).send(req.t("errors.user_not_found"));

            const type = ["class", "room", "teacher", "subject"].includes(
                rawType || "",
            )
                ? (rawType as "class" | "room" | "teacher" | "subject")
                : undefined;

            const id = rawId ? String(rawId) : undefined;

            const cancelledDisplay =
                (req.query.cancelledDisplay as User["cancelledDisplay"]) ||
                user.cancelledDisplay ||
                "mark";
            const cacheKey = `${user.username}:${type || "own"}:${id || ""}:${req.i18n.language}:${cancelledDisplay}`;
            const cacheEntry = icsCache.get(cacheKey);
            if (cacheEntry) {
                return sendIcs(res, `${name}-${type || "own"}`, cacheEntry.ics);
            }

            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(
                today.getDate() - configManager.config.daysBefore,
            );
            const endDate = new Date(today);
            endDate.setDate(today.getDate() + configManager.config.daysAfter);

            console.log(
                `Fetching timetable for ${user.friendlyName}, type=${type}, id=${id}`,
            );

            const lessons = await fetchTimetable(
                user,
                startDate,
                endDate,
                type,
                id?.toString(),
            );

            console.log(`Fetched ${lessons.length} lessons`);

            if (!lessons || lessons.length === 0) {
                return res.status(404).send(req.t("errors.no_timetable"));
            }

            const ics = lessonsToIcs(
                lessons,
                configManager.config.timezone || "Europe/Berlin",
                `${user.friendlyName} - ${type || "own"} ${id || ""}`,
                req.t,
                cancelledDisplay,
            );

            icsCache.set(cacheKey, ics);

            return sendIcs(
                res,
                `${name}-${type || "own"}-${id?.toLocaleLowerCase() || ""}`,
                ics,
            );
        } catch (err: any) {
            if (err.code === 404) {
                return res.status(404).send(err.message);
            }
            console.error(err);
            res.status(500).send(req.t("errors.fetch_error"));
        }
    });

    const PORT = 7464;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

main();
