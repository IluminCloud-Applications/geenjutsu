#include <stdint.h>
#include <stddef.h>

typedef struct {
    const char *name;
    const char *vendor;
    int32_t version;
    int32_t handle;
    int32_t type;
    float maxRange;
    float resolution;
    float power;
    int32_t minDelay;
    uint32_t fifoReservedEventCount;
    uint32_t fifoMaxEventCount;
    const char *stringType;
    const char *requiredPermission;
    int32_t maxDelay;
    uint64_t flags;
    void *reserved[2];
} android_sensor_t;

_Static_assert(sizeof(android_sensor_t) == 0x68, "sensor_t must be 104 bytes");

typedef struct {
    int32_t version;
    int32_t sensor;
    int32_t type;
    int32_t reserved0;
    int64_t timestamp;
    union {
        struct {
            float x;
            float y;
            float z;
            int8_t status;
            uint8_t reserved[3];
        };
        float data[16];
    };
    uint32_t flags;
    uint32_t reserved1[3];
} android_sensors_event_t;

_Static_assert(sizeof(android_sensors_event_t) == 0x68, "sensors_event_t must be 104 bytes");

extern void *alloc_mem(size_t size);
extern void sleep_ns(const int64_t *duration_ns);
extern int64_t elapsed_ns(void);

__attribute__((section(".text.init"), used))
int sensor_init_bridge(void *dev) {
    android_sensor_t *list = (android_sensor_t *)alloc_mem(sizeof(android_sensor_t) * 5);
    if (!list) {
        return 2;
    }

    uint8_t *raw = (uint8_t *)list;
    for (size_t i = 0; i < sizeof(android_sensor_t) * 5; i++) {
        raw[i] = 0;
    }

    /* 0: LSM6DSO Accelerometer */
    list[0].name = "LSM6DSO Accelerometer";
    list[0].vendor = "STMicroelectronics";
    list[0].version = 1;
    list[0].handle = 1;
    list[0].type = 1; /* SENSOR_TYPE_ACCELEROMETER */
    list[0].maxRange = 78.4532f;
    list[0].resolution = 0.0023928f;
    list[0].power = 0.17f;
    list[0].minDelay = 2000;
    list[0].fifoReservedEventCount = 3000;
    list[0].fifoMaxEventCount = 10000;
    list[0].stringType = "android.sensor.accelerometer";
    list[0].requiredPermission = "";
    list[0].maxDelay = 200000;
    list[0].flags = 0;

    /* 1: AK09918 Magnetometer */
    list[1].name = "AK09918 Magnetometer";
    list[1].vendor = "AKM";
    list[1].version = 1;
    list[1].handle = 2;
    list[1].type = 2; /* SENSOR_TYPE_MAGNETIC_FIELD */
    list[1].maxRange = 4912.0f;
    list[1].resolution = 0.15f;
    list[1].power = 1.1f;
    list[1].minDelay = 10000;
    list[1].fifoReservedEventCount = 600;
    list[1].fifoMaxEventCount = 10000;
    list[1].stringType = "android.sensor.magnetic_field";
    list[1].requiredPermission = "";
    list[1].maxDelay = 200000;
    list[1].flags = 0;

    /* 2: LSM6DSO Gyroscope */
    list[2].name = "LSM6DSO Gyroscope";
    list[2].vendor = "STMicroelectronics";
    list[2].version = 1;
    list[2].handle = 4;
    list[2].type = 4; /* SENSOR_TYPE_GYROSCOPE */
    list[2].maxRange = 34.906586f;
    list[2].resolution = 0.00106526f;
    list[2].power = 0.55f;
    list[2].minDelay = 2000;
    list[2].fifoReservedEventCount = 3000;
    list[2].fifoMaxEventCount = 10000;
    list[2].stringType = "android.sensor.gyroscope";
    list[2].requiredPermission = "";
    list[2].maxDelay = 200000;
    list[2].flags = 0;

    /* 3: TMD4907 Light Sensor */
    list[3].name = "TMD4907 Light Sensor";
    list[3].vendor = "AMS";
    list[3].version = 1;
    list[3].handle = 5;
    list[3].type = 5; /* SENSOR_TYPE_LIGHT */
    list[3].maxRange = 60000.0f;
    list[3].resolution = 1.0f;
    list[3].power = 0.15f;
    list[3].minDelay = 200000;
    list[3].fifoReservedEventCount = 0;
    list[3].fifoMaxEventCount = 0;
    list[3].stringType = "android.sensor.light";
    list[3].requiredPermission = "";
    list[3].maxDelay = 1000000;
    list[3].flags = 2; /* SENSOR_FLAG_ON_CHANGE_MODE */

    /* 4: TMD4907 Proximity Sensor */
    list[4].name = "TMD4907 Proximity Sensor";
    list[4].vendor = "AMS";
    list[4].version = 1;
    list[4].handle = 8;
    list[4].type = 8; /* SENSOR_TYPE_PROXIMITY */
    list[4].maxRange = 8.0f;
    list[4].resolution = 8.0f;
    list[4].power = 0.15f;
    list[4].minDelay = 0;
    list[4].fifoReservedEventCount = 300;
    list[4].fifoMaxEventCount = 10000;
    list[4].stringType = "android.sensor.proximity";
    list[4].requiredPermission = "";
    list[4].maxDelay = 0;
    list[4].flags = 3; /* SENSOR_FLAG_ON_CHANGE_MODE | SENSOR_FLAG_WAKE_UP */

    *(android_sensor_t **)((uint8_t *)dev + 0x18) = list;
    *(size_t *)((uint8_t *)dev + 0x20) = 5;
    return 2;
}

__attribute__((section(".text.poll"), used))
int64_t sensor_poll_bridge(void *dev, android_sensors_event_t *buffer, size_t count) {
    (void)dev;
    if (!buffer || count == 0) {
        return 0;
    }

    int64_t dur = 20000000LL; /* 20ms (50Hz) */
    sleep_ns(&dur);
    int64_t ts = elapsed_ns();

    uint8_t *raw = (uint8_t *)buffer;
    size_t n = count >= 3 ? 3 : 1;
    for (size_t i = 0; i < sizeof(android_sensors_event_t) * n; i++) {
        raw[i] = 0;
    }

    float jitter = (float)((ts >> 18) & 0x3f) * 0.0001f;

    /* Event 0: Accelerometer */
    buffer[0].version = sizeof(android_sensors_event_t);
    buffer[0].sensor = 1;
    buffer[0].type = 1;
    buffer[0].timestamp = ts;
    buffer[0].x = 0.12f + jitter;
    buffer[0].y = 9.76f - jitter * 0.5f;
    buffer[0].z = 0.85f + jitter * 0.8f;
    buffer[0].status = 3;

    if (n >= 3) {
        /* Event 1: Magnetometer */
        buffer[1].version = sizeof(android_sensors_event_t);
        buffer[1].sensor = 2;
        buffer[1].type = 2;
        buffer[1].timestamp = ts;
        buffer[1].x = 21.4f + jitter * 2.0f;
        buffer[1].y = -14.2f - jitter * 1.5f;
        buffer[1].z = -38.6f + jitter * 2.5f;
        buffer[1].status = 3;

        /* Event 2: Gyroscope */
        buffer[2].version = sizeof(android_sensors_event_t);
        buffer[2].sensor = 4;
        buffer[2].type = 4;
        buffer[2].timestamp = ts;
        buffer[2].x = 0.0012f - jitter * 0.02f;
        buffer[2].y = -0.0008f + jitter * 0.02f;
        buffer[2].z = 0.0005f - jitter * 0.01f;
        buffer[2].status = 3;
    }

    return (int64_t)n;
}
