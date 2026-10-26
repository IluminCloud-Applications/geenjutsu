import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WORKSPACE_DIR = path.resolve(ROOT_DIR, '..');
const OVERLAY_DIR = path.join(ROOT_DIR, 'build', 'overlay');
const INSPECT_DIR = '/tmp/redroid-inspect';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Replace fixed-length ASCII strings in a binary buffer without altering offsets or code.
 */
function replaceFixedAscii(buf, replacements) {
  const out = Buffer.from(buf);
  for (const [fromStr, toStr] of replacements) {
    if (fromStr.length !== toStr.length) {
      throw new Error(`Length mismatch: "${fromStr}" (${fromStr.length}) vs "${toStr}" (${toStr.length})`);
    }
    const needle = Buffer.from(fromStr, 'ascii');
    const repl = Buffer.from(toStr, 'ascii');
    let idx = 0;
    while ((idx = out.indexOf(needle, idx)) !== -1) {
      repl.copy(out, idx);
      idx += repl.length;
    }
  }
  return out;
}

/**
 * Patch null-terminated C string in a buffer where replacement is shorter or equal in length.
 */
function replaceNullPaddedAscii(buf, fromStr, toStr) {
  if (toStr.length > fromStr.length) {
    throw new Error(`Replacement "${toStr}" is longer than "${fromStr}"`);
  }
  const out = Buffer.from(buf);
  const needle = Buffer.from(fromStr, 'ascii');
  const repl = Buffer.alloc(fromStr.length, 0);
  Buffer.from(toStr, 'ascii').copy(repl, 0);

  let idx = 0;
  while ((idx = out.indexOf(needle, idx)) !== -1) {
    repl.copy(out, idx);
    idx += repl.length;
  }
  return out;
}

function writeOverlayFile(relPath, content, mode = 0o644) {
  const fullPath = path.join(OVERLAY_DIR, relPath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content);
  fs.chmodSync(fullPath, mode);
}

function generatePartitionBuildProps() {
  console.log('[1/6] Generating partition build.prop configurations (Samsung Galaxy S22 5G SM-S901B)...');

  const commonFingerprint = 'samsung/r0sxxx/r0s:12/SP1A.210812.016/S901BXXU2AVF1:user/release-keys';
  const buildDesc = 'r0sxxx-user 12 SP1A.210812.016 S901BXXU2AVF1 release-keys';

  // 1. /system/build.prop
  let sysProp = fs.readFileSync(path.join(INSPECT_DIR, 'system-build.prop'), 'utf8');
  const sysOverrides = new Map([
    ['ro.build.id', 'SP1A.210812.016'],
    ['ro.build.display.id', 'SP1A.210812.016.S901BXXU2AVF1'],
    ['ro.build.version.incremental', 'S901BXXU2AVF1'],
    ['ro.build.version.security_patch', '2022-06-01'],
    ['ro.build.date', 'Fri Jun 10 18:15:32 KST 2022'],
    ['ro.build.date.utc', '1654852532'],
    ['ro.build.type', 'user'],
    ['ro.build.user', 'dpi'],
    ['ro.build.host', 'SWDD6518'],
    ['ro.build.tags', 'release-keys'],
    ['ro.build.flavor', 'r0sxxx-user'],
    ['ro.build.description', buildDesc],
    ['ro.build.product', 'r0s'],
    ['ro.build.Characteristics', 'default'],
    ['ro.build.characteristics', 'default'],
    ['ro.system.build.date', 'Fri Jun 10 18:15:32 KST 2022'],
    ['ro.system.build.date.utc', '1654852532'],
    ['ro.system.build.fingerprint', commonFingerprint],
    ['ro.system.build.id', 'SP1A.210812.016'],
    ['ro.system.build.tags', 'release-keys'],
    ['ro.system.build.type', 'user'],
    ['ro.system.build.version.incremental', 'S901BXXU2AVF1'],
    ['ro.product.system.brand', 'samsung'],
    ['ro.product.system.device', 'r0s'],
    ['ro.product.system.manufacturer', 'samsung'],
    ['ro.product.system.model', 'SM-S901B'],
    ['ro.product.system.name', 'r0sxxx'],
    ['ro.product.brand', 'samsung'],
    ['ro.product.device', 'r0s'],
    ['ro.product.manufacturer', 'samsung'],
    ['ro.product.model', 'SM-S901B'],
    ['ro.product.name', 'r0sxxx'],
    ['ro.product.board', 's5e9925'],
    ['ro.board.platform', 'exynos2200'],
    ['ro.hardware', 'exynos2200'],
    ['ro.sf.lcd_density', '420'],
    ['ro.opengles.version', '196610'],
    ['ro.product.cpu.abi', 'x86_64'],
    ['ro.system.product.cpu.abilist', 'x86_64,x86,arm64-v8a,armeabi-v7a,armeabi'],
    ['ro.system.product.cpu.abilist64', 'x86_64,arm64-v8a'],
    ['ro.system.product.cpu.abilist32', 'x86,armeabi-v7a,armeabi'],
    ['ro.dalvik.vm.native.bridge', 'libnb.so'],
    ['ro.enable.native.bridge.exec', '1'],
    ['ro.dalvik.vm.isa.arm64', 'x86_64'],
    ['ro.dalvik.vm.isa.arm', 'x86'],
    ['ro.zygote', 'zygote64_32'],
    ['ro.debuggable', '1'],
    ['ro.secure', '1'],
    ['ro.adb.secure', '0'],
    ['service.adb.tcp.port', '5555'],
    ['ro.build.selinux', '1'],
  ]);

  const seenKeys = new Set();
  const sysLines = sysProp.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq);
    if (sysOverrides.has(key)) {
      seenKeys.add(key);
      return `${key}=${sysOverrides.get(key)}`;
    }
    return line;
  });

  for (const [k, v] of sysOverrides.entries()) {
    if (!seenKeys.has(k)) {
      sysLines.push(`${k}=${v}`);
    }
  }
  writeOverlayFile('system/build.prop', sysLines.join('\n') + '\n', 0o600);

  // 2. /vendor/build.prop
  const vendorProp = [
    '# begin build properties',
    'ro.vendor.build.date=Fri Jun 10 18:15:32 KST 2022',
    'ro.vendor.build.date.utc=1654852532',
    `ro.vendor.build.fingerprint=${commonFingerprint}`,
    'ro.vendor.build.id=SP1A.210812.016',
    'ro.vendor.build.tags=release-keys',
    'ro.vendor.build.type=user',
    'ro.vendor.build.version.incremental=S901BXXU2AVF1',
    'ro.vendor.build.version.release=12',
    'ro.vendor.build.version.release_or_codename=12',
    'ro.vendor.build.version.sdk=31',
    'ro.vndk.version=31',
    'ro.bionic.arch=arm64',
    'ro.bionic.2nd_arch=arm',
    'persist.sys.dalvik.vm.lib.2=libart.so',
    'ro.cold_boot_done=true',
    'persist.sys.fuse=1',
    'external_storage.projid.enabled=1',
    'external_storage.casefold.enabled=1',
    'external_storage.sdcardfs.enabled=0',
    'ro.product.vendor.brand=samsung',
    'ro.product.vendor.device=r0s',
    'ro.product.vendor.manufacturer=samsung',
    'ro.product.vendor.model=SM-S901B',
    'ro.product.vendor.name=r0sxxx',
    'ro.zygote=zygote64_32',
    'ro.vendor.product.cpu.abilist=x86_64,x86,arm64-v8a,armeabi-v7a,armeabi',
    'ro.vendor.product.cpu.abilist64=x86_64,arm64-v8a',
    'ro.vendor.product.cpu.abilist32=x86,armeabi-v7a,armeabi',
    'ro.board.platform=exynos2200',
    'ro.product.board=s5e9925',
    'ro.hardware=exynos2200',
    'ro.opengles.version=196610',
    'ro.sf.lcd_density=420',
    'ro.dalvik.vm.native.bridge=libnb.so',
    'ro.enable.native.bridge.exec=1',
    'ro.dalvik.vm.isa.arm64=x86_64',
    'ro.dalvik.vm.isa.arm=x86',
    'ro.carrier=unknown',
    'ro.config.ringtone=Over_the_Horizon.ogg',
    'ro.config.notification_sound=Spaceline.ogg',
    'ro.config.alarm_alert=Homecoming.ogg',
    'ro.boot.verifiedbootstate=green',
    'ro.boot.flash.locked=1',
    'ro.boot.vbmeta.device_state=locked',
    'ro.boot.warranty_bit=0',
    'ro.warranty_bit=0',
    'ro.FRP.pst=/dev/block/by-name/steady',
    'drm.service.enabled=true',
    'dalvik.vm.heapstartsize=8m',
    'dalvik.vm.heapgrowthlimit=256m',
    'dalvik.vm.heapsize=512m',
    'dalvik.vm.heaptargetutilization=0.75',
    'dalvik.vm.heapminfree=512k',
    'dalvik.vm.heapmaxfree=8m',
    '',
  ].join('\n');
  writeOverlayFile('vendor/build.prop', vendorProp, 0o600);

  // 3. /product/etc/build.prop
  const productProp = [
    '# begin common build properties',
    'ro.product.build.date=Fri Jun 10 18:15:32 KST 2022',
    'ro.product.build.date.utc=1654852532',
    `ro.product.build.fingerprint=${commonFingerprint}`,
    'ro.product.build.id=SP1A.210812.016',
    'ro.product.build.tags=release-keys',
    'ro.product.build.type=user',
    'ro.product.build.version.incremental=S901BXXU2AVF1',
    'ro.product.build.version.release=12',
    'ro.product.build.version.release_or_codename=12',
    'ro.product.build.version.sdk=31',
    'ro.product.product.brand=samsung',
    'ro.product.product.device=r0s',
    'ro.product.product.manufacturer=samsung',
    'ro.product.product.model=SM-S901B',
    'ro.product.product.name=r0sxxx',
    'ro.product.vndk.version=31',
    '',
  ].join('\n');
  writeOverlayFile('system/product/etc/build.prop', productProp, 0o600);

  // 4. /system/system_ext/etc/build.prop
  const sysExtProp = [
    '# begin common build properties',
    'ro.system_ext.build.date=Fri Jun 10 18:15:32 KST 2022',
    'ro.system_ext.build.date.utc=1654852532',
    `ro.system_ext.build.fingerprint=${commonFingerprint}`,
    'ro.system_ext.build.id=SP1A.210812.016',
    'ro.system_ext.build.tags=release-keys',
    'ro.system_ext.build.type=user',
    'ro.system_ext.build.version.incremental=S901BXXU2AVF1',
    'ro.system_ext.build.version.release=12',
    'ro.system_ext.build.version.release_or_codename=12',
    'ro.system_ext.build.version.sdk=31',
    'ro.product.system_ext.brand=samsung',
    'ro.product.system_ext.device=r0s',
    'ro.product.system_ext.manufacturer=samsung',
    'ro.product.system_ext.model=SM-S901B',
    'ro.product.system_ext.name=r0sxxx',
    'ro.control_privapp_permissions=disable',
    '',
  ].join('\n');
  writeOverlayFile('system/system_ext/etc/build.prop', sysExtProp, 0o600);

  // 5. /vendor/odm/etc/build.prop
  const odmProp = [
    '# begin common build properties',
    'ro.odm.build.date=Fri Jun 10 18:15:32 KST 2022',
    'ro.odm.build.date.utc=1654852532',
    `ro.odm.build.fingerprint=${commonFingerprint}`,
    'ro.odm.build.id=SP1A.210812.016',
    'ro.odm.build.tags=release-keys',
    'ro.odm.build.type=user',
    'ro.odm.build.version.incremental=S901BXXU2AVF1',
    'ro.odm.build.version.release=12',
    'ro.odm.build.version.release_or_codename=12',
    'ro.odm.build.version.sdk=31',
    'ro.product.odm.brand=samsung',
    'ro.product.odm.device=r0s',
    'ro.product.odm.manufacturer=samsung',
    'ro.product.odm.model=SM-S901B',
    'ro.product.odm.name=r0sxxx',
    'ro.odm.product.cpu.abilist=x86_64,x86,arm64-v8a,armeabi-v7a,armeabi',
    'ro.odm.product.cpu.abilist64=x86_64,arm64-v8a',
    'ro.odm.product.cpu.abilist32=x86,armeabi-v7a,armeabi',
    '',
  ].join('\n');
  writeOverlayFile('vendor/odm/etc/build.prop', odmProp, 0o600);

  // 6. /vendor_dlkm/etc/build.prop
  const dlkmProp = [
    '# begin common build properties',
    'ro.vendor_dlkm.build.date=Fri Jun 10 18:15:32 KST 2022',
    'ro.vendor_dlkm.build.date.utc=1654852532',
    `ro.vendor_dlkm.build.fingerprint=${commonFingerprint}`,
    'ro.vendor_dlkm.build.id=SP1A.210812.016',
    'ro.vendor_dlkm.build.tags=release-keys',
    'ro.vendor_dlkm.build.type=user',
    'ro.vendor_dlkm.build.version.incremental=S901BXXU2AVF1',
    'ro.vendor_dlkm.build.version.release=12',
    'ro.vendor_dlkm.build.version.release_or_codename=12',
    'ro.vendor_dlkm.build.version.sdk=31',
    'ro.product.vendor_dlkm.brand=samsung',
    'ro.product.vendor_dlkm.device=r0s',
    'ro.product.vendor_dlkm.manufacturer=samsung',
    'ro.product.vendor_dlkm.model=SM-S901B',
    'ro.product.vendor_dlkm.name=r0sxxx',
    '',
  ].join('\n');
  writeOverlayFile('vendor/vendor_dlkm/etc/build.prop', dlkmProp, 0o600);
}

function generateInitAndVendorConfigs() {
  console.log('[2/6] Generating vendor init scripts, codecs, and GPU configuration...');

  const initExynosRc = [
    'on early-init',
    '    mount debugfs debugfs /sys/kernel/debug mode=755',
    '    chmod 0666 /dev/null',
    '    chmod 0666 /dev/zero',
    '    chmod 0666 /dev/full',
    '    chmod 0666 /dev/ptmx',
    '    chmod 0666 /dev/pts/ptmx',
    '    chmod 0666 /dev/tty',
    '    chmod 0666 /dev/random',
    '    chmod 0666 /dev/urandom',
    '    chmod 0666 /dev/ashmem',
    '    chmod 0666 /dev/ion',
    '    chmod 0666 /dev/binder',
    '    chmod 0666 /dev/hwbinder',
    '    chmod 0666 /dev/vndbinder',
    '    chmod 0666 /dev/dri/renderD128',
    '    chmod 0666 /dev/dri/card0',
    '    chmod 0444 /dev/dma_heap/system',
    '    chown system system /dev/dma_heap/system',
    '    mkdir /ipc 0777',
    '    exec -- /bin/rm -rf /dev/input',
    '    mkdir /dev/input',
    '    setprop debug.stagefright.ccodec 0',
    '    setprop log.tag.libprocessgroup F',
    '    setprop ro.opengles.version 196610',
    '',
    'on init',
    '    write /data/.empty 0',
    '    mount none /data/.empty /proc/vmallocinfo bind',
    '    mount none /data/.empty /sys/power/state bind',
    '    setprop debug.renderengine.backend gles',
    '    setprop ro.sf.lcd_density 420',
    '    setprop service.adb.tcp.port 5555',
    '',
    'on post-fs-data',
    '    setprop sys.use_memfd 1',
    '    rm /data/misc/apexdata/com.android.tethering/misc/ethernet/ipconfig.txt',
    '    exec - system system -- /vendor/bin/ipconfigstore',
    '    exec - root root -- /vendor/bin/device_init early',
    '    trigger nonencrypted',
    '',
    'on early-boot',
    '    exec -- /vendor/bin/gpu_config.sh',
    '    chown system system /dev/input/event0',
    '    chown system system /dev/input/event1',
    '    chown system system /dev/input/event2',
    '',
    'on boot',
    '    setprop ServiceManager.wait_for_hwservicemanager false',
    '',
    'on property:sys.boot_completed=1',
    '    start vendor.device_profile',
    '',
    'service vendor.device_profile /vendor/bin/device_init boot',
    '    user root',
    '    group root system inet net_raw net_admin',
    '    oneshot',
    '    disabled',
    '    seclabel u:r:su:s0',
    '',
    'service vendor.uinputd /vendor/bin/uinputd',
    '    class core',
    '    user root',
    '    group root system input',
    '    seclabel u:r:su:s0',
    '',
  ].join('\n');
  writeOverlayFile('vendor/etc/init/init.exynos2200.rc', initExynosRc, 0o644);
  writeOverlayFile('vendor/etc/init/hw/init.exynos2200.rc', initExynosRc, 0o644);

  const adbKeyPub = path.join(process.env.HOME || '/home/celio', '.android/adbkey.pub');
  if (fs.existsSync(adbKeyPub)) {
    writeOverlayFile('data/misc/adb/adb_keys', fs.readFileSync(adbKeyPub), 0o640);
  }

  const gpuConfigSh = [
    '#!/system/bin/sh',
    '',
    'setup_vulkan() {',
    '    setprop ro.hardware.vulkan exynos2200',
    '}',
    '',
    'setup_render_node() {',
    '    node=$(getprop ro.boot.redroid_gpu_node)',
    '    if [ -n "$node" ] && [ -e "$node" ]; then',
    '        setprop sys.gpu.drm.device "$node"',
    '        chmod 666 "$node"',
    '        setup_vulkan',
    '        return 0',
    '    fi',
    '    if [ -d /sys/kernel/debug/dri ]; then',
    '        cd /sys/kernel/debug/dri || true',
    '        for d in * ; do',
    '            if [ "$d" -ge "128" ] 2>/dev/null; then',
    '                driver="$(cut -d" " -f1 "$d/name" 2>/dev/null)"',
    '                setup_vulkan',
    '                case $driver in',
    '                    i915|amdgpu|nouveau|virtio_gpu|v3d|vc4|msm_drm|panfrost)',
    '                        node="/dev/dri/renderD$d"',
    '                        setprop sys.gpu.drm.device "$node"',
    '                        chmod 666 "$node"',
    '                        return 0',
    '                        ;;',
    '                esac',
    '            fi',
    '        done',
    '    fi',
    '    if [ -e /dev/dri/renderD128 ]; then',
    '        setprop sys.gpu.drm.device "/dev/dri/renderD128"',
    '        chmod 666 "/dev/dri/renderD128"',
    '        setprop ro.hardware.vulkan exynos2200',
    '        return 0',
    '    fi',
    '    return 1',
    '}',
    '',
    'gpu_setup_host() {',
    '    setprop ro.hardware.egl mali',
    '    setprop ro.hardware.gralloc exynos2200',
    '    setprop ro.hardware.vulkan exynos2200',
    '}',
    '',
    'gpu_setup() {',
    '    setup_render_node',
    '    gpu_setup_host',
    '}',
    '',
    'gpu_setup',
  ].join('\n');
  writeOverlayFile('vendor/bin/gpu_config.sh', gpuConfigSh, 0o755);

  // Keep adbd running even when sys.usb.config=none (adb_enabled=0)
  for (const usbRc of ['init.usb.rc', 'init.usb.configfs.rc']) {
    const usbRcPath = path.join(INSPECT_DIR, 'system-init/hw', usbRc);
    if (fs.existsSync(usbRcPath)) {
      let rcContent = fs.readFileSync(usbRcPath, 'utf8');
      rcContent = rcContent.replace(/^\s*stop adbd\s*$/gm, '    start adbd');
      writeOverlayFile(`system/etc/init/hw/${usbRc}`, rcContent, 0o644);
    }
  }

  // Media codecs XML without "redroid"
  let codecsXml = fs.readFileSync(path.join(INSPECT_DIR, 'vendor/etc/media_codecs.xml'), 'utf8');
  codecsXml = codecsXml.replace(/redroid/g, 'samsung').replace(/Redroid/g, 'Samsung');
  writeOverlayFile('vendor/etc/media_codecs.xml', codecsXml, 0o644);

  // AMD GPU IDs table mapped to Samsung Xclipse 920
  let amdIds = fs.readFileSync(path.join(INSPECT_DIR, 'vendor/etc/hwdata/amdgpu.ids.redroid'), 'utf8');
  amdIds = amdIds
    .replace(/AMD Radeon [^\n]+/g, 'Samsung Xclipse 920')
    .replace(/Radeon [^\n]+/g, 'Samsung Xclipse 920');
  if (!amdIds.includes('73FF')) {
    amdIds += '\n73FF,\t00,\tSamsung Xclipse 920\n';
  }
  writeOverlayFile('vendor/etc/hwdata/amdgpu.ids.samsung', amdIds, 0o644);
}

function buildFlatSection(cFile, ldScript, defsyms) {
  const objOut = `/tmp/${path.basename(cFile, '.c')}.o`;
  const binOut = `/tmp/${path.basename(cFile, '.c')}.bin`;
  const ldPath = `/tmp/${path.basename(cFile, '.c')}.ld`;
  fs.writeFileSync(ldPath, ldScript);

  execFileSync('gcc', [
    '-c', '-fPIC', '-Os', '-fno-stack-protector', '-fno-builtin', '-fno-asynchronous-unwind-tables',
    path.join(ROOT_DIR, cFile),
    '-o', objOut,
  ], { stdio: 'inherit' });

  const ldArgs = ['-T', ldPath, ...defsyms.map(([k, v]) => `--defsym=${k}=${v}`), '--oformat=binary', objOut, '-o', binOut];
  execFileSync('ld', ldArgs, { stdio: 'inherit' });
  return fs.readFileSync(binOut);
}

function prepareVendorHalModules() {
  console.log('[3/6] Preparing vendor HAL modules (hwcomposer, gralloc, egl, vulkan, sensors, ndk_translation)...');

  // 1. hwcomposer (64-bit & 32-bit) with default 1080x1920 FHD resolution
  for (const libDir of ['lib64', 'lib']) {
    let src = Buffer.from(fs.readFileSync(path.join(INSPECT_DIR, `vendor/${libDir}/hw/hwcomposer.redroid.so`)));
    if (libDir === 'lib64') {
      const p1 = Buffer.from([0xbe, 0xd0, 0x02, 0x00, 0x00]);
      const r1 = Buffer.from([0xbe, 0x38, 0x04, 0x00, 0x00]);
      const p2 = Buffer.from([0xbe, 0x00, 0x05, 0x00, 0x00]);
      const r2 = Buffer.from([0xbe, 0x80, 0x07, 0x00, 0x00]);
      const i1 = src.indexOf(p1);
      if (i1 !== -1) r1.copy(src, i1);
      const i2 = src.indexOf(p2);
      if (i2 !== -1) r2.copy(src, i2);
    }
    writeOverlayFile(`vendor/${libDir}/hw/hwcomposer.exynos2200.so`, src, 0o644);
    writeOverlayFile(`vendor/${libDir}/hw/hwcomposer.default.so`, src, 0o644);
  }

  // 2. gralloc (64-bit & 32-bit) - rename property gralloc.gbm.device -> sys.gpu.drm.device
  for (const libDir of ['lib64', 'lib']) {
    let srcPath = path.join(INSPECT_DIR, `vendor/${libDir}/hw/gralloc.gbm.so`);
    if (!fs.existsSync(srcPath)) {
      srcPath = path.join(INSPECT_DIR, `vendor/${libDir}/hw/gralloc.redroid.so`);
    }
    if (fs.existsSync(srcPath)) {
      let src = fs.readFileSync(srcPath);
      src = replaceFixedAscii(src, [
        ['gralloc.gbm.device', 'sys.gpu.drm.device'],
        ['gralloc.gbm.so', 'gralloc.exy.so'],
      ]);
      writeOverlayFile(`vendor/${libDir}/hw/gralloc.exynos2200.so`, src, 0o644);
      writeOverlayFile(`vendor/${libDir}/hw/gralloc.default.so`, src, 0o644);
    }
  }

  // 3. EGL & GLES libraries under ro.hardware.egl=mali
  for (const libDir of ['lib64', 'lib']) {
    const eglMap = [
      ['libEGL_mesa.so', 'libEGL_mali.so', 'libEGL_mesa.so.1', 'libEGL_mali.so.1'],
      ['libGLESv1_CM_mesa.so', 'libGLESv1_CM_mali.so', 'libGLESv1_CM_mesa.so.1', 'libGLESv1_CM_mali.so.1'],
      ['libGLESv2_mesa.so', 'libGLESv2_mali.so', 'libGLESv2_mesa.so.2', 'libGLESv2_mali.so.2'],
    ];
    for (const [srcName, dstName, oldSo, newSo] of eglMap) {
      const p = path.join(INSPECT_DIR, `vendor/${libDir}/egl/${srcName}`);
      if (fs.existsSync(p)) {
        const b = replaceFixedAscii(fs.readFileSync(p), [[oldSo, newSo]]);
        writeOverlayFile(`vendor/${libDir}/egl/${dstName}`, b, 0o644);
        writeOverlayFile(`vendor/${libDir}/egl/${srcName}`, b, 0o644);
      }
    }
  }

  // 4. Patch libgallium_dri.so so GL_VENDOR is "Samsung", GL_RENDERER is "Samsung Xclipse 920", and desktop extensions are replaced
  for (const libDir of ['lib64', 'lib']) {
    const driPath = path.join(INSPECT_DIR, `vendor/${libDir}/dri/libgallium_dri.so`);
    if (fs.existsSync(driPath)) {
      let driBuf = fs.readFileSync(driPath);
      driBuf = replaceNullPaddedAscii(
        driBuf,
        '%s%u.%u%s Mesa 24.0.8 (git-441f064c1c)',
        '%s%u.%u%s v1.r38p1-01eac0'
      );
      driBuf = replaceNullPaddedAscii(driBuf, '%s (radeonsi, %s%s, DRM %i.%i%s)', '%s');
      driBuf = replaceNullPaddedAscii(driBuf, 'Mesa/X.org', 'Samsung');
      driBuf = replaceNullPaddedAscii(driBuf, 'VMware, Inc.', 'Samsung');
      driBuf = replaceNullPaddedAscii(driBuf, 'llvmpipe (LLVM 17.0.6, %u bits)', 'Samsung Xclipse 920');
      driBuf = replaceFixedAscii(driBuf, [
        ['AMD HEMLOCK\0AMD\0', 'AMD\0\0\0\0\0Samsung\0'],
      ]);

      // Shift the 3 vendor string relative displacements by -4 bytes to point to "Samsung\0"
      if (libDir === 'lib64') {
        for (const off of [0x13b47f3, 0x1642673, 0x1642683]) {
          driBuf.writeInt32LE(driBuf.readInt32LE(off) - 4, off);
        }
      } else {
        for (const off of [0x13181f4, 0x15ed744, 0x15ed764]) {
          driBuf.writeInt32LE(driBuf.readInt32LE(off) - 4, off);
        }
      }

      // Replace desktop GL_MESA_*, GL_INTEL_*, GL_AMD_* extensions with mobile extensions
      const extReplacements = [
        ['GL_MESA_framebuffer_flip_y', 'GL_ARM_shader_core_props'],
        ['GL_MESA_shader_integer_functions', 'GL_ARM_shader_framebuffer_fetch'],
        ['GL_MESA_sampler_objects', 'GL_OES_EGL_image_base'],
        ['GL_MESA_bgra', 'GL_ARM_rgba8'],
        ['GL_MESA_texture_const_bandwidth', 'GL_ARM_mali_program_binary'],
        ['GL_MESA_pack_invert', 'GL_EXT_YUV_target'],
        ['GL_MESA_window_pos', 'GL_EXT_sRGB'],
        ['GL_MESA_ycbcr_texture', 'GL_OVR_multiview2'],
        ['GL_INTEL_blackhole_render', 'GL_EXT_protected_textures'],
        ['GL_INTEL_performance_query', 'GL_EXT_sparse_texture2'],
        ['GL_INTEL_conservative_rasterization', 'GL_EXT_shader_framebuffer_fetch'],
        ['GL_INTEL_shader_atomic_float_minmax', 'GL_EXT_multisampled_render_to_tex'],
        ['GL_INTEL_shader_integer_functions2', 'GL_KHR_blend_equation_advanced'],
        ['GL_AMD_performance_monitor', 'GL_EXT_buffer_storage'],
        ['GL_AMD_framebuffer_multisample_advanced', 'GL_EXT_copy_image'],
        ['GL_AMD_pinned_memory', 'GL_EXT_float_blend'],
        ['GL_AMD_seamless_cubemap_per_texture', 'GL_EXT_pvrtc_sRGB'],
        ['GL_AMD_shader_stencil_export', 'GL_EXT_clip_control'],
        ['GL_AMD_shader_trinary_minmax', 'GL_EXT_color_buffer_float'],
        ['GL_AMD_texture_texture4', 'GL_EXT_clear_texture'],
        ['GL_AMD_vertex_shader_layer', 'GL_EXT_gpu_shader5'],
        ['GL_AMD_vertex_shader_viewport_index', 'GL_EXT_primitive_bounding_box'],
        ['GL_AMD_conservative_depth', 'GL_EXT_tessellation_point'],
        ['GL_AMD_depth_clamp_separate', 'GL_EXT_texture_border_clamp'],
        ['GL_AMD_draw_buffers_blend', 'GL_EXT_texture_buffer'],
        ['GL_AMD_multi_draw_indirect', 'GL_EXT_texture_rg'],
      ];
      for (const [fromExt, toExt] of extReplacements) {
        driBuf = replaceNullPaddedAscii(driBuf, fromExt, toExt);
      }

      writeOverlayFile(`vendor/${libDir}/dri/libgallium_dri.so`, driBuf, 0o644);
    }
  }

  // 5. Patch libdrm_amdgpu.so.1 to reference amdgpu.ids.samsung
  for (const libDir of ['lib64', 'lib']) {
    const drmPath = path.join(INSPECT_DIR, `vendor/${libDir}/libdrm_amdgpu.so.1`);
    if (fs.existsSync(drmPath)) {
      const drmBuf = replaceFixedAscii(fs.readFileSync(drmPath), [
        ['/vendor/etc/hwdata/amdgpu.ids.redroid', '/vendor/etc/hwdata/amdgpu.ids.samsung'],
      ]);
      writeOverlayFile(`vendor/${libDir}/libdrm_amdgpu.so.1`, drmBuf, 0o644);
    }
  }

  // 6. Vulkan HAL module (vulkan.exynos2200.so)
  for (const libDir of ['lib64', 'lib']) {
    const vkPath = path.join(INSPECT_DIR, `vendor/${libDir}/hw/vulkan.radeon.so`);
    if (fs.existsSync(vkPath)) {
      let vkBuf = fs.readFileSync(vkPath);
      vkBuf = replaceFixedAscii(vkBuf, [
        ['AMD RADV %s%s', 'Xclipse  %s%s'],
        ['%s (RADV %s%s)', '%s (XCLP %s%s)'],
      ]);
      writeOverlayFile(`vendor/${libDir}/hw/vulkan.exynos2200.so`, vkBuf, 0o644);
      writeOverlayFile(`vendor/${libDir}/hw/vulkan.default.so`, vkBuf, 0o644);
    }
  }

  // 7. Patch libjavacore.so (64-bit & 32-bit) so Os.uname() and System.getProperty("os.arch") return aarch64
  const relStr = '5.10.136-android12-9-24750181-abS901BXXU2AVF1';
  const verMachStr = '#1 SMP PREEMPT Fri Jun 10 18:22:14 KST 2022\0aarch64';

  const jc64Path = path.join(INSPECT_DIR, 'libjavacore64.so');
  if (fs.existsSync(jc64Path)) {
    let jc64 = fs.readFileSync(jc64Path);
    jc64 = replaceNullPaddedAscii(jc64, 'libcore/luni/src/main/native/libcore_io_Linux.cpp', relStr);
    jc64 = replaceNullPaddedAscii(jc64, 'getsockoptTimeval() unsupported with level %i and option %i', verMachStr);

    const patches64 = [
      [0x2e9b8, 0x2f9b8, 0xa333],
      [0x2e9d9, 0x2f9d9, 0x9620],
      [0x2e9f6, 0x2f9f6, 0x964c],
    ];
    for (const [fileOff, va, targetVa] of patches64) {
      jc64[fileOff + 2] = 0x35;
      jc64.writeInt32LE(targetVa - (va + 7), fileOff + 3);
      jc64[fileOff + 7] = 0x90;
    }
    writeOverlayFile('system/apex/com.android.art/lib64/libjavacore.so', jc64, 0o644);
  }

  const jc32Path = path.join(INSPECT_DIR, 'libjavacore32.so');
  if (fs.existsSync(jc32Path)) {
    let jc32 = fs.readFileSync(jc32Path);
    jc32 = replaceNullPaddedAscii(jc32, 'libcore/luni/src/main/native/libcore_io_Linux.cpp', relStr);
    jc32 = replaceNullPaddedAscii(jc32, 'getsockoptTimeval() unsupported with level %i and option %i', verMachStr);

    const ebxVal = 0x38414;
    const patches32 = [
      [0x2b128, 0x8433],
      [0x2b14b, 0x7720],
      [0x2b16a, 0x774c],
    ];
    for (const [fileOff, targetVa] of patches32) {
      jc32[fileOff + 1] = 0x83;
      jc32.writeInt32LE(targetVa - ebxVal, fileOff + 2);
      jc32[fileOff + 6] = 0x90;
    }
    writeOverlayFile('system/apex/com.android.art/lib/libjavacore.so', jc32, 0o644);
  }

  // 8. Patch libndk_translation.so (PR_SET_SECCOMP compatibility + guest ARM64 uname)
  const ndkPath = path.join(INSPECT_DIR, 'libndk_translation64.so');
  if (fs.existsSync(ndkPath)) {
    let ndkBuf = Buffer.from(fs.readFileSync(ndkPath));
    const combinedUts = Buffer.alloc(114, 0);
    Buffer.from(relStr + '\0', 'ascii').copy(combinedUts, 0);
    Buffer.from('#1 SMP PREEMPT Fri Jun 10 18:22:14 KST 2022\0', 'ascii').copy(combinedUts, 46);
    Buffer.from('aarch64\0', 'ascii').copy(combinedUts, 90);
    combinedUts.copy(ndkBuf, 0x6d882);

    const ndkBlob = buildFlatSection(
      'src/ndk_stubs.c',
      'SECTIONS {\n  . = 0x212670;\n  .text.prctl : { *(.text.prctl) }\n  . = 0x212688;\n  .text.uname : { *(.text.uname) *(.text*) }\n}\n',
      [
        ['prctl_plt', '0x227150'],
        ['syscall_plt', '0x223450'],
        ['str_rel', '0x6d882'],
        ['str_ver', '0x6d8b0'],
        ['str_mach', '0x6d8dc'],
      ]
    );
    ndkBlob.copy(ndkBuf, 0x211670);
    // Redirect 0x211bcb (file offset 0x210bcb) tail-call to UnameForGuest (VA 0x212688)
    ndkBuf.writeInt32LE(0x212688 - (0x211bcb + 5), 0x210bcb + 1);
    writeOverlayFile('system/lib64/libndk_translation.so', ndkBuf, 0o644);
  }

  // 9. Patch libsensorservice.so with Samsung S22 Exynos 2200 hardware sensors & 50Hz polling
  const sensorPath = path.join(INSPECT_DIR, 'libsensorservice64.so');
  if (fs.existsSync(sensorPath)) {
    const sensorBuf = Buffer.from(fs.readFileSync(sensorPath));
    const sensorBlob = buildFlatSection(
      'src/sensor_stubs.c',
      'SECTIONS {\n  . = 0x1b9a0;\n  .text.init : { *(.text.init) }\n  . = 0x1bd40;\n  .text.poll : { *(.text.poll) }\n  .rodata : { *(.rodata*) }\n}\n',
      [
        ['alloc_mem', '0x3eee0'],
        ['sleep_ns', '0x3f180'],
        ['elapsed_ns', '0x3f330'],
      ]
    );
    sensorBlob.copy(sensorBuf, 0x1a9a0);

    // Redirect SensorDevice::poll (VA 0x1e160, file offset 0x1d160) to sensor_poll_bridge (VA 0x1bd40)
    sensorBuf[0x1d160] = 0xe9;
    sensorBuf.writeInt32LE(0x1bd40 - (0x1e160 + 5), 0x1d161);

    // SensorDevice::initCheck (VA 0x1e150) and HAL control methods return 0 (OK)
    const zeroReturnVas = [
      0x1c5d0, 0x1d6d0, 0x1de80, 0x1e150, 0x1e1f0, 0x1e9c0, 0x1ec20,
      0x1ee90, 0x1eef0, 0x1ef70, 0x1f180, 0x1f200, 0x1f3c0, 0x1f590,
      0x1f700, 0x1fa90, 0x1fbf0, 0x1fe50, 0x20000, 0x200f0, 0x20160,
      0x202b0, 0x20340, 0x20450, 0x204c0,
    ];
    for (const va of zeroReturnVas) {
      const off = va - 0x1000;
      sensorBuf[off] = 0x31;
      sensorBuf[off + 1] = 0xc0;
      sensorBuf[off + 2] = 0xc3;
    }

    // isSensorActive (0x1f290, 0x1f9b0) -> return 1; getHalDeviceVersion (0x1f1f0) -> return 0x01040001
    for (const [va, retVal] of [[0x1f290, 1], [0x1f9b0, 1], [0x1f1f0, 0x01040001]]) {
      const off = va - 0x1000;
      sensorBuf[off] = 0xb8;
      sensorBuf.writeInt32LE(retVal, off + 1);
      sensorBuf[off + 5] = 0xc3;
    }

    writeOverlayFile('system/lib64/libsensorservice.so', sensorBuf, 0o644);
  }

  // 10. uinputd, libOmxCore.so, libstagefrighthw.so
  const uinputBuf = replaceFixedAscii(
    fs.readFileSync(path.join(INSPECT_DIR, 'vendor/bin/uinputd')),
    [
      ['ro.boot.redroid_width', 'ro.boot.display_width'],
      ['ro.boot.redroid_height', 'ro.boot.display_height'],
      ['redroid vinput', 'sec_touchinput'],
      ['redroid', 'samsung'],
    ]
  );
  writeOverlayFile('vendor/bin/uinputd', uinputBuf, 0o755);

  for (const omxLib of ['libOmxCore.so', 'libstagefrighthw.so']) {
    const p = path.join(INSPECT_DIR, `vendor/lib/${omxLib}`);
    if (fs.existsSync(p)) {
      const b = replaceFixedAscii(fs.readFileSync(p), [
        ['redroid', 'samsung'],
        ['Redroid', 'Samsung'],
      ]);
      writeOverlayFile(`vendor/lib/${omxLib}`, b, 0o644);
    }
  }

  // 11. Copy resetprop binary into /vendor/bin/resetprop
  const resetpropSrc = path.join(WORKSPACE_DIR, 'public/bin/resetprop');
  writeOverlayFile('vendor/bin/resetprop', fs.readFileSync(resetpropSrc), 0o755);
}

function compileSystemUtilities() {
  console.log('[4/6] Compiling static C system utilities (uname, device_init, secnetd, image_cleaner)...');

  ensureDir(path.join(OVERLAY_DIR, 'system/bin'));
  ensureDir(path.join(OVERLAY_DIR, 'vendor/bin'));

  execFileSync('gcc', [
    '-static', '-O2', '-Wall',
    path.join(ROOT_DIR, 'src/uname.c'),
    '-o', path.join(OVERLAY_DIR, 'system/bin/uname'),
  ], { stdio: 'inherit' });

  execFileSync('gcc', [
    '-static', '-O2', '-Wall',
    path.join(ROOT_DIR, 'src/device_init.c'),
    '-o', path.join(OVERLAY_DIR, 'vendor/bin/device_init'),
  ], { stdio: 'inherit' });

  execFileSync('gcc', [
    '-static', '-O2', '-Wall', '-pthread',
    path.join(ROOT_DIR, 'src/secnetd.c'),
    '-o', path.join(OVERLAY_DIR, 'vendor/bin/secnetd'),
  ], { stdio: 'inherit' });

  execFileSync('gcc', [
    '-static', '-O2', '-Wall',
    path.join(ROOT_DIR, 'src/image_cleaner.c'),
    '-o', path.join(OVERLAY_DIR, 'vendor/bin/image_cleaner'),
  ], { stdio: 'inherit' });
}

function embedDefaultApks() {
  console.log('[5/6] Embedding pre-installed APKs (Aurora Store, Via Browser)...');
  const auroraApk = path.join(WORKSPACE_DIR, 'public/aurora-store.apk');
  if (fs.existsSync(auroraApk)) {
    writeOverlayFile('system/app/AuroraStore/AuroraStore.apk', fs.readFileSync(auroraApk), 0o644);
  }
  const viaApk = path.join(WORKSPACE_DIR, 'public/via-browser.apk');
  if (fs.existsSync(viaApk)) {
    writeOverlayFile('system/app/ViaBrowser/ViaBrowser.apk', fs.readFileSync(viaApk), 0o644);
  }
}

function writeDockerfileAndBuild() {
  console.log('[6/6] Generating Dockerfile and building image geenjutsu/android12-camoufox:latest...');
  const dockerfile = [
    'FROM redroid/redroid:12.0.0-latest',
    'LABEL org.opencontainers.image.source=https://github.com/IluminCloud-Applications/geenjutsu',
    '',
    'COPY build/overlay/ /',
    'RUN ["/vendor/bin/image_cleaner"]',
    '',
    'ENTRYPOINT ["/init", "androidboot.hardware=exynos2200", "androidboot.verifiedbootstate=green", "androidboot.flash.locked=1", "androidboot.vbmeta.device_state=locked", "androidboot.mode=normal", "androidboot.boot_devices=13520000.ufs"]',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(ROOT_DIR, 'Dockerfile'), dockerfile);

  console.log('[6/6] Building Docker image geenjutsu/android12-camoufox:latest...');
  execSync('docker build -t geenjutsu/android12-camoufox:latest .', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
  console.log('Successfully built geenjutsu/android12-camoufox:latest!');
}

function ensureInspectFiles() {
  if (!fs.existsSync(path.join(INSPECT_DIR, 'system-build.prop')) ||
      !fs.existsSync(path.join(INSPECT_DIR, 'libndk_translation64.so'))) {
    console.log('[0/6] Extracting base files from redroid/redroid:12.0.0-latest to /tmp/redroid-inspect...');
    ensureDir(INSPECT_DIR);
    const cid = execSync('docker create redroid/redroid:12.0.0-latest').toString().trim();
    execSync(`docker cp ${cid}:/vendor ${INSPECT_DIR}/vendor`);
    execSync(`docker cp ${cid}:/system/build.prop ${INSPECT_DIR}/system-build.prop`);
    execSync(`docker cp ${cid}:/system/product/etc/build.prop ${INSPECT_DIR}/product-build.prop`);
    execSync(`docker cp ${cid}:/system/system_ext/etc/build.prop ${INSPECT_DIR}/system_ext-build.prop`);
    execSync(`docker cp ${cid}:/system/etc/init ${INSPECT_DIR}/system-init`);
    execSync(`docker cp ${cid}:/init.environ.rc ${INSPECT_DIR}/init.environ.rc`);
    execSync(`docker cp ${cid}:/system/lib64/libndk_translation.so ${INSPECT_DIR}/libndk_translation64.so`);
    execSync(`docker cp ${cid}:/system/lib64/libsensorservice.so ${INSPECT_DIR}/libsensorservice64.so`);
    execSync(`docker cp ${cid}:/system/apex/com.android.art/lib64/libjavacore.so ${INSPECT_DIR}/libjavacore64.so`);
    execSync(`docker cp ${cid}:/system/apex/com.android.art/lib/libjavacore.so ${INSPECT_DIR}/libjavacore32.so`);
    execSync(`docker rm ${cid}`);
  }
}

function main() {
  ensureInspectFiles();
  fs.rmSync(OVERLAY_DIR, { recursive: true, force: true });
  ensureDir(OVERLAY_DIR);

  generatePartitionBuildProps();
  generateInitAndVendorConfigs();
  prepareVendorHalModules();
  compileSystemUtilities();
  embedDefaultApks();
  writeDockerfileAndBuild();
}

main();
