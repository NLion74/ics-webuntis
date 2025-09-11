# ICS-WebUntis

ICS-WebUntis is a lightweight service that exports timetables from [WebUntis](https://www.untis.at/) as `.ics` calendar feeds.  
It is designed for reliability, minimal resource usage, and straightforward deployment via Docker.

## Features

-   Fetch timetables directly from WebUntis
-   Expose an `.ics` calendar endpoint for integration with any calendar client
-   Built-in caching to reduce load on WebUntis
-   Single-container deployment with Docker
-   Strictly validated configuration
-   Multiple Users supported

## Quick Start

### Run with Docker Compose

```bash
version: "3.3"

services:
    webuntis-timetable:
        image: nlion/ics-webuntis:latest
        container_name: webuntis-timetable
        environment:
            - NODE_ENV=production
            - PORT=7464
            - CONFIG_FILE=/app/config.json
        volumes:
            - ./dev-config.json:/app/config.json:ro
        ports:
            - "7464:7464"
        restart: unless-stopped

```

Start it with 'docker-compose up'

This will fail without a 'config.json'

## Configuration

The service requires a JSON configuration file.
`config.json` example

```
{
    "daysBefore": 7,
    "daysAfter": 14,
    "cacheDuration": 300,
    "users": [
        {
        "school": "myschool",
        "username": "student1",
        "password": "secret",
        "baseurl": "https://mese.webuntis.com/WebUntis/",
        "friendlyName": "student1"
        }
    ]
}
```

## Usage

Once running, the service exposes an `.ics` feed:

```
http://<host>:7464/timetable/friendlyName.ics

```

friendlyName represents the one specified in the user configuration. This link can be subscribed to any calendar client and just works out of the box.

## Contributing

Feel free to contribute at any time! If so either create an issue to discuss your changes first or just open a Pull Request if you prefer.
