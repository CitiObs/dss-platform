# CitiObs DSS Platform

This tools aims to help policy makers use citizen-generated data to make informed decisions regarding urban planning, air quality management and climate adaptation.

## Recommended IDE Setup

-   [VSCode](https://code.visualstudio.com/)

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Deployment

Production runs on the `version2` branch, deployed manually (no CI/CD pipeline) on the app server at `/home/draxis/citiobs-ai/co-frontend-ai`:

```sh
git pull --ff-only origin version2
docker compose --file docker-compose.prod.yml build co-frontend
docker compose --file docker-compose.prod.yml up --detach --no-deps co-frontend
```

The build step creates the `co-frontend` image from `docker/Dockerfile` (multi-stage: `npm install && npm run build`, served by nginx). The site stays up while it builds. The last step recreates the frontend container from the new image, and `--no-deps` leaves the `keycloak` service untouched.

The build step is required: `up` alone does not rebuild an existing image, so it would keep serving the old code.

The build needs two gitignored files in the project root: `.npmrc` with the token for the private `@geoint` npm registry, and `.env` (see [Configuration](#configuration)).

Both containers join the external `nginx-proxy-citiobs` network, which is fronted by an `nginx-proxy` + Let's Encrypt companion that routes `VIRTUAL_HOST`/`LETSENCRYPT_HOST` (`dss.citiobs.eu` for the frontend, `auth.dss.citiobs.eu` for Keycloak) and handles TLS.

To start both services for the first time, or to bring Keycloak back up:

```sh
docker compose --file docker-compose.prod.yml up --detach
```

## Configuration

There are three kinds of settings: environment variables, fixed values in the code, and the cron job that refreshes the sensor cache.

### Environment variables

Listed in `.env.example`. Copy it to `.env` and fill in the values.

| Variable | Purpose |
| --- | --- |
| `VITE_APP_TITLE` | Browser tab title. |
| `VITE_KEYCLOAK_URL` | Base URL of Keycloak. The text `localhost` in it is replaced with the hostname of the page at runtime. |
| `VITE_KEYCLOAK_REALM` | Keycloak realm. Must match `docker/keycloak/citiobs-realm.json` (`citiobs`). |
| `VITE_KEYCLOAK_CLIENT_ID` | Keycloak client. Must match the same file (`co-frontend`). |
| `VITE_API_URL` | Not in use. Base URL of the `geoint-api` client that `@geoint/geoint-vue` uses for its backend features (workspaces, GIS layers, reports). The app uses none of them. |
| `VITE_GEOSERVER_URL` | Not in use. Base URL of the `wfs` client of `@geoint/geoint-vue`. The app makes no WFS requests. |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | Password of the Keycloak bootstrap admin (`admin`), read by `docker-compose.prod.yml`. Required on the server: every `docker compose --file docker-compose.prod.yml` command fails without it, including the frontend build. |

The `VITE_*` variables are build-time values: Vite writes them into the bundle.

-   Development: `docker-compose.yml` sets them under `environment`. A local `.env` works too.
-   Production: the image build reads `.env` from the project root on the server. After a change, build and recreate the container as described in [Deployment](#deployment).

Do not set `VITE_*` variables under `environment` in `docker-compose.prod.yml`. `docker/resources/env-injector.sh` is meant to replace values at container start, but it calls `node`, which the nginx image does not have, so the value ends up as an empty string. The Keycloak variables are not covered by it at all.

### Fixed values in the code

These are constants, not settings. Changing one means editing the code and deploying.

Data source:

| Value | Where |
| --- | --- |
| VirtualAir API URL (`https://api-virtualair.nilu.no/v1.1`) | `BASE_URLS` and literal URLs in `src/composables/api/useSensorThingsApi.js`, `VIRTUALAIR_URL` in `src/components/sensor/useSWNPApi.js`, literal URLs in `src/views/HomeView.vue`, `BASE_URL` in `scripts/generate-sensor-cache.js` |
| Metrics and their ObservedProperty links | `src/common/sensorDefinitions.js`, with a copy in `scripts/generate-sensor-cache.js`. Keep both in sync. |
| Upstream server shown as "Data Origin", per ID prefix | `ORIGIN_BY_PREFIX` in `src/components/sensor/useSWNPApi.js` |

The app only reads from VirtualAir and sends no token.

Freshness and caching:

| Value | Constant | Effect |
| --- | --- | --- |
| 12 hours | `STATIC_CACHE_MAX_AGE` in `src/composables/api/useSensorThingsApi.js` | Age of a `sensor-cache/*.json` file after which the map shows a warning. The data is still shown. |
| 1 hour | `SENSOR_CACHE_TTL` in the same file | Lifetime of the IndexedDB copy, which is used only when the static file cannot be loaded. |
| 5 days | `FIVE_DAYS_MS` in the same file, `daysBack` in `scripts/generate-sensor-cache.js` | A sensor counts as active when its latest observation is newer than this. Keep both in sync. |
| 90%, 3 tries | `LIST_MIN_RATIO`, `LIST_MAX_ATTEMPTS` in `scripts/generate-sensor-cache.js` | The generator keeps the existing file when the API still returns a datastream list below this share of it after this many tries. |
| 300 seconds | `Cache-Control` for `/sensor-cache/` in `docker/resources/nginx.conf` | No effect on the app, which requests the files with a unique query string and `no-store`. |

Not in use: `OBSERVATION_CACHE_TTL` in `src/composables/api/useSensorThingsApi.js` and `EXPIRATION` in `src/stores/sensorStore.js`, both 2 minutes. They belong to functions that nothing calls (`getSimpleThingData`, `getThings`).

The map loads sensor data when the page opens and when the metric changes. An open tab does not refresh by itself.

Changes under `src/` and `docker/` need an image rebuild (see [Deployment](#deployment)). Changes in `scripts/generate-sensor-cache.js` apply from the next cron run after `git pull`, because cron runs the script from the repository.

### Sensor cache refresh (cron)

The map reads `public/sensor-cache/<metric>.json`. `docker-compose.prod.yml` mounts that folder into the container, so new files are served without a rebuild or restart.

The files are written by `scripts/generate-sensor-cache.js`. Each one is written to a temporary `.tmp` file and then renamed, so a run that dies in the middle of a write leaves the previous file in place:

```sh
node scripts/generate-sensor-cache.js            # all metrics, full scan
node scripts/generate-sensor-cache.js --quick    # all metrics, only sensors that were active or had data
node scripts/generate-sensor-cache.js pm25       # one metric
```

On the production server the jobs are in the crontab of the `draxis` user (`crontab -l`). They exist only there, so update this copy whenever the crontab changes:

```cron
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Sensor cache for dss.citiobs.eu. flock prevents overlapping runs.
# Quick update every hour (active sensors only, skipped if a run is in progress)
15 * * * * flock --nonblock /tmp/sensor-cache.lock docker run --rm --init -v /home/draxis/citiobs-ai/co-frontend-ai:/app -w /app node:22 node scripts/generate-sensor-cache.js --quick >> /home/draxis/logs/sensor-cache.log 2>&1

# Full scan daily at 02:00 (discovers new sensors, waits for any running quick update)
0 2 * * * flock /tmp/sensor-cache.lock docker run --rm --init -v /home/draxis/citiobs-ai/co-frontend-ai:/app -w /app node:22 node scripts/generate-sensor-cache.js >> /home/draxis/logs/sensor-cache.log 2>&1
```

Both jobs run the script in a throwaway `node:22` container with the repository mounted and share one lock file. The quick update is skipped while another run holds the lock. The full scan waits for it.

-   A quick run takes 3 to 5 hours (measured in November 2026), so each metric is refreshed about every 3 to 6 hours, not hourly. The 12 hour warning threshold is set with this in mind.
-   The log file must be writable by the cron user. If it is not, the job fails silently and the files stop updating.
-   Each run logs `Run started` and `Run finished` with a UTC timestamp. A run that fails, or stops before the end, logs a line with `ERROR:` and exits with a non-zero code. The exception is a run killed outright (`SIGKILL`, out of memory), which leaves `Run started` with no closing line. A metric that fails is not refreshed in that run, and the run ends with `Run finished with errors`.
-   `scripts/cron-generate-cache.sh` is not used on the production server. The schedule and log path in its header comments do not match the setup above.

### Hostnames and Keycloak

To run under another domain, change:

-   `VIRTUAL_HOST`, `LETSENCRYPT_HOST`, `LETSENCRYPT_EMAIL` and `KC_HOSTNAME` in `docker-compose.prod.yml`.
-   `redirectUris` and `webOrigins` of the `co-frontend` client in `docker/keycloak/citiobs-realm.json`. Keycloak imports this file only when the realm does not exist yet. For an existing realm, change them in the Keycloak admin console.
-   `VITE_KEYCLOAK_URL` in `.env`, then rebuild the image.

The Keycloak bootstrap admin password comes from `.env` (see [Environment variables](#environment-variables)). Keycloak uses them only when the `master` realm has no admin user, so after the first start, change the admin password in the admin console.

`docker/keycloak/citiobs-realm.json` holds no users. Like the client settings, the realm settings in it (`sslRequired`, brute force detection, registration) apply only when the realm is created. For an existing realm, change them in the admin console.
