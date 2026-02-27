import fs from "fs/promises";
import { watch } from "fs";
import path from "path";
import { Config } from "./types";

class ConfigManager {
    private static instance: ConfigManager;
    private _config!: Config;
    readonly filePath: string;

    private constructor(envPath?: string) {
        this.filePath = path.resolve(
            envPath ??
                process.env.CONFIG_PATH ??
                process.env.CONFIG_FILE ??
                "config.json",
        );
    }

    static getInstance(envPath?: string): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager(envPath);
        }
        return ConfigManager.instance;
    }

    async init(): Promise<void> {
        await this.reload();

        watch(this.filePath, async (eventType) => {
            if (eventType !== "change") return;
            try {
                await this.reload();
                console.log(`[config] Reloaded from ${this.filePath}`);
            } catch (err) {
                console.error(`[config] Failed to reload:`, err);
            }
        });
    }

    private async reload(): Promise<void> {
        const raw = await fs.readFile(this.filePath, "utf8");
        const cfg = JSON.parse(raw) as Config;

        if (
            !Array.isArray(cfg.users) ||
            typeof cfg.cacheDuration !== "number"
        ) {
            throw new Error(
                "Invalid config.json structure (users[] and cacheDuration required)",
            );
        }

        this._config = cfg;
    }

    get config(): Config {
        return this._config;
    }

    get configPath(): string {
        return this.filePath;
    }
}

export const configManager = ConfigManager.getInstance();
