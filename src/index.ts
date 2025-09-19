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
                configManager.config.timezone || "Europe/Berlin"
            );

            return sendIcs(res, user.friendlyName, ics);
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching timetable");
        }
    });

    const PORT = 7464;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

main();
