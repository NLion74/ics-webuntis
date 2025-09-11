import express from "express";
import { loadConfig } from "./config";
import { fetchTimetable } from "./webuntis";
import { lessonsToIcs } from "./ics";
import { CacheEntry } from "./types";

async function main() {
    const { config, configPath } = await loadConfig();
    console.log(`Loaded config from ${configPath}`);

    const app = express();

    const icsCache = new Map<string, CacheEntry>();

    app.get("/timetable/:name", async (req, res) => {
        try {
            const user = config.users.find(
                (u) =>
                    u.friendlyName.toLowerCase() ===
                    req.params.name.toLowerCase()
            );
            if (!user) return res.status(404).send("User not found");

            const now = Date.now();
            const cache = icsCache.get(user.username);
            if (
                cache &&
                now - cache.timestamp < config.cacheDuration * 60 * 60 * 24
            ) {
                return res
                    .setHeader("Content-Type", "text/calendar")
                    .setHeader(
                        "Content-Disposition",
                        `attachment; filename=${user.friendlyName}.ics`
                    )
                    .send(cache.ics);
            }

            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - config.daysBefore);
            const endDate = new Date(today);
            endDate.setDate(today.getDate() + config.daysAfter);

            const lessons = await fetchTimetable(user, startDate, endDate);
            const ics = lessonsToIcs(
                lessons,
                config.timezone || "Europe/Berlin"
            );

            icsCache.set(user.username, { timestamp: now, ics });

            res.setHeader("Content-Type", "text/calendar");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=${user.friendlyName}.ics`
            );
            res.send(ics);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching timetable");
        }
    });

    const PORT = 7464;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

main();
