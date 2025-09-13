import { CacheEntry } from "./types";

export class CacheHandler {
    private cache = new Map<string, CacheEntry>();
    private ttlMs: number;

    constructor(ttlSeconds: number) {
        this.ttlMs = ttlSeconds * 1000;
        setInterval(() => this.cleanup(), 60_000);
    }

    get(user: string): CacheEntry | undefined {
        const entry = this.cache.get(user);
        if (!entry) return undefined;
        const now = Date.now();
        if (now - entry.timestamp > this.ttlMs) {
            this.cache.delete(user);
            return undefined;
        }
        return entry;
    }

    set(user: string, ics: string) {
        this.cache.set(user, { timestamp: Date.now(), ics });
    }

    private cleanup() {
        const now = Date.now();
        for (const [user, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttlMs) {
                this.cache.delete(user);
            }
        }
    }
}
