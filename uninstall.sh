#!/usr/bin/env bash
set -e

IMAGE_NAME="tesla-wrap-studio:latest"
CONTAINER_NAME="tesla-wrap-studio"

echo "Stopping and removing container: $CONTAINER_NAME (if exists)"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
  echo "Container $CONTAINER_NAME has been removed."
else
  echo "No container named $CONTAINER_NAME found."
fi

read -p "Do you also want to remove image $IMAGE_NAME? [y/N]: " REPLY
REPLY=${REPLY:-N}

if [[ "$REPLY" == "y" || "$REPLY" == "Y" ]]; then
  if docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "^${IMAGE_NAME}$"; then
    docker rmi "$IMAGE_NAME" || true
    echo "Image $IMAGE_NAME has been removed."
  else
    echo "No image named $IMAGE_NAME found."
  fi
else
  echo "Image $IMAGE_NAME is kept."
fi
