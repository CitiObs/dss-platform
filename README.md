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
