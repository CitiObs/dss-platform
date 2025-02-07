#!/bin/bash

# NOTE: This build requires Docker BuildKit!

IMAGE="draxis/citiobs-frontend"

# Extract version from package.json
VERSION=$(cat package.json | grep version | cut -d':' -f2 | cut -d'"' -f2 | awk '{$1=$1};1')

PUBLISH=false

# Parse arguments
for arg in "$@"; do
    if [ "$arg" = "help" ]; then
        echo "Usage: $0 [publish] [<version>]"
        echo "e.g. $0 publish 2.1.0-pre.1"
        exit 0
    elif [ "$arg" = "publish" ]; then
        PUBLISH=true
    else        
        VERSION=$arg
    fi
done

# Build the image
echo -e "\n==== Building $IMAGE:$VERSION ====\n"
docker build --tag $IMAGE:$VERSION --tag $IMAGE:latest -f ./docker/Dockerfile  .

# Publish to Docker Hub
if [ "$1" = "publish" ]; then
    echo -e "\n==== Publishing $IMAGE:$VERSION to Docker Hub ====\n"
    docker push $IMAGE:$VERSION
    docker push $IMAGE:latest
fi
