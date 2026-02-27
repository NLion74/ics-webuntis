# ICS-WebUntis

ICS-WebUntis is a lightweight service that exports timetables from [WebUntis](https://www.untis.at/) as `.ics` calendar feeds.  
It is designed for reliability, minimal resource usage, and straightforward deployment via Docker.

## Features

- Fetch timetables directly from WebUntis
- Expose an `.ics` calendar endpoint for integration with any calendar client
- Built-in caching to reduce load on WebUntis
- Single-container deployment with Docker
- Strictly validated configuration
- Multiple Users supported
- Fetch timetables for specific classes, rooms, teachers, or subjects by name or numeric ID
- Multiple language support with automatic detection and user-specific language settings (currently supports English and German)
- Configurable handling of cancelled lessons
- Optional per-user access token protection

## Quick Start

### Run with Docker Compose

```yaml
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

```json
{
    "daysBefore": 7,
    "daysAfter": 14,
    "cacheDuration": 300,
    "users": [
        {
            "school": "myschool",
            "username": "student1",
            "password": "secret",
            "baseurl": "https://mese.webuntis.com/",
            "friendlyName": "student1",
            "language": "en",
            "cancelledDisplay": "mark",
            "accessToken": "my-secret-token"
        }
    ]
}
```

| Option                     | Type    | Default | Required | Description                                                                                                                                                                                                   |
| :------------------------- | :------ | :------ | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `daysBefore`               | integer | `7`     | No       | Number of days in the past to fetch timetable entries for.                                                                                                                                                    |
| `daysAfter`                | integer | `14`    | No       | Number of days in the future to fetch timetable entries for.                                                                                                                                                  |
| `cacheDuration`            | integer | `300`   | No       | Cache duration in seconds (5 minutes by default). Prevents excessive requests to WebUntis.                                                                                                                    |
| `users`                    | array   | `[]`    | Yes      | List of user objects for connecting to WebUntis.                                                                                                                                                              |
| `users[].school`           | string  | -       | Yes      | The school name as used in WebUntis.                                                                                                                                                                          |
| `users[].username`         | string  | -       | Yes      | The user account name.                                                                                                                                                                                        |
| `users[].password`         | string  | -       | Yes      | The user account password.                                                                                                                                                                                    |
| `users[].baseurl`          | string  | -       | Yes      | The base URL of your WebUntis instance (e.g., `https://mese.webuntis.com/`).                                                                                                                                  |
| `users[].friendlyName`     | string  | -       | Yes      | A unique local identifier for this user, used in the `.ics` URL.                                                                                                                                              |
| `users[].language`         | string  | `en`    | No       | Preferred language for the user (supported values: `en`, `de`).                                                                                                                                               |
| `users[].cancelledDisplay` | string  | `show`  | No       | How to handle cancelled lessons. Options: `hide` (exclude them entirely), `mark` (include them but marked as CANCELLED), `show` (include them and clients decide on how to handle the ICS `STATUS` property). |
| `users[].accessToken`      | string  | -       | No       | Optional access token(s) required to access this user's timetable.                                                                                                                                            |

## Usage

### Personal timetable

```
http://<host>:7464/timetable/friendlyName.ics
```

`<friendlyName>` is the one specified in the user configuration
Returns the personal timetable as an .ics feed

If an access token is configured, append ?access_token=my-secret:

```
http://<host>:7464/timetable/friendlyName.ics?access_token=my-secret
```

### Specific element timetable (class, room, teacher, subject)

`<type>`: `"class"`, `"room"`, `"teacher"`, or `"subject"`
`<id>` Either the numeric ID or the name of the element (the service will resolve the name automatically)

Example URLs:

`http://localhost:7464/timetable/student1/class/10.3`
`http://localhost:7464/timetable/student1/room/24`
`http://localhost:7464/timetable/student1/teacher/MrSmith?lang=de`

Replace `student1` with the friendly name of your user, and `class/10.3` with the desired type and ID.
If the ID cannot be resolved, the service will attempt to use it as a numeric ID.

### Different languages

The service supports multiple languages and will attempt to detect the preferred language for each request. The detection order is as follows:

1. Query parameter `lang` (e.g., `?lang=en`)
2. User-specific language setting from the configuration file
3. `Accepted-Language` header from the request (your browser or calendar client should set this automatically based on your system settings)

### Cancelled lessons display

The `cancelledDisplay` option in the user configuration allows you to control how cancelled lessons are handled in the generated `.ics` feed:

- `hide`: Cancelled lessons will be completely excluded from the feed.
- `show`: Cancelled lessons will be included and marked with `STATUS:CANCELLED`, allowing calendar clients to display them differently (e.g., crossed out).
- `mark`: Same as `show` but extra text is added to the lesson title (e.g., "Math - CANCELLED")

### URL parameters

The following query parameters can be used to override the default behavior for a specific request:

- `lang`: Override the detected language for this request (e.g., `?lang=en`)
- `cancelledDisplay`: Override the cancelled lessons display setting for this request (e.g., `?cancelledDisplay=mark`)
- `access_token`: Access token (if configured) in format `?access_token=my-secret`

## Contributing

Feel free to contribute at any time! If so either create an issue to discuss your changes first or just open a Pull Request if you prefer.

### Development Setup

1. **Clone the repository:**

```bash
git clone https://github.com/NLion74/ics-webuntis
cd ics-webuntis
```

2. **Install dependencies:**

```
npm install
```

1. **Run the project locally:**

```
npm run dev
```
