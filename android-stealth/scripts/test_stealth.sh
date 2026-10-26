#!/usr/bin/env bash
set -e

#
# Automated Verification Suite for Camoufox-inspired Android 12 Container
#

TEST_CONTAINER="test-stealth-s22"
TEST_VOLUME="test_s22_data_vol"

cleanup() {
    echo "Cleaning up test environment..."
    docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
    docker volume rm "$TEST_VOLUME" 2>/dev/null || true
}

trap cleanup EXIT

echo "=========================================================="
echo " Starting Automated Stealth Verification Suite"
echo "=========================================================="

cleanup

echo "[Step 1] Starting container with clean volume..."
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

docker run -d \
    --name "$TEST_CONTAINER" \
    --privileged \
    -v "$TEST_VOLUME":/data \
    "${DEVICE_ARGS[@]}" \
    geenjutsu/android12-camoufox:latest

echo "[Step 2] Waiting for Android 12 boot..."
BOOTED=0
for i in $(seq 1 60); do
    STATUS=$(docker exec "$TEST_CONTAINER" getprop sys.boot_completed 2>/dev/null || true)
    if [ "$STATUS" = "1" ]; then
        BOOTED=1
        echo "Container booted in $i seconds!"
        break
    fi
    sleep 2
done

if [ "$BOOTED" != "1" ]; then
    echo "ERROR: Container failed to boot within timeout."
    docker logs --tail 50 "$TEST_CONTAINER"
    exit 1
fi

# Allow device_profile post-boot daemon to complete
sleep 3

echo ""
echo "==================== VERIFICATION TESTS ===================="

# 1. Properties Verification
echo "[Test 1] Checking Android System Properties..."
MODEL=$(docker exec "$TEST_CONTAINER" getprop ro.product.model)
BRAND=$(docker exec "$TEST_CONTAINER" getprop ro.product.brand)
MANUF=$(docker exec "$TEST_CONTAINER" getprop ro.product.manufacturer)
TAGS=$(docker exec "$TEST_CONTAINER" getprop ro.build.tags)
BUILD_TYPE=$(docker exec "$TEST_CONTAINER" getprop ro.build.type)
VERIFIED_BOOT=$(docker exec "$TEST_CONTAINER" getprop ro.boot.verifiedbootstate)
SERIAL=$(docker exec "$TEST_CONTAINER" getprop ro.serialno)
SECURE=$(docker exec "$TEST_CONTAINER" getprop ro.secure)
DEBUGGABLE=$(docker exec "$TEST_CONTAINER" getprop ro.debuggable)

echo "  Model:               $MODEL (expected: SM-S901B)"
echo "  Brand:               $BRAND (expected: samsung)"
echo "  Manufacturer:        $MANUF (expected: samsung)"
echo "  Build Tags:          $TAGS (expected: release-keys)"
echo "  Build Type:          $BUILD_TYPE (expected: user)"
echo "  Verified Boot:       $VERIFIED_BOOT (expected: green)"
echo "  Secure:              $SECURE (expected: 1)"
echo "  Debuggable:          $DEBUGGABLE (expected: 0)"
echo "  Serial Number:       $SERIAL"

if [ "$MODEL" != "SM-S901B" ] || [ "$BRAND" != "samsung" ] || [ "$TAGS" != "release-keys" ]; then
    echo "FAIL: System properties mismatch!"
    exit 1
fi
echo "PASS: Android System Properties verified."

# 2. Check for container/emulator leaks in getprop
echo ""
echo "[Test 2] Scanning getprop for residual container indicators..."
PROPS=$(docker exec "$TEST_CONTAINER" getprop)

LEAK_COUNT=0
if echo "$PROPS" | grep -i "redroid" | grep -v "redroid_version" >/dev/null; then
    echo "FAIL: 'redroid' found in properties:"
    echo "$PROPS" | grep -i "redroid"
    LEAK_COUNT=$((LEAK_COUNT + 1))
fi

if echo "$PROPS" | grep -i "qemu" >/dev/null; then
    echo "FAIL: 'qemu' found in properties:"
    echo "$PROPS" | grep -i "qemu"
    LEAK_COUNT=$((LEAK_COUNT + 1))
fi

if echo "$PROPS" | grep -i "test-keys" >/dev/null; then
    echo "FAIL: 'test-keys' found in properties:"
    echo "$PROPS" | grep -i "test-keys"
    LEAK_COUNT=$((LEAK_COUNT + 1))
fi

if [ "$LEAK_COUNT" -eq 0 ]; then
    echo "PASS: Zero container indicators found in properties."
else
    echo "FAIL: Found $LEAK_COUNT indicator leaks."
    exit 1
fi

# 3. CPU Info Check
echo ""
echo "[Test 3] Verifying /proc/cpuinfo..."
CPU_INFO=$(docker exec "$TEST_CONTAINER" cat /proc/cpuinfo)
echo "$CPU_INFO" | grep "Hardware"
echo "$CPU_INFO" | grep -c "processor" | xargs -I {} echo "  Total cores: {}"

if echo "$CPU_INFO" | grep -q "Samsung EXYNOS2200"; then
    echo "PASS: /proc/cpuinfo correctly reports Samsung EXYNOS2200."
else
    echo "FAIL: /proc/cpuinfo does not report Samsung EXYNOS2200!"
    exit 1
fi

# 4. Kernel /proc/version Check
echo ""
echo "[Test 4] Verifying /proc/version..."
PROC_VERSION=$(docker exec "$TEST_CONTAINER" cat /proc/version)
echo "  Version: $PROC_VERSION"
if echo "$PROC_VERSION" | grep -q "5.10.136-android12-9-24750181-abS901BXXU2AVF1"; then
    echo "PASS: /proc/version correctly reports Samsung Galaxy S22 kernel."
else
    echo "FAIL: /proc/version mismatch!"
    exit 1
fi

# 5. Kernel /proc/cmdline Check
echo ""
echo "[Test 5] Verifying /proc/cmdline..."
CMDLINE=$(docker exec "$TEST_CONTAINER" cat /proc/cmdline)
echo "  Cmdline: $CMDLINE"
if echo "$CMDLINE" | grep -q "androidboot.hardware=exynos2200" && ! echo "$CMDLINE" | grep -q "qemu=1"; then
    echo "PASS: /proc/cmdline is authentic (no qemu=1)."
else
    echo "FAIL: /proc/cmdline contains qemu or missing hardware identifier!"
    exit 1
fi

# 6. Uname Check
echo ""
echo "[Test 6] Verifying uname..."
UNAME_M=$(docker exec "$TEST_CONTAINER" uname -m)
UNAME_A=$(docker exec "$TEST_CONTAINER" uname -a)
echo "  uname -m: $UNAME_M"
echo "  uname -a: $UNAME_A"
if [ "$UNAME_M" = "aarch64" ]; then
    echo "PASS: uname -m reports aarch64."
else
    echo "FAIL: uname -m reported $UNAME_M instead of aarch64!"
    exit 1
fi

# 7. Battery Telemetry Check
echo ""
echo "[Test 7] Verifying Battery Telemetry..."
BATTERY_INFO=""
for i in $(seq 1 20); do
    BATTERY_INFO=$(docker exec "$TEST_CONTAINER" dumpsys battery 2>/dev/null || true)
    if echo "$BATTERY_INFO" | grep -q "level:"; then
        break
    fi
    sleep 1
done
echo "$BATTERY_INFO" | grep -E "level|temperature|status|AC powered|USB powered"
if echo "$BATTERY_INFO" | grep -q "level:"; then
    echo "PASS: Battery telemetry active and realistic."
else
    echo "FAIL: Battery telemetry not active."
    exit 1
fi

# 7b. GPU / GLES & Sensors & Sysfs Topology Check
echo ""
echo "[Test 7b] Verifying GPU GLES Vendor/Renderer, Hardware Sensors, and Sysfs CPU Topology..."
GLES_LINE=$(docker exec "$TEST_CONTAINER" dumpsys SurfaceFlinger | grep "GLES:" | head -n 1)
echo "  SurfaceFlinger $GLES_LINE"
if echo "$GLES_LINE" | grep -q "Samsung, Samsung Xclipse 920" && ! echo "$GLES_LINE" | grep -qiE "AMD|radeonsi|navi|Mesa"; then
    echo "PASS: GLES Vendor is 'Samsung' and Renderer is 'Samsung Xclipse 920' (zero AMD/radeonsi leak)."
else
    echo "FAIL: GLES string leak detected: $GLES_LINE"
    exit 1
fi

SENSOR_DUMP=$(docker exec "$TEST_CONTAINER" dumpsys sensorservice)
echo "$SENSOR_DUMP" | grep -E "LSM6DSO|AK09918|TMD4907|Total [0-9]+ h/w sensors" | head -n 8
if echo "$SENSOR_DUMP" | grep -q "LSM6DSO Accelerometer" && echo "$SENSOR_DUMP" | grep -q "LSM6DSO Gyroscope"; then
    echo "PASS: Hardware & virtual sensors registered and active in SensorService."
else
    echo "FAIL: Sensors missing from SensorService!"
    echo "$SENSOR_DUMP" | head -n 30
    exit 1
fi

CPU_ONLINE=$(docker exec "$TEST_CONTAINER" cat /sys/devices/system/cpu/online)
CPU7_FREQ=$(docker exec "$TEST_CONTAINER" cat /sys/devices/system/cpu/cpu7/cpufreq/cpuinfo_max_freq)
echo "  /sys/devices/system/cpu/online: $CPU_ONLINE (cpu7 max_freq: $CPU7_FREQ)"
if [ "$CPU_ONLINE" = "0-7" ] && [ "$CPU7_FREQ" = "2800000" ]; then
    echo "PASS: /sys/devices/system/cpu masked as 8-core Exynos 2200."
else
    echo "FAIL: /sys/devices/system/cpu topology mismatch!"
    exit 1
fi

if docker exec "$TEST_CONTAINER" grep -qiE "qemu|vbox|redroid" /proc/mounts; then
    echo "FAIL: /proc/mounts leaks emulator mounts!"
    exit 1
else
    echo "PASS: /proc/mounts is clean (no emulator/redroid mounts)."
fi

# 8. Device Identity Persistence across restarts
echo ""
echo "[Test 8] Testing Hardware Identity Persistence across container restart..."
FIRST_SERIAL=$(docker exec "$TEST_CONTAINER" getprop ro.serialno)
FIRST_ID=""
for i in $(seq 1 15); do
    FIRST_ID=$(docker exec "$TEST_CONTAINER" settings get secure android_id 2>/dev/null || true)
    if [ -n "$FIRST_ID" ] && [ "$FIRST_ID" != "null" ]; then
        break
    fi
    sleep 1
done
FIRST_CONF=$(docker exec "$TEST_CONTAINER" cat /data/system/.device_identity.conf)

echo "  First Boot Serial:     $FIRST_SERIAL"
echo "  First Boot Android ID: $FIRST_ID"

echo "  Stopping container..."
docker stop "$TEST_CONTAINER" >/dev/null

echo "  Re-starting container with the same data volume..."
docker start "$TEST_CONTAINER" >/dev/null

for i in $(seq 1 60); do
    STATUS=$(docker exec "$TEST_CONTAINER" getprop sys.boot_completed 2>/dev/null || true)
    if [ "$STATUS" = "1" ]; then
        break
    fi
    sleep 1
done
sleep 3

SECOND_SERIAL=$(docker exec "$TEST_CONTAINER" getprop ro.serialno)
SECOND_ID=""
for i in $(seq 1 15); do
    SECOND_ID=$(docker exec "$TEST_CONTAINER" settings get secure android_id 2>/dev/null || true)
    if [ -n "$SECOND_ID" ] && [ "$SECOND_ID" != "null" ]; then
        break
    fi
    sleep 1
done

echo "  Second Boot Serial:     $SECOND_SERIAL"
echo "  Second Boot Android ID: $SECOND_ID"

if [ "$FIRST_SERIAL" = "$SECOND_SERIAL" ] && [ "$FIRST_ID" = "$SECOND_ID" ]; then
    echo "PASS: Device Identity is 100% persistent across container restarts!"
else
    echo "FAIL: Identity changed between boots!"
    exit 1
fi

echo ""
echo "=========================================================="
echo " ALL 8 STEALTH & COMPATIBILITY CHECKS PASSED SUCCESSFULLY!"
echo "=========================================================="
