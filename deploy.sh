#!/usr/bin/env bash
set -e

IMAGE_NAME="tesla-wrap-studio:latest"
CONTAINER_NAME="tesla-wrap-studio"
HOST_PORT="9000"

PCK_PATH="public/godot/index.pck"
PCK_URL="https://lfs.tesla-wrap.com/index.pck"

if [[ ! -f "$PCK_PATH" ]]; then
  echo "\nWARN: Missing $PCK_PATH"
  echo "3D 预览需要 Godot 资源包 index.pck，准备尝试自动下载："
  echo "  $PCK_URL"

  mkdir -p "$(dirname "$PCK_PATH")"

  if command -v wget >/dev/null 2>&1; then
    if wget -O "$PCK_PATH" "$PCK_URL"; then
      echo "Downloaded index.pck to $(pwd)/$PCK_PATH"
    else
      rm -f "$PCK_PATH" >/dev/null 2>&1 || true
      echo "\nERROR: 自动下载失败。请手动下载并放到："
      echo "  $(pwd)/$PCK_PATH"
      exit 1
    fi
  else
    echo "\nERROR: 未找到 wget 命令，无法自动下载。"
    echo "请手动下载："
    echo "  $PCK_URL"
    echo "并放到："
    echo "  $(pwd)/$PCK_PATH"
    exit 1
  fi
fi

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
echo "Verify endpoints:"
echo "  http://localhost:${HOST_PORT}/godot/index.html"
echo "  http://localhost:${HOST_PORT}/godot/index.pck"
