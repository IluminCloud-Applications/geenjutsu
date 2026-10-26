#!/usr/bin/env bash
set -e

#
# Launcher script for Samsung Galaxy S22 5G (SM-S901B) Anti-Detect Android 12 Container
#

CONTAINER_NAME="${1:-camoufox-android12}"
DATA_VOLUME="${2:-camoufox_android12_data}"
PROXY_URL="${3:-}"

echo "=========================================================="
echo " Starting Anti-Detect Android 12 Container: $CONTAINER_NAME"
echo " Storage Volume: $DATA_VOLUME"
if [ -n "$PROXY_URL" ]; then
    echo " Upstream Proxy: $PROXY_URL"
fi
echo "=========================================================="

# Remove existing container if present
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# Prepare device flags
DEVICE_ARGS=()
if [ -d /dev/dri ]; then
    DEVICE_ARGS+=(--device /dev/dri:/dev/dri)
fi
if [ ! -d /dev/binderfs ]; then
    for node in binder hwbinder vndbinder; do
        if [ -e "/dev/$node" ]; then
            DEVICE_ARGS+=(--device "/dev/$node:/dev/$node")
        fi
    done
fi
if [ -e /dev/ashmem ]; then
    DEVICE_ARGS+=(--device /dev/ashmem:/dev/ashmem)
fi

# Build optional boot parameters
BOOT_ARGS=()
if [ -n "$PROXY_URL" ]; then
    BOOT_ARGS+=("androidboot.proxy_url=$PROXY_URL")
fi
BOOT_ARGS+=("androidboot.redroid_gpu_mode=auto")
BOOT_ARGS+=("androidboot.redroid_fps=60")
BOOT_ARGS+=("androidboot.redroid_width=1080")
BOOT_ARGS+=("androidboot.redroid_height=1920")
BOOT_ARGS+=("androidboot.redroid_dpi=420")

docker run -d \
    --name "$CONTAINER_NAME" \
    --privileged \
    -v "$DATA_VOLUME":/data \
    "${DEVICE_ARGS[@]}" \
    -p 5555:5555 \
    geenjutsu/android12-camoufox:latest \
    "${BOOT_ARGS[@]}"

echo "Container $CONTAINER_NAME started successfully!"
echo "Waiting for Android boot to complete..."

BOOT_COMPLETED=0
for i in $(seq 1 60); do
    STATUS=$(docker exec "$CONTAINER_NAME" getprop sys.boot_completed 2>/dev/null || true)
    if [ "$STATUS" = "1" ]; then
        BOOT_COMPLETED=1
        echo "Android 12 boot completed successfully in $i seconds!"
        break
    fi
    sleep 2
done

if [ "$BOOT_COMPLETED" != "1" ]; then
    echo "Warning: Container still booting or boot_completed not yet reported."
fi

echo ""
echo "Device Information:"
docker exec "$CONTAINER_NAME" getprop ro.product.model 2>/dev/null | xargs -I {} echo "  Model: {}"
docker exec "$CONTAINER_NAME" getprop ro.product.brand 2>/dev/null | xargs -I {} echo "  Brand: {}"
docker exec "$CONTAINER_NAME" getprop ro.serialno 2>/dev/null | xargs -I {} echo "  Serial: {}"
docker exec "$CONTAINER_NAME" getprop ro.build.fingerprint 2>/dev/null | xargs -I {} echo "  Fingerprint: {}"

# Connect ADB from host automatically
adb disconnect 127.0.0.1:5555 2>/dev/null || true
adb connect 127.0.0.1:5555 2>/dev/null || true

echo ""
echo "=========================================================="
echo " Anti-Detect Android 12 Container is READY!"
echo "  ADB Device: 127.0.0.1:5555 (or emulator-5554)"
echo "  Launch GUI: scrcpy -s 127.0.0.1:5555"
echo "=========================================================="
