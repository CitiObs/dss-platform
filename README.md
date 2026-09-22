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
git pull origin version2
docker compose -f docker-compose.prod.yml up -d
```

This builds the `co-frontend` image from `docker/Dockerfile` (multi-stage: `npm install && npm run build`, served by nginx) and (re)starts it alongside the `keycloak` service. Both containers join the external `nginx-proxy-citiobs` network, which is fronted by an `nginx-proxy` + Let's Encrypt companion that routes `VIRTUAL_HOST`/`LETSENCRYPT_HOST` (`dss.citiobs.eu` for the frontend, `auth.dss.citiobs.eu` for Keycloak) and handles TLS.

To rebuild only the frontend after a change:

```sh
docker compose -f docker-compose.prod.yml up -d co-frontend
```

`build-image.sh` is available to build and publish a tagged image to Docker Hub (`draxis/citiobs-frontend`) as an alternative distribution path, but is not part of the current server deploy flow above.

### Sensor cache refresh

The sensor cache (`public/sensor-cache`) is kept up to date on the server via cron, running `scripts/generate-sensor-cache.js` in a throwaway `node:22` container:

```cron
# Quick update every hour (active sensors only, ~1-2 min)
0 * * * * docker run --rm -v /home/draxis/citiobs-ai/co-frontend-ai:/app -w /app node:22 node scripts/generate-sensor-cache.js --quick

# Full scan every 6 hours (discover new sensors, ~30 min)
0 */6 * * * docker run --rm -v /home/draxis/citiobs-ai/co-frontend-ai:/app -w /app node:22 node scripts/generate-sensor-cache.js
```
