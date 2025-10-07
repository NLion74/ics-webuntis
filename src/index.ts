import express from "express";
import { configManager } from "./config";
import { fetchTimetable } from "./webuntis";
import { lessonsToIcs } from "./ics";
import { CacheHandler } from "./cacheHandler";
import { User } from "./types";

async function main() {
    await configManager.init();
    console.log(`Loaded config from ${configManager.configPath}`);

    const app = express();
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
            if (!user) return res.status(404).send("User not found");

            const cacheEntry = icsCache.get(user.username);
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
            const ics = lessonsToIcs(
                lessons,
                configManager.config.timezone || "Europe/Berlin",
                user.friendlyName
            );

            return sendIcs(res, user.friendlyName, ics);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching timetable");
        }
    });

    app.get("/timetable/:name/:type/:id", async (req, res) => {
        try {
            const { name, type: rawType, id: rawId } = req.params;

            const user = configManager.config.users.find(
                (u: User) => u.friendlyName.toLowerCase() === name.toLowerCase()
            );
            if (!user) return res.status(404).send("User not found");

            const type = ["class", "room", "teacher", "subject"].includes(
                rawType || ""
            )
                ? (rawType as "class" | "room" | "teacher" | "subject")
                : undefined;

            const id = rawId ? String(rawId) : undefined;

            const cacheKey = `${user.username}:${type || "own"}:${id || ""}`;
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

            const ics = lessonsToIcs(
                lessons,
                configManager.config.timezone || "Europe/Berlin",
                `${user.friendlyName} - ${type || "own"} ${id || ""}`
            );

            icsCache.set(cacheKey, ics);

            return sendIcs(res, `${name}-${type || "own"}-${id || ""}`, ics);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching timetable");
        }
    });

    const PORT = 7464;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

main();
