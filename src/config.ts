import fs from "fs/promises";
import path from "path";
import { Config } from "./types";

export async function loadConfig(): Promise<{
    config: Config;
    configPath: string;
}> {
    const envPath =
        process.env.CONFIG_PATH ?? process.env.CONFIG_FILE ?? "config.json";
    const resolved = path.resolve(envPath);

    try {
        const raw = await fs.readFile(resolved, "utf8");
        const cfg = JSON.parse(raw) as Config;

        if (
            !Array.isArray(cfg.users) ||
            typeof cfg.cacheDuration !== "number"
        ) {
            throw new Error(
                "Invalid config.json structure (users[] and cacheDuration required)"
            );
        }

        return { config: cfg, configPath: resolved };
    } catch (err) {
        console.error(
            `❌ No config found at "${resolved}". Please create one by copying "example-config.json" and filling in your credentials.`
        );
        throw err;
    }
}
