#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <time.h>
#include <sys/stat.h>
#include <sys/mount.h>
#include <sys/wait.h>
#include <errno.h>

#define IDENTITY_FILE "/data/system/.device_identity.conf"
#define PROXY_FILE    "/data/system/.proxy.conf"
#define PROC_MASK_DIR "/data/system/.proc_mask"
#define RESETPROP_BIN "/vendor/bin/resetprop"

typedef struct {
    char serial_no[32];
    char android_id[32];
    char imei1[32];
    char imei2[32];
    char imsi[32];
    char iccid[32];
    char phone_num[32];
    char wifi_mac[32];
    char bt_mac[32];
    char wifi_bssid[32];
    char wifi_ssid[64];
    char boot_id[64];
    char cpu_serial[32];
    char timezone[64];
    char operator_mccmnc[16];
    char operator_name[32];
    char operator_country[8];
} device_identity_t;

static void seed_rng(void) {
    unsigned int seed = (unsigned int)time(NULL) ^ (unsigned int)getpid();
    int fd = open("/dev/urandom", O_RDONLY);
    if (fd >= 0) {
        if (read(fd, &seed, sizeof(seed)) != sizeof(seed)) {
            seed ^= 0x5a5a5a5a;
        }
        close(fd);
    }
    srand(seed);
}

static int rand_range(int min, int max) {
    return min + (rand() % (max - min + 1));
}

static void gen_hex(char *out, size_t len, int upper) {
    const char *chars = upper ? "0123456789ABCDEF" : "0123456789abcdef";
    for (size_t i = 0; i < len; i++) {
        out[i] = chars[rand() % 16];
    }
    out[len] = '\0';
}

static void gen_alnum_upper(char *out, size_t len) {
    const char *chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    size_t n = strlen(chars);
    for (size_t i = 0; i < len; i++) {
        out[i] = chars[rand() % n];
    }
    out[len] = '\0';
}

static void gen_digits(char *out, size_t len) {
    for (size_t i = 0; i < len; i++) {
        out[i] = '0' + (rand() % 10);
    }
    out[len] = '\0';
}

/* Compute Luhn check digit for a 14-digit IMEI prefix */
static void gen_luhn_imei(const char *tac8, char *out15) {
    char buf[16];
    memcpy(buf, tac8, 8);
    for (int i = 8; i < 14; i++) {
        buf[i] = '0' + (rand() % 10);
    }
    int sum = 0;
    for (int i = 0; i < 14; i++) {
        int d = buf[i] - '0';
        if (i % 2 == 1) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
    }
    int check = (10 - (sum % 10)) % 10;
    buf[14] = '0' + check;
    buf[15] = '\0';
    strcpy(out15, buf);
}

static void gen_mac(const char *oui, char *out) {
    snprintf(out, 32, "%s:%02x:%02x:%02x",
             oui, rand() % 256, rand() % 256, rand() % 256);
}

static void gen_uuid4(char *out) {
    snprintf(out, 64, "%04x%04x-%04x-4%03x-%04x-%04x%04x%04x",
             rand() & 0xffff, rand() & 0xffff,
             rand() & 0xffff,
             rand() & 0x0fff,
             0x8000 | (rand() & 0x3fff),
             rand() & 0xffff, rand() & 0xffff, rand() & 0xffff);
}

static void read_prop_cmd(const char *prop, char *out, size_t max_len) {
    out[0] = '\0';
    char cmd[256];
    snprintf(cmd, sizeof(cmd), "/system/bin/getprop %s 2>/dev/null", prop);
    FILE *fp = popen(cmd, "r");
    if (!fp) return;
    if (fgets(out, max_len, fp)) {
        size_t l = strlen(out);
        while (l > 0 && (out[l - 1] == '\n' || out[l - 1] == '\r')) {
            out[--l] = '\0';
        }
    }
    pclose(fp);
}

static void run_resetprop(const char *name, const char *value) {
    pid_t pid = fork();
    if (pid == 0) {
        execl(RESETPROP_BIN, "resetprop", "-n", name, value, (char *)NULL);
        _exit(1);
    } else if (pid > 0) {
        waitpid(pid, NULL, 0);
    }
}

static void delete_prop(const char *name) {
    pid_t pid = fork();
    if (pid == 0) {
        int devnull = open("/dev/null", O_WRONLY);
        if (devnull >= 0) {
            dup2(devnull, STDOUT_FILENO);
            dup2(devnull, STDERR_FILENO);
            close(devnull);
        }
        execl(RESETPROP_BIN, "resetprop", "--delete", name, (char *)NULL);
        _exit(1);
    } else if (pid > 0) {
        waitpid(pid, NULL, 0);
    }
}

static void generate_default_identity(device_identity_t *id) {
    seed_rng();
    char suffix[16];
    gen_alnum_upper(suffix, 7);
    snprintf(id->serial_no, sizeof(id->serial_no), "R5CT%s", suffix);

    gen_hex(id->android_id, 16, 0);
    /* Samsung Galaxy S22 5G SM-S901B TAC: 35407215 */
    gen_luhn_imei("35407215", id->imei1);
    gen_luhn_imei("35407215", id->imei2);

    char msin[16];
    gen_digits(msin, 10);
    snprintf(id->imsi, sizeof(id->imsi), "72410%s", msin);

    char icc_tail[16];
    gen_digits(icc_tail, 13);
    snprintf(id->iccid, sizeof(id->iccid), "895502%s", icc_tail);

    char ph_tail[16];
    gen_digits(ph_tail, 8);
    snprintf(id->phone_num, sizeof(id->phone_num), "+55119%s", ph_tail);

    /* Samsung Electronics OUI: a8:7c:01 */
    gen_mac("a8:7c:01", id->wifi_mac);
    gen_mac("a8:7c:01", id->bt_mac);
    gen_mac("34:97:f6", id->wifi_bssid);

    char ssid_hex[8];
    gen_hex(ssid_hex, 4, 1);
    snprintf(id->wifi_ssid, sizeof(id->wifi_ssid), "Vivo-Fibra-%s", ssid_hex);

    gen_uuid4(id->boot_id);
    gen_hex(id->cpu_serial, 16, 0);

    strcpy(id->timezone, "America/Sao_Paulo");
    strcpy(id->operator_mccmnc, "72410");
    strcpy(id->operator_name, "Vivo");
    strcpy(id->operator_country, "br");
}

static int load_identity(device_identity_t *id) {
    FILE *fp = fopen(IDENTITY_FILE, "r");
    if (!fp) return 0;

    generate_default_identity(id);
    char line[256];
    while (fgets(line, sizeof(line), fp)) {
        size_t l = strlen(line);
        while (l > 0 && (line[l - 1] == '\n' || line[l - 1] == '\r')) {
            line[--l] = '\0';
        }
        char *eq = strchr(line, '=');
        if (!eq) continue;
        *eq = '\0';
        const char *k = line;
        const char *v = eq + 1;

        if (strcmp(k, "SERIAL_NO") == 0) strncpy(id->serial_no, v, sizeof(id->serial_no) - 1);
        else if (strcmp(k, "ANDROID_ID") == 0) strncpy(id->android_id, v, sizeof(id->android_id) - 1);
        else if (strcmp(k, "IMEI1") == 0) strncpy(id->imei1, v, sizeof(id->imei1) - 1);
        else if (strcmp(k, "IMEI2") == 0) strncpy(id->imei2, v, sizeof(id->imei2) - 1);
        else if (strcmp(k, "IMSI") == 0) strncpy(id->imsi, v, sizeof(id->imsi) - 1);
        else if (strcmp(k, "ICCID") == 0) strncpy(id->iccid, v, sizeof(id->iccid) - 1);
        else if (strcmp(k, "PHONE_NUM") == 0) strncpy(id->phone_num, v, sizeof(id->phone_num) - 1);
        else if (strcmp(k, "WIFI_MAC") == 0) strncpy(id->wifi_mac, v, sizeof(id->wifi_mac) - 1);
        else if (strcmp(k, "BT_MAC") == 0) strncpy(id->bt_mac, v, sizeof(id->bt_mac) - 1);
        else if (strcmp(k, "WIFI_BSSID") == 0) strncpy(id->wifi_bssid, v, sizeof(id->wifi_bssid) - 1);
        else if (strcmp(k, "WIFI_SSID") == 0) strncpy(id->wifi_ssid, v, sizeof(id->wifi_ssid) - 1);
        else if (strcmp(k, "BOOT_ID") == 0) strncpy(id->boot_id, v, sizeof(id->boot_id) - 1);
        else if (strcmp(k, "CPU_SERIAL") == 0) strncpy(id->cpu_serial, v, sizeof(id->cpu_serial) - 1);
        else if (strcmp(k, "TIMEZONE") == 0) strncpy(id->timezone, v, sizeof(id->timezone) - 1);
        else if (strcmp(k, "OPERATOR_MCCMNC") == 0) strncpy(id->operator_mccmnc, v, sizeof(id->operator_mccmnc) - 1);
        else if (strcmp(k, "OPERATOR_NAME") == 0) strncpy(id->operator_name, v, sizeof(id->operator_name) - 1);
        else if (strcmp(k, "OPERATOR_COUNTRY") == 0) strncpy(id->operator_country, v, sizeof(id->operator_country) - 1);
    }
    fclose(fp);
    return 1;
}

static void save_identity(const device_identity_t *id) {
    mkdir("/data/system", 0775);
    FILE *fp = fopen(IDENTITY_FILE, "w");
    if (!fp) return;
    fprintf(fp, "SERIAL_NO=%s\n", id->serial_no);
    fprintf(fp, "ANDROID_ID=%s\n", id->android_id);
    fprintf(fp, "IMEI1=%s\n", id->imei1);
    fprintf(fp, "IMEI2=%s\n", id->imei2);
    fprintf(fp, "IMSI=%s\n", id->imsi);
    fprintf(fp, "ICCID=%s\n", id->iccid);
    fprintf(fp, "PHONE_NUM=%s\n", id->phone_num);
    fprintf(fp, "WIFI_MAC=%s\n", id->wifi_mac);
    fprintf(fp, "BT_MAC=%s\n", id->bt_mac);
    fprintf(fp, "WIFI_BSSID=%s\n", id->wifi_bssid);
    fprintf(fp, "WIFI_SSID=%s\n", id->wifi_ssid);
    fprintf(fp, "BOOT_ID=%s\n", id->boot_id);
    fprintf(fp, "CPU_SERIAL=%s\n", id->cpu_serial);
    fprintf(fp, "TIMEZONE=%s\n", id->timezone);
    fprintf(fp, "OPERATOR_MCCMNC=%s\n", id->operator_mccmnc);
    fprintf(fp, "OPERATOR_NAME=%s\n", id->operator_name);
    fprintf(fp, "OPERATOR_COUNTRY=%s\n", id->operator_country);
    fclose(fp);
    chmod(IDENTITY_FILE, 0600);
}

static void bind_file(const char *src, const char *dst) {
    if (access(dst, F_OK) == 0) {
        umount2(dst, MNT_DETACH);
        mount(src, dst, NULL, MS_BIND, NULL);
    }
}

static void write_text_file(const char *path, const char *content, mode_t mode) {
    FILE *fp = fopen(path, "w");
    if (fp) {
        fputs(content, fp);
        fclose(fp);
        chmod(path, mode);
    }
}

static void setup_cpu_sysfs_mask(void) {
    char base[256];
    char sub[384];
    char fpath[512];
    snprintf(base, sizeof(base), "%s/sys_cpu", PROC_MASK_DIR);
    mkdir(base, 0755);

    write_text_file(
        ({ snprintf(fpath, sizeof(fpath), "%s/online", base); fpath; }),
        "0-7\n", 0444);
    write_text_file(
        ({ snprintf(fpath, sizeof(fpath), "%s/present", base); fpath; }),
        "0-7\n", 0444);
    write_text_file(
        ({ snprintf(fpath, sizeof(fpath), "%s/possible", base); fpath; }),
        "0-7\n", 0444);
    write_text_file(
        ({ snprintf(fpath, sizeof(fpath), "%s/offline", base); fpath; }),
        "\n", 0444);
    write_text_file(
        ({ snprintf(fpath, sizeof(fpath), "%s/kernel_max", base); fpath; }),
        "7\n", 0444);
    write_text_file(
        ({ snprintf(fpath, sizeof(fpath), "%s/modalias", base); fpath; }),
        "cpu:type:aarch64:feature:,0000,0001,0002,0003,0004,0005,0006,0007,0008,0009,000a,000b,000c,000d,000e,000f,0010,0011,0013,0014,0015,0016,0017\n",
        0444);

    snprintf(sub, sizeof(sub), "%s/cpufreq", base);
    mkdir(sub, 0755);
    snprintf(sub, sizeof(sub), "%s/cpuidle", base);
    mkdir(sub, 0755);
    write_text_file(
        ({ snprintf(fpath, sizeof(fpath), "%s/cpuidle/current_driver", base); fpath; }),
        "arm_idle\n", 0444);
    write_text_file(
        ({ snprintf(fpath, sizeof(fpath), "%s/cpuidle/current_governor", base); fpath; }),
        "menu\n", 0444);

    const int min_freqs[8] = {
        400000, 400000, 400000, 400000,
        500000, 500000, 500000, 600000
    };
    const int max_freqs[8] = {
        1824000, 1824000, 1824000, 1824000,
        2515000, 2515000, 2515000, 2800000
    };
    const int cur_freqs[8] = {
        1152000, 1152000, 1152000, 1152000,
        1632000, 1632000, 1632000, 1824000
    };
    const int capacities[8] = {
        389, 389, 389, 389,
        835, 835, 835, 1024
    };
    const int cluster_ids[8] = { 0, 0, 0, 0, 1, 1, 1, 2 };
    const char *cluster_lists[8] = {
        "0-3\n", "0-3\n", "0-3\n", "0-3\n",
        "4-6\n", "4-6\n", "4-6\n", "7\n"
    };
    const char *cluster_masks[8] = {
        "0f\n", "0f\n", "0f\n", "0f\n",
        "70\n", "70\n", "70\n", "80\n"
    };
    const char *midrs[8] = {
        "0x00000000412fd051\n", "0x00000000412fd051\n",
        "0x00000000412fd051\n", "0x00000000412fd051\n",
        "0x00000000412fd471\n", "0x00000000412fd471\n",
        "0x00000000412fd471\n", "0x00000000412fd481\n"
    };

    for (int i = 0; i < 8; i++) {
        char cdir[384];
        char buf[128];
        snprintf(cdir, sizeof(cdir), "%s/cpu%d", base, i);
        mkdir(cdir, 0755);

        snprintf(fpath, sizeof(fpath), "%s/online", cdir);
        write_text_file(fpath, "1\n", 0444);

        snprintf(fpath, sizeof(fpath), "%s/cpu_capacity", cdir);
        snprintf(buf, sizeof(buf), "%d\n", capacities[i]);
        write_text_file(fpath, buf, 0444);

        snprintf(sub, sizeof(sub), "%s/cpufreq", cdir);
        mkdir(sub, 0755);

        snprintf(fpath, sizeof(fpath), "%s/cpuinfo_min_freq", sub);
        snprintf(buf, sizeof(buf), "%d\n", min_freqs[i]);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/scaling_min_freq", sub);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/cpuinfo_max_freq", sub);
        snprintf(buf, sizeof(buf), "%d\n", max_freqs[i]);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/scaling_max_freq", sub);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/scaling_cur_freq", sub);
        snprintf(buf, sizeof(buf), "%d\n", cur_freqs[i]);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/cpuinfo_cur_freq", sub);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/scaling_governor", sub);
        write_text_file(fpath, "schedutil\n", 0444);

        snprintf(fpath, sizeof(fpath), "%s/scaling_driver", sub);
        write_text_file(fpath, "exynos_cpufreq\n", 0444);

        snprintf(fpath, sizeof(fpath), "%s/affected_cpus", sub);
        write_text_file(fpath, cluster_lists[i], 0444);

        snprintf(fpath, sizeof(fpath), "%s/related_cpus", sub);
        write_text_file(fpath, cluster_lists[i], 0444);

        snprintf(sub, sizeof(sub), "%s/topology", cdir);
        mkdir(sub, 0755);

        snprintf(fpath, sizeof(fpath), "%s/core_id", sub);
        snprintf(buf, sizeof(buf), "%d\n", i);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/physical_package_id", sub);
        snprintf(buf, sizeof(buf), "%d\n", cluster_ids[i]);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/cluster_id", sub);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/thread_siblings_list", sub);
        snprintf(buf, sizeof(buf), "%d\n", i);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/thread_siblings", sub);
        snprintf(buf, sizeof(buf), "%02x\n", 1 << i);
        write_text_file(fpath, buf, 0444);

        snprintf(fpath, sizeof(fpath), "%s/core_siblings_list", sub);
        write_text_file(fpath, cluster_lists[i], 0444);

        snprintf(fpath, sizeof(fpath), "%s/core_siblings", sub);
        write_text_file(fpath, cluster_masks[i], 0444);

        snprintf(fpath, sizeof(fpath), "%s/package_cpus_list", sub);
        write_text_file(fpath, cluster_lists[i], 0444);

        snprintf(fpath, sizeof(fpath), "%s/package_cpus", sub);
        write_text_file(fpath, cluster_masks[i], 0444);

        snprintf(sub, sizeof(sub), "%s/regs", cdir);
        mkdir(sub, 0755);
        snprintf(sub, sizeof(sub), "%s/regs/identification", cdir);
        mkdir(sub, 0755);

        snprintf(fpath, sizeof(fpath), "%s/midr_el1", sub);
        write_text_file(fpath, midrs[i], 0444);

        snprintf(fpath, sizeof(fpath), "%s/revidr_el1", sub);
        write_text_file(fpath, "0x0000000000000000\n", 0444);
    }

    bind_file(base, "/sys/devices/system/cpu");
}

static void setup_thermal_and_power_masks(void) {
    char base[256];
    char zdir[384];
    char fpath[512];

    snprintf(base, sizeof(base), "%s/sys_thermal", PROC_MASK_DIR);
    mkdir(base, 0755);

    const char *ztypes[6] = { "BIG", "MID", "LITTLE", "G3D", "ISP", "battery" };
    const char *ztemps[6] = { "36200\n", "35400\n", "34100\n", "35800\n", "33900\n", "31800\n" };
    for (int i = 0; i < 6; i++) {
        snprintf(zdir, sizeof(zdir), "%s/thermal_zone%d", base, i);
        mkdir(zdir, 0755);
        snprintf(fpath, sizeof(fpath), "%s/type", zdir);
        write_text_file(fpath, ztypes[i], 0444);
        snprintf(fpath, sizeof(fpath), "%s/temp", zdir);
        write_text_file(fpath, ztemps[i], 0444);
        snprintf(fpath, sizeof(fpath), "%s/mode", zdir);
        write_text_file(fpath, "enabled\n", 0444);
        snprintf(fpath, sizeof(fpath), "%s/policy", zdir);
        write_text_file(fpath, "step_wise\n", 0444);
    }
    bind_file(base, "/sys/class/thermal");

    snprintf(base, sizeof(base), "%s/sys_power", PROC_MASK_DIR);
    mkdir(base, 0755);

    snprintf(zdir, sizeof(zdir), "%s/battery", base);
    mkdir(zdir, 0755);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/type", zdir); fpath; }), "Battery\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/status", zdir); fpath; }), "Discharging\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/present", zdir); fpath; }), "1\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/capacity", zdir); fpath; }), "83\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/temp", zdir); fpath; }), "318\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/voltage_now", zdir); fpath; }), "4128000\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/current_now", zdir); fpath; }), "-315000\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/charge_full", zdir); fpath; }), "3700000\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/technology", zdir); fpath; }), "Li-ion\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/health", zdir); fpath; }), "Good\n", 0444);

    snprintf(zdir, sizeof(zdir), "%s/usb", base);
    mkdir(zdir, 0755);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/type", zdir); fpath; }), "USB\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/online", zdir); fpath; }), "0\n", 0444);

    snprintf(zdir, sizeof(zdir), "%s/ac", base);
    mkdir(zdir, 0755);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/type", zdir); fpath; }), "Mains\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/online", zdir); fpath; }), "0\n", 0444);

    snprintf(zdir, sizeof(zdir), "%s/wireless", base);
    mkdir(zdir, 0755);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/type", zdir); fpath; }), "Wireless\n", 0444);
    write_text_file(({ snprintf(fpath, sizeof(fpath), "%s/online", zdir); fpath; }), "0\n", 0444);

    bind_file(base, "/sys/class/power_supply");
}

static void setup_proc_and_sys_masks(const device_identity_t *id) {
    mkdir(PROC_MASK_DIR, 0755);

    /* 1. /proc/cpuinfo - Authentic Samsung Exynos 2200 (S5E9925) 8-core ARMv9 */
    char path[256];
    snprintf(path, sizeof(path), "%s/cpuinfo", PROC_MASK_DIR);
    FILE *fp = fopen(path, "w");
    if (fp) {
        /* Cores 0..3: Cortex-A510 (part 0xd05), Cores 4..6: Cortex-A710 (part 0xd47), Core 7: Cortex-X2 (part 0xd48) */
        const char *parts[8] = {
            "0xd05", "0xd05", "0xd05", "0xd05",
            "0xd47", "0xd47", "0xd47", "0xd48"
        };
        for (int i = 0; i < 8; i++) {
            fprintf(fp,
                "processor\t: %d\n"
                "BogoMIPS\t: 52.00\n"
                "Features\t: fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics fphp asimdhp cpuid asimdrdm lrcpc dcpop asimddp\n"
                "CPU implementer\t: 0x41\n"
                "CPU architecture\t: 8\n"
                "CPU variant\t: 0x2\n"
                "CPU part\t: %s\n"
                "CPU revision\t: 1\n\n",
                i, parts[i]);
        }
        fprintf(fp, "Hardware\t: Samsung EXYNOS2200\n");
        fprintf(fp, "Revision\t: 000c\n");
        fprintf(fp, "Serial\t\t: %s\n", id->cpu_serial);
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/proc/cpuinfo");
    }

    setup_cpu_sysfs_mask();
    setup_thermal_and_power_masks();

    /* 2. /proc/version */
    snprintf(path, sizeof(path), "%s/version", PROC_MASK_DIR);
    fp = fopen(path, "w");
    if (fp) {
        fprintf(fp, "Linux version 5.10.136-android12-9-24750181-abS901BXXU2AVF1 (kleaf@build-host) (Android (8490178, based on r450784d) clang version 14.0.6, LLD 14.0.6) #1 SMP PREEMPT Fri Jun 10 18:22:14 KST 2022\n");
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/proc/version");
    }

    /* 3. /proc/cmdline */
    snprintf(path, sizeof(path), "%s/cmdline", PROC_MASK_DIR);
    fp = fopen(path, "w");
    if (fp) {
        fprintf(fp, "stack_depot_disable=on kasan.stacktrace=off kvm-arm.mode=protected cgroup_disable=pressure console=null androidboot.hardware=exynos2200 androidboot.verifiedbootstate=green androidboot.flash.locked=1 androidboot.vbmeta.device_state=locked androidboot.boot_devices=13520000.ufs androidboot.serialno=%s androidboot.mode=normal\n", id->serial_no);
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/proc/cmdline");
    }

    /* 4. /proc/1/cmdline */
    snprintf(path, sizeof(path), "%s/init_cmdline", PROC_MASK_DIR);
    fp = fopen(path, "wb");
    if (fp) {
        const char init_cmd[] = "/system/bin/init\0second_stage";
        fwrite(init_cmd, 1, sizeof(init_cmd), fp);
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/proc/1/cmdline");
    }

    /* 5. /proc/bus/input/devices */
    snprintf(path, sizeof(path), "%s/input_devices", PROC_MASK_DIR);
    fp = fopen(path, "w");
    if (fp) {
        fprintf(fp,
            "I: Bus=0018 Vendor=04e8 Product=a001 Version=0100\n"
            "N: Name=\"sec_touchscreen\"\n"
            "P: Phys=sec_touchscreen/input0\n"
            "S: Sysfs=/devices/platform/10d10000.spi/spi_master/spi0/spi0.0/input/input0\n"
            "U: Uniq=\n"
            "H: Handlers=event0\n"
            "B: PROP=2\n"
            "B: EV=b\n"
            "B: KEY=420 0 0 0 0 0\n"
            "B: ABS=661800001000003\n\n"
            "I: Bus=0019 Vendor=0001 Product=0001 Version=0100\n"
            "N: Name=\"gpio_keys\"\n"
            "P: Phys=gpio-keys/input0\n"
            "S: Sysfs=/devices/platform/gpio_keys/input/input1\n"
            "U: Uniq=\n"
            "H: Handlers=keychord event1\n"
            "B: PROP=0\n"
            "B: EV=3\n"
            "B: KEY=10000000000000 0\n\n"
            "I: Bus=0019 Vendor=0000 Product=0000 Version=0000\n"
            "N: Name=\"s2mps25-power-keys\"\n"
            "P: Phys=s2mps25-power-keys/input0\n"
            "S: Sysfs=/devices/platform/11560000.acpm_mfd_bus/i2c-0/0-0011/s2mps25-power-keys/input/input2\n"
            "U: Uniq=\n"
            "H: Handlers=event2\n"
            "B: PROP=0\n"
            "B: EV=3\n"
            "B: KEY=10000000000000 0\n");
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/proc/bus/input/devices");
    }

    /* 6. /proc/modules */
    snprintf(path, sizeof(path), "%s/modules", PROC_MASK_DIR);
    fp = fopen(path, "w");
    if (fp) {
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/proc/modules");
    }

    /* 7. /proc/scsi/scsi */
    snprintf(path, sizeof(path), "%s/scsi", PROC_MASK_DIR);
    fp = fopen(path, "w");
    if (fp) {
        fprintf(fp, "Attached devices:\n");
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/proc/scsi/scsi");
    }

    /* 8. /proc/sys/kernel/random/boot_id */
    snprintf(path, sizeof(path), "%s/boot_id", PROC_MASK_DIR);
    fp = fopen(path, "w");
    if (fp) {
        fprintf(fp, "%s\n", id->boot_id);
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/proc/sys/kernel/random/boot_id");
    }


    /* 10. Mask PC DMI files under /sys/class/dmi/id if accessible */
    snprintf(path, sizeof(path), "%s/dmi_model", PROC_MASK_DIR);
    fp = fopen(path, "w");
    if (fp) {
        fprintf(fp, "SM-S901B\n");
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/sys/class/dmi/id/product_name");
        bind_file(path, "/sys/class/dmi/id/board_name");
        bind_file(path, "/sys/devices/virtual/dmi/id/product_name");
        bind_file(path, "/sys/devices/virtual/dmi/id/board_name");
    }

    snprintf(path, sizeof(path), "%s/dmi_vendor", PROC_MASK_DIR);
    fp = fopen(path, "w");
    if (fp) {
        fprintf(fp, "Samsung Electronics Co., Ltd.\n");
        fclose(fp);
        chmod(path, 0444);
        bind_file(path, "/sys/class/dmi/id/sys_vendor");
        bind_file(path, "/sys/class/dmi/id/board_vendor");
        bind_file(path, "/sys/class/dmi/id/bios_vendor");
        bind_file(path, "/sys/class/dmi/id/chassis_vendor");
        bind_file(path, "/sys/devices/virtual/dmi/id/sys_vendor");
        bind_file(path, "/sys/devices/virtual/dmi/id/board_vendor");
        bind_file(path, "/sys/devices/virtual/dmi/id/bios_vendor");
        bind_file(path, "/sys/devices/virtual/dmi/id/chassis_vendor");
    }
}

static void apply_early_properties(const device_identity_t *id) {
    /* Set persistent device identifiers */
    run_resetprop("ro.serialno", id->serial_no);
    run_resetprop("ro.boot.serialno", id->serial_no);
    run_resetprop("ril.serialnumber", id->serial_no);
    run_resetprop("sys.serialnumber", id->serial_no);
    run_resetprop("ro.build.product", "r0s");
    run_resetprop("ro.product.vendor_dlkm.brand", "samsung");
    run_resetprop("ro.product.vendor_dlkm.device", "r0s");
    run_resetprop("ro.product.vendor_dlkm.manufacturer", "samsung");
    run_resetprop("ro.product.vendor_dlkm.model", "SM-S901B");
    run_resetprop("ro.product.vendor_dlkm.name", "r0sxxx");
    run_resetprop("ro.vendor_dlkm.build.fingerprint", "samsung/r0sxxx/r0s:12/SP1A.210812.016/S901BXXU2AVF1:user/release-keys");
    run_resetprop("ro.vendor_dlkm.build.tags", "release-keys");
    run_resetprop("ro.vendor_dlkm.build.type", "user");

    /* Set SIM & baseband properties */
    run_resetprop("gsm.sim.operator.numeric", id->operator_mccmnc);
    run_resetprop("gsm.sim.operator.alpha", id->operator_name);
    run_resetprop("gsm.sim.operator.iso-country", id->operator_country);
    run_resetprop("gsm.sim.state", "READY");
    run_resetprop("gsm.operator.numeric", id->operator_mccmnc);
    run_resetprop("gsm.operator.alpha", id->operator_name);
    run_resetprop("gsm.operator.iso-country", id->operator_country);
    run_resetprop("gsm.operator.isroaming", "false");
    run_resetprop("gsm.network.type", "LTE");
    run_resetprop("gsm.version.baseband", "S901BXXU2AVF1,S901BXXU2AVF1");
    run_resetprop("gsm.version.ril-impl", "Samsung RIL v4.0");
    run_resetprop("persist.sys.timezone", id->timezone);

    /* Remove any residual container / boot parameter properties */
    const char *props_to_delete[] = {
        "ro.kernel.qemu",
        "ro.boot.qemu",
        "ro.kernel.android.qemud",
        "ro.radio.noril",
        "ro.boot.noril",
        "ro.boot.display_width",
        "ro.boot.display_height",
        "ro.boot.display_dpi",
        "ro.boot.display_fps",
        "ro.boot.use_display_stream",
        "ro.boot.gpu_mode",
        "ro.boot.gpu_node",
        "ro.boot.redroid_width",
        "ro.boot.redroid_height",
        "ro.boot.redroid_dpi",
        "ro.boot.redroid_fps",
        "ro.boot.redroid_gpu_mode",
        "ro.boot.redroid_gpu_node",
        "ro.boot.use_redroid_stream",
        "ro.boot.proxy_url",
        "ro.boot.custom_serial",
        "ro.boot.custom_android_id",
        "ro.boot.custom_imei",
        "ro.boot.custom_timezone",
        NULL
    };
    for (int i = 0; props_to_delete[i] != NULL; i++) {
        delete_prop(props_to_delete[i]);
    }
}

static void handle_early(void) {
    device_identity_t id;
    int loaded = load_identity(&id);
    if (!loaded) {
        generate_default_identity(&id);
    }

    /* Check if first-boot custom overrides were passed via androidboot.* */
    char val[128];
    read_prop_cmd("ro.boot.custom_serial", val, sizeof(val));
    if (val[0]) strncpy(id.serial_no, val, sizeof(id.serial_no) - 1);

    read_prop_cmd("ro.boot.custom_android_id", val, sizeof(val));
    if (val[0]) strncpy(id.android_id, val, sizeof(id.android_id) - 1);

    read_prop_cmd("ro.boot.custom_imei", val, sizeof(val));
    if (val[0]) strncpy(id.imei1, val, sizeof(id.imei1) - 1);

    read_prop_cmd("ro.boot.custom_timezone", val, sizeof(val));
    if (val[0]) strncpy(id.timezone, val, sizeof(id.timezone) - 1);

    read_prop_cmd("ro.boot.proxy_url", val, sizeof(val));
    if (val[0]) {
        mkdir("/data/system", 0775);
        FILE *pf = fopen(PROXY_FILE, "w");
        if (pf) {
            fprintf(pf, "%s\n", val);
            fclose(pf);
            chmod(PROXY_FILE, 0600);
        }
    }

    save_identity(&id);
    setup_proc_and_sys_masks(&id);
    apply_early_properties(&id);
}

static void handle_boot(void) {
    device_identity_t id;
    if (!load_identity(&id)) {
        generate_default_identity(&id);
        save_identity(&id);
    }

    /* Re-verify proc mounts after boot */
    setup_proc_and_sys_masks(&id);

    /*
     * Now that Zygote has already loaded libndk_translation.so during startup,
     * mask the native bridge & ABI list properties so runtime inspection sees
     * pure arm64-v8a / armeabi-v7a hardware.
     */
    run_resetprop("ro.dalvik.vm.native.bridge", "0");
    run_resetprop("ro.enable.native.bridge.exec", "0");
    run_resetprop("persist.sys.nativebridge", "0");
    run_resetprop("ro.product.cpu.abi", "arm64-v8a");
    run_resetprop("ro.product.cpu.abilist", "arm64-v8a,armeabi-v7a,armeabi");
    run_resetprop("ro.product.cpu.abilist64", "arm64-v8a");
    run_resetprop("ro.product.cpu.abilist32", "armeabi-v7a,armeabi");
    run_resetprop("ro.system.product.cpu.abilist", "arm64-v8a,armeabi-v7a,armeabi");
    run_resetprop("ro.system.product.cpu.abilist64", "arm64-v8a");
    run_resetprop("ro.system.product.cpu.abilist32", "armeabi-v7a,armeabi");
    run_resetprop("ro.vendor.product.cpu.abilist", "arm64-v8a,armeabi-v7a,armeabi");
    run_resetprop("ro.vendor.product.cpu.abilist64", "arm64-v8a");
    run_resetprop("ro.vendor.product.cpu.abilist32", "armeabi-v7a,armeabi");
    run_resetprop("ro.odm.product.cpu.abilist", "arm64-v8a,armeabi-v7a,armeabi");
    run_resetprop("ro.odm.product.cpu.abilist64", "arm64-v8a");
    run_resetprop("ro.odm.product.cpu.abilist32", "armeabi-v7a,armeabi");

    run_resetprop("ro.bionic.arch", "arm64");
    run_resetprop("ro.bionic.2nd_arch", "arm");
    run_resetprop("ro.hardware.egl", "mali");
    run_resetprop("ro.hardware.gralloc", "exynos2200");
    run_resetprop("ro.hardware.vulkan", "exynos2200");

    delete_prop("ro.ndk_translation.version");
    delete_prop("gralloc.gbm.device");

    /* Mask debuggable property to 0 for strict anti-detect */
    run_resetprop("ro.debuggable", "0");

    /* Clean up redroid-specific boot properties */
    delete_prop("ro.boot.redroid_gpu_mode");
    delete_prop("ro.boot.redroid_gpu_node");
    delete_prop("ro.boot.redroid_fps");
    delete_prop("ro.boot.redroid_width");
    delete_prop("ro.boot.redroid_height");
    delete_prop("ro.boot.redroid_dpi");

    /* Apply Android Settings database values for consistent identity */
    char cmd[512];
    snprintf(cmd, sizeof(cmd),
        "/system/bin/settings put secure android_id %s;"
        "/system/bin/settings put global device_name 'Galaxy S22';"
        "/system/bin/settings put secure bluetooth_name 'Galaxy S22';"
        "/system/bin/settings put global adb_enabled 0;"
        "/system/bin/settings put global development_settings_enabled 0;"
        "/system/bin/settings put global http_proxy :0;"
        "/system/bin/wm size 1080x1920;"
        "/system/bin/wm density 420;"
        "/system/bin/setprop ctl.start adbd;",
        id.android_id);
    system(cmd);
    run_resetprop("sys.usb.config", "none");
    run_resetprop("sys.usb.state", "none");
    run_resetprop("persist.sys.usb.config", "none");

    /* Launch transparent network daemon if proxy is configured */
    if (access(PROXY_FILE, F_OK) == 0) {
        pid_t pid = fork();
        if (pid == 0) {
            execl("/vendor/bin/secnetd", "secnetd", PROXY_FILE, (char *)NULL);
            _exit(0);
        }
    }

    /* Background loop for realistic battery telemetry */
    seed_rng();
    int level = rand_range(76, 89);
    int temp = rand_range(314, 326);
    while (1) {
        snprintf(cmd, sizeof(cmd),
            "/system/bin/dumpsys battery set ac 0;"
            "/system/bin/dumpsys battery set usb 0;"
            "/system/bin/dumpsys battery set wireless 0;"
            "/system/bin/dumpsys battery set status 3;"
            "/system/bin/dumpsys battery set level %d;"
            "/system/bin/dumpsys battery set temp %d;",
            level, temp);
        system(cmd);

        sleep(45);
        temp += rand_range(-3, 3);
        if (temp < 308) temp = 310;
        if (temp > 342) temp = 338;
        if ((rand() % 4) == 0 && level > 22) {
            level--;
        }
    }
}

int main(int argc, char *argv[]) {
    if (argc > 1 && strcmp(argv[1], "early") == 0) {
        handle_early();
        return 0;
    }
    if (argc > 1 && strcmp(argv[1], "boot") == 0) {
        handle_boot();
        return 0;
    }
    handle_early();
    return 0;
}
