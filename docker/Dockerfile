# ==== Builder ====

FROM node:22.17.1 AS builder

COPY ./ /var/tmp/app

WORKDIR /var/tmp/app

RUN --mount=type=ssh npm install && npm run build


# ==== Runner ====

FROM nginx:1.27

RUN mkdir -p /var/www/html

COPY docker/resources/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/resources/env-injector.sh /usr/local/bin/
COPY docker/resources/entrypoint.sh /

COPY --from=builder /var/tmp/app/dist /var/www/html

ENTRYPOINT [ "/entrypoint.sh" ]
