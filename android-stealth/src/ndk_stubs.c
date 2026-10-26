#include <stdint.h>
#include <stddef.h>

extern long prctl_plt(int option, unsigned long arg2, unsigned long arg3, unsigned long arg4, unsigned long arg5);
extern long syscall_plt(long number, void *arg1, long arg2, long arg3, long arg4, long arg5);
extern const char str_rel[] __attribute__((visibility("hidden")));
extern const char str_ver[] __attribute__((visibility("hidden")));
extern const char str_mach[] __attribute__((visibility("hidden")));

static void copy_str(char *dst, const char *src) {
    while ((*dst++ = *src++) != 0) {}
}

__attribute__((section(".text.prctl"), used))
long PrctlForGuest(int option, unsigned long arg2, unsigned long arg3, unsigned long arg4, unsigned long arg5) {
    if (option == 22) {
        return 0;
    }
    return prctl_plt(option, arg2, arg3, arg4, arg5);
}

__attribute__((section(".text.uname"), used))
long UnameForGuest(long sysno, char *uts, long arg2, long arg3, long arg4, long arg5) {
    long ret = syscall_plt(sysno, uts, arg2, arg3, arg4, arg5);
    if (sysno == 63 && ret == 0 && uts) {
        copy_str(uts + 0x82, str_rel);
        copy_str(uts + 0xc3, str_ver);
        copy_str(uts + 0x104, str_mach);
    }
    return ret;
}
