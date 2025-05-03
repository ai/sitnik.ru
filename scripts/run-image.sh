#!/bin/bash

ERROR='\033[0;31m'
WARN='\033[0;33m'
NC='\033[0m'

BUILD_OUTPUT=$(podman build . 2>&1) || {
  echo -e "${ERROR}Build failed:${NC}\n$BUILD_OUTPUT"
  exit 1
}
IMAGE_ID=$(echo "$BUILD_OUTPUT" | tail -1)

SIZE=$(podman image inspect "$IMAGE_ID" --format='{{.Size}}' | \
    awk '{printf "%d MB", $1/1024/1024}')
echo -e "${WARN}Image size: ${SIZE}${NC}"
