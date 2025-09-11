# WebUntis Timetable ICS Exporter

A Node.js/TypeScript service that generates ICS calendar files from WebUntis timetables.

## Features

-   Generates `.ics` calendar files for multiple users.
-   Supports caching for improved performance.
-   Configurable via `config.json` or environment variables.
-   Works in development (`ts-node`) and production (Docker).

## Getting Started

### Development

```bash
git clone https://github.com/NLion74/ics-webuntis.git
cd ics-webuntis
docker-compose -f dev-docker-compose.yml up
```
