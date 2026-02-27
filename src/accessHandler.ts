import { RequestHandler } from "express";
import { configManager } from "./config";
import { User } from "./types";

export const accessHandler: RequestHandler = (req, res, next) => {
    const rawName = req.params.name;

    const name = Array.isArray(rawName)
        ? rawName[0]?.toLowerCase()
        : rawName?.toLowerCase();

    if (!name) {
        return next();
    }

    const user = configManager.config.users.find(
        (u: User) => u.friendlyName.toLowerCase() === name,
    );

    if (!user) {
        return next();
    }

    const configured = user.accessToken;

    if (!configured) {
        return next();
    }

    const allowedTokens = Array.isArray(configured)
        ? configured.map(String)
        : [String(configured)];

    const raw =
        req.query.access_token ||
        req.query.accessToken ||
        req.headers["x-access-token"] ||
        req.headers["authorization"];

    const token = Array.isArray(raw) ? raw[0] : raw;

    if (!token || !allowedTokens.includes(String(token))) {
        const tFunc = (req as any).t as ((k: string) => string) | undefined;

        const message =
            (typeof tFunc === "function" &&
                tFunc("errors.invalid_access_token")) ||
            "Invalid or missing access token";

        return res.status(401).send(message);
    }

    next();
};

export default accessHandler;
