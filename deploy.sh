#!/usr/bin/env bash
set -e

IMAGE_NAME="tesla-wrap-studio:latest"
CONTAINER_NAME="tesla-wrap-studio"
HOST_PORT="9000"

# Build image using docker/Dockerfile
docker build -f docker/Dockerfile -t "$IMAGE_NAME" .

# Run container locally for testing (mapped to $HOST_PORT)
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${HOST_PORT}:80" \
  "$IMAGE_NAME"

echo "\nImage built: $IMAGE_NAME"
echo "Container running: $CONTAINER_NAME on http://localhost:${HOST_PORT}"
