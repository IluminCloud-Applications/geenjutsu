#include <stdio.h>
#include <unistd.h>
#include <sys/stat.h>

/*
 * Helper executed during Docker image build to remove legacy / debug files
 * from the base Android rootfs image.
 */

static const char *FILES_TO_REMOVE[] = {
    "/.dockerenv",
    "/system/xbin/su",
    "/system/bin/su",
    "/vendor/bin/su",
    "/system/etc/init/atrace_userdebug.rc",
    "/system/etc/init/bootstat-debug.rc",
    "/system/etc/init/init-debug.rc",
    "/system/etc/init/llkd-debuggable.rc",
    "/vendor/etc/init/redroid.common.rc",
    "/vendor/etc/init/redroid.legacy.rc",
    "/vendor/etc/init/redroid.omx.rc",
    "/vendor/etc/init/init.redroid.rc",
    "/vendor/etc/init/vncserver.rc",
    "/vendor/bin/vncserver",
    "/vendor/etc/hwdata/amdgpu.ids.redroid",
    "/vendor/lib64/hw/gralloc.redroid.so",
    "/vendor/lib/hw/gralloc.redroid.so",
    "/vendor/lib64/hw/gralloc.gbm.so",
    "/vendor/lib/hw/gralloc.gbm.so",
    "/vendor/lib64/hw/gralloc.cros.so",
    "/vendor/lib/hw/gralloc.cros.so",
    "/vendor/lib64/hw/hwcomposer.redroid.so",
    "/vendor/lib/hw/hwcomposer.redroid.so",
    "/vendor/lib64/hw/vulkan.radeon.so",
    "/vendor/lib/hw/vulkan.radeon.so",
    "/vendor/lib64/hw/vulkan.pastel.so",
    "/vendor/lib/hw/vulkan.pastel.so",
    "/vendor/lib64/hw/vulkan.virtio.so",
    "/vendor/lib/hw/vulkan.virtio.so",
    "/vendor/lib64/hw/vulkan.lvp.so",
    "/vendor/lib/hw/vulkan.lvp.so",
    "/vendor/lib64/hw/vulkan.intel.so",
    "/vendor/lib/hw/vulkan.intel.so",
    "/vendor/lib64/hw/vulkan.intel_hasvk.so",
    "/vendor/lib/hw/vulkan.intel_hasvk.so",
    "/vendor/lib64/hw/vulkan.nouveau.so",
    "/vendor/lib/hw/vulkan.nouveau.so",
    "/vendor/lib64/hw/vulkan.broadcom.so",
    "/vendor/lib/hw/vulkan.broadcom.so",
    "/vendor/lib64/hw/vulkan.freedreno.so",
    "/vendor/lib/hw/vulkan.freedreno.so",
    "/vendor/lib64/egl/libEGL_angle.so",
    "/vendor/lib/egl/libEGL_angle.so",
    "/vendor/lib64/egl/libGLESv1_CM_angle.so",
    "/vendor/lib/egl/libGLESv1_CM_angle.so",
    "/vendor/lib64/egl/libGLESv2_angle.so",
    "/vendor/lib/egl/libGLESv2_angle.so",
    NULL
};

int main(int argc, char *argv[]) {
    for (int i = 0; FILES_TO_REMOVE[i] != NULL; i++) {
        unlink(FILES_TO_REMOVE[i]);
    }
    chmod("/system/bin/uname", 0755);
    chmod("/vendor/bin/device_init", 0755);
    chmod("/vendor/bin/secnetd", 0755);
    chmod("/vendor/bin/resetprop", 0755);
    chmod("/vendor/bin/gpu_config.sh", 0755);

    if (argc > 0 && argv[0]) {
        unlink(argv[0]);
    }
    return 0;
}
