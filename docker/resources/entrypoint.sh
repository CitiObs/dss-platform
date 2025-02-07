#!/bin/sh

echo "Setting environment variables..."
env-injector.sh /var/www/html/assets

echo "Starting NGINX..."
nginx -g "daemon off;"
