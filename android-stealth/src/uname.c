#include <stdio.h>
#include <string.h>

/*
 * Standard uname CLI replacement for container hardware profile consistency
 * Reports Samsung Galaxy S22 (SM-S901B / exynos2200) kernel & architecture metadata.
 */

#define SYSNAME  "Linux"
#define NODENAME "localhost"
#define RELEASE  "5.10.136-android12-9-24750181-abS901BXXU2AVF1"
#define VERSION  "#1 SMP PREEMPT Fri Jun 10 18:22:14 KST 2022"
#define MACHINE  "aarch64"
#define OS       "Android"

int main(int argc, char *argv[]) {
    int opt_s = 0, opt_n = 0, opt_r = 0, opt_v = 0, opt_m = 0, opt_o = 0;
    int any = 0;

    for (int i = 1; i < argc; i++) {
        if (argv[i][0] == '-') {
            for (int j = 1; argv[i][j] != '\0'; j++) {
                switch (argv[i][j]) {
                    case 'a':
                        opt_s = opt_n = opt_r = opt_v = opt_m = opt_o = 1;
                        any = 1;
                        break;
                    case 's': opt_s = 1; any = 1; break;
                    case 'n': opt_n = 1; any = 1; break;
                    case 'r': opt_r = 1; any = 1; break;
                    case 'v': opt_v = 1; any = 1; break;
                    case 'm':
                    case 'p':
                    case 'i': opt_m = 1; any = 1; break;
                    case 'o': opt_o = 1; any = 1; break;
                    default: break;
                }
            }
        }
    }

    if (!any) {
        opt_s = 1;
    }

    int first = 1;
    if (opt_s) { printf("%s%s", first ? "" : " ", SYSNAME); first = 0; }
    if (opt_n) { printf("%s%s", first ? "" : " ", NODENAME); first = 0; }
    if (opt_r) { printf("%s%s", first ? "" : " ", RELEASE); first = 0; }
    if (opt_v) { printf("%s%s", first ? "" : " ", VERSION); first = 0; }
    if (opt_m) { printf("%s%s", first ? "" : " ", MACHINE); first = 0; }
    if (opt_o) { printf("%s%s", first ? "" : " ", OS); first = 0; }
    printf("\n");
    return 0;
}
