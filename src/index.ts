import express from "express";
import i18nextMiddleware from 'i18next-http-middleware';
import i18next from './i18n';
import { configManager } from "./config";
import { fetchTimetable } from "./webuntis";
import { lessonsToIcs } from "./ics";
import { CacheHandler } from "./cacheHandler";
import { User } from "./types";

async function main() {
    await configManager.init();
    console.log(`Loaded config from ${configManager.configPath}`);

    const app = express();
    // Add i18next middleware
    app.use(i18nextMiddleware.handle(i18next));
    
    const icsCache = new CacheHandler(configManager.config.cacheDuration);

    function sendIcs(res: express.Response, filename: string, ics: string) {
        return res
            .setHeader("Content-Type", "text/calendar")
            .setHeader(
                "Content-Disposition",
                `attachment; filename=${filename}.ics`
            )
            .send(ics);
    }

    app.get("/timetable/:name", async (req, res) => {
        try {
            const user = configManager.config.users.find(
                (u: User) =>
                    u.friendlyName.toLowerCase() ===
                    req.params.name.toLowerCase()
            );
            if (!user) return res.status(404).send(req.t('errors.user_not_found'));

            // Set user's language if configured, but allow query parameter override
            if (user.language && !req.query.lang) {
                await req.i18n.changeLanguage(user.language);
            }

            const cacheKey = `${user.username}:${req.i18n.language}`;
            const cacheEntry = icsCache.get(cacheKey);
            if (cacheEntry) {
                return sendIcs(res, user.friendlyName, cacheEntry.ics);
            }

            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(
                today.getDate() - configManager.config.daysBefore
            );
            const endDate = new Date(today);
            endDate.setDate(today.getDate() + configManager.config.daysAfter);

            const lessons = await fetchTimetable(user, startDate, endDate);
            if (!lessons || lessons.length === 0) {
                return res.status(404).send(req.t('errors.no_timetable'));
            }
            const ics = lessonsToIcs(
                lessons,
                configManager.config.timezone || "Europe/Berlin",
                user.friendlyName,
                req.t
            );

            icsCache.set(cacheKey, ics);

            return sendIcs(res, user.friendlyName, ics);
        } catch (err: any) {
            if (err.code === 404) {
                return res.status(404).send(err.message);
            }
            console.error(err);
            res.status(500).send(req.t('errors.fetch_error'));
        }
    });

    app.get("/timetable/:name/:type/:id", async (req, res) => {
        try {
            const name = req.params.name?.trim().toLowerCase() || "";
            const rawType = req.params.type?.trim().toLowerCase() || "";
            const rawId = req.params.id?.trim().toLowerCase() || "";

            const user = configManager.config.users.find(
                (u: User) => u.friendlyName.toLowerCase() === name.toLowerCase()
            );
            if (!user) return res.status(404).send(req.t('errors.user_not_found'));

            // Set user's language if configured, but allow query parameter override
            if (user.language && !req.query.lang) {
                await req.i18n.changeLanguage(user.language);
            }

            const type = ["class", "room", "teacher", "subject"].includes(
                rawType || ""
            )
                ? (rawType as "class" | "room" | "teacher" | "subject")
                : undefined;

            const id = rawId ? String(rawId) : undefined;

            const cacheKey = `${user.username}:${type || "own"}:${id || ""}:${req.i18n.language}`;
            const cacheEntry = icsCache.get(cacheKey);
            if (cacheEntry) {
                return sendIcs(res, `${name}-${type || "own"}`, cacheEntry.ics);
            }

            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(
                today.getDate() - configManager.config.daysBefore
            );
            const endDate = new Date(today);
            endDate.setDate(today.getDate() + configManager.config.daysAfter);

            console.log(
                `Fetching timetable for ${user.friendlyName}, type=${type}, id=${id}`
            );

            const lessons = await fetchTimetable(
                user,
                startDate,
                endDate,
                type,
                id?.toString()
            );

            console.log(`Fetched ${lessons.length} lessons`);

            if (!lessons || lessons.length === 0) {
                return res.status(404).send(req.t('errors.no_timetable'));
            }

            const ics = lessonsToIcs(
                lessons,
                configManager.config.timezone || "Europe/Berlin",
                `${user.friendlyName} - ${type || "own"} ${id || ""}`,
                req.t
            );

            icsCache.set(cacheKey, ics);

            return sendIcs(
                res,
                `${name}-${type || "own"}-${id?.toLocaleLowerCase() || ""}`,
                ics
            );
        } catch (err: any) {
            if (err.code === 404) {
                return res.status(404).send(err.message);
            }
            console.error(err);
            res.status(500).send(req.t('errors.fetch_error'));
        }
    });

    const PORT = 7464;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

main();
