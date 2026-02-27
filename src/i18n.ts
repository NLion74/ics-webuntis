import i18next from "i18next";
import Backend from "i18next-fs-backend";
import middleware from "i18next-http-middleware";
import path from "path";

i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
        showSupportNotice: false,
        fallbackLng: "en",
        supportedLngs: ["en", "de"], // Add more languages as needed
        preload: ["en", "de"],
        backend: {
            loadPath: path.join(__dirname, "../locales/{{lng}}/{{ns}}.json"),
        },
        detection: {
            order: ["querystring", "header"],
            caches: false,
            lookupQuerystring: "lang",
            lookupHeader: "accept-language",
        },
    });

export default i18next;
