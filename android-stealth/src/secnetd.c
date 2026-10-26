#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <pthread.h>
#include <poll.h>
#include <signal.h>
#include <netdb.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <linux/netfilter_ipv4.h>

/*
 * Transparent Network Routing Daemon (secnetd)
 * Routes container TCP and DNS traffic through an upstream SOCKS5 or HTTP CONNECT
 * proxy using Netfilter NAT REDIRECT (SO_ORIGINAL_DST), without setting Android
 * system http_proxy properties.
 */

#define SECNET_GID       3009
#define REDIR_TCP_PORT   10800
#define REDIR_DNS_PORT   10853

typedef enum {
    PROXY_NONE = 0,
    PROXY_SOCKS5,
    PROXY_HTTP
} proxy_type_t;

typedef struct {
    proxy_type_t type;
    char host[128];
    char resolved_ip[64];
    int port;
    char user[128];
    char pass[128];
} proxy_config_t;

static proxy_config_t g_proxy;

static const char b64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static void base64_encode(const unsigned char *in, size_t len, char *out) {
    size_t i = 0, j = 0;
    while (i < len) {
        uint32_t a = i < len ? in[i++] : 0;
        uint32_t b = i < len ? in[i++] : 0;
        uint32_t c = i < len ? in[i++] : 0;
        uint32_t triple = (a << 16) | (b << 8) | c;
        out[j++] = b64_table[(triple >> 18) & 0x3F];
        out[j++] = b64_table[(triple >> 12) & 0x3F];
        out[j++] = (i > len + 1) ? '=' : b64_table[(triple >> 6) & 0x3F];
        out[j++] = (i > len) ? '=' : b64_table[triple & 0x3F];
    }
    out[j] = '\0';
}

static int parse_proxy_url(const char *url_in, proxy_config_t *cfg) {
    memset(cfg, 0, sizeof(*cfg));
    char buf[512];
    strncpy(buf, url_in, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';

    size_t l = strlen(buf);
    while (l > 0 && (buf[l - 1] == '\n' || buf[l - 1] == '\r' || buf[l - 1] == ' ')) {
        buf[--l] = '\0';
    }
    if (l == 0) return 0;

    char *p = buf;
    if (strncmp(p, "socks5://", 9) == 0 || strncmp(p, "socks5h://", 10) == 0) {
        cfg->type = PROXY_SOCKS5;
        p = strstr(p, "://") + 3;
    } else if (strncmp(p, "http://", 7) == 0) {
        cfg->type = PROXY_HTTP;
        p += 7;
    } else {
        cfg->type = PROXY_SOCKS5;
    }

    char *at = strrchr(p, '@');
    char *hostpart = p;
    if (at) {
        *at = '\0';
        hostpart = at + 1;
        char *colon = strchr(p, ':');
        if (colon) {
            *colon = '\0';
            strncpy(cfg->user, p, sizeof(cfg->user) - 1);
            strncpy(cfg->pass, colon + 1, sizeof(cfg->pass) - 1);
        } else {
            strncpy(cfg->user, p, sizeof(cfg->user) - 1);
        }
    }

    char *colon = strrchr(hostpart, ':');
    if (!colon) return 0;
    *colon = '\0';
    strncpy(cfg->host, hostpart, sizeof(cfg->host) - 1);
    cfg->port = atoi(colon + 1);
    if (cfg->port <= 0 || cfg->port > 65535) return 0;

    struct in_addr addr;
    if (inet_pton(AF_INET, cfg->host, &addr) == 1) {
        strncpy(cfg->resolved_ip, cfg->host, sizeof(cfg->resolved_ip) - 1);
    } else {
        struct hostent *he = gethostbyname(cfg->host);
        if (he && he->h_addr_list && he->h_addr_list[0]) {
            inet_ntop(AF_INET, he->h_addr_list[0], cfg->resolved_ip, sizeof(cfg->resolved_ip));
        } else {
            strncpy(cfg->resolved_ip, cfg->host, sizeof(cfg->resolved_ip) - 1);
        }
    }
    return 1;
}

static int read_exact(int fd, void *buf, size_t len) {
    unsigned char *p = (unsigned char *)buf;
    size_t got = 0;
    while (got < len) {
        ssize_t r = recv(fd, p + got, len - got, 0);
        if (r <= 0) return -1;
        got += (size_t)r;
    }
    return 0;
}

static int write_exact(int fd, const void *buf, size_t len) {
    const unsigned char *p = (const unsigned char *)buf;
    size_t sent = 0;
    while (sent < len) {
        ssize_t w = send(fd, p + sent, len - sent, MSG_NOSIGNAL);
        if (w <= 0) return -1;
        sent += (size_t)w;
    }
    return 0;
}

static int connect_upstream_tunnel(uint32_t dst_ip_net, uint16_t dst_port_net) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return -1;

    struct timeval tv = { .tv_sec = 10, .tv_usec = 0 };
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
    int one = 1;
    setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));

    struct sockaddr_in proxy_addr;
    memset(&proxy_addr, 0, sizeof(proxy_addr));
    proxy_addr.sin_family = AF_INET;
    proxy_addr.sin_port = htons(g_proxy.port);
    if (inet_pton(AF_INET, g_proxy.resolved_ip, &proxy_addr.sin_addr) != 1) {
        close(fd);
        return -1;
    }

    if (connect(fd, (struct sockaddr *)&proxy_addr, sizeof(proxy_addr)) < 0) {
        close(fd);
        return -1;
    }

    if (g_proxy.type == PROXY_SOCKS5) {
        unsigned char hello[4];
        hello[0] = 0x05;
        if (g_proxy.user[0] != '\0') {
            hello[1] = 0x02;
            hello[2] = 0x00;
            hello[3] = 0x02;
            if (write_exact(fd, hello, 4) < 0) { close(fd); return -1; }
        } else {
            hello[1] = 0x01;
            hello[2] = 0x00;
            if (write_exact(fd, hello, 3) < 0) { close(fd); return -1; }
        }

        unsigned char resp[2];
        if (read_exact(fd, resp, 2) < 0 || resp[0] != 0x05) {
            close(fd);
            return -1;
        }

        if (resp[1] == 0x02) {
            size_t ulen = strlen(g_proxy.user);
            size_t plen = strlen(g_proxy.pass);
            if (ulen > 255) ulen = 255;
            if (plen > 255) plen = 255;
            unsigned char auth[515];
            auth[0] = 0x01;
            auth[1] = (unsigned char)ulen;
            memcpy(auth + 2, g_proxy.user, ulen);
            auth[2 + ulen] = (unsigned char)plen;
            memcpy(auth + 3 + ulen, g_proxy.pass, plen);
            if (write_exact(fd, auth, 3 + ulen + plen) < 0) { close(fd); return -1; }
            if (read_exact(fd, resp, 2) < 0 || resp[1] != 0x00) {
                close(fd);
                return -1;
            }
        } else if (resp[1] != 0x00) {
            close(fd);
            return -1;
        }

        unsigned char req[10];
        req[0] = 0x05;
        req[1] = 0x01; /* CONNECT */
        req[2] = 0x00;
        req[3] = 0x01; /* IPv4 */
        memcpy(req + 4, &dst_ip_net, 4);
        memcpy(req + 8, &dst_port_net, 2);
        if (write_exact(fd, req, 10) < 0) { close(fd); return -1; }

        unsigned char rhdr[4];
        if (read_exact(fd, rhdr, 4) < 0 || rhdr[1] != 0x00) {
            close(fd);
            return -1;
        }
        int skip = 0;
        if (rhdr[3] == 0x01) skip = 6;
        else if (rhdr[3] == 0x04) skip = 18;
        else if (rhdr[3] == 0x03) {
            unsigned char dlen = 0;
            if (read_exact(fd, &dlen, 1) < 0) { close(fd); return -1; }
            skip = dlen + 2;
        }
        if (skip > 0) {
            unsigned char discard[260];
            if (read_exact(fd, discard, skip) < 0) { close(fd); return -1; }
        }
    } else if (g_proxy.type == PROXY_HTTP) {
        char ip_str[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &dst_ip_net, ip_str, sizeof(ip_str));
        uint16_t port_host = ntohs(dst_port_net);

        char req[1024];
        if (g_proxy.user[0] != '\0') {
            char cred[260], b64[512];
            snprintf(cred, sizeof(cred), "%s:%s", g_proxy.user, g_proxy.pass);
            base64_encode((const unsigned char *)cred, strlen(cred), b64);
            snprintf(req, sizeof(req),
                "CONNECT %s:%u HTTP/1.1\r\n"
                "Host: %s:%u\r\n"
                "Proxy-Authorization: Basic %s\r\n"
                "Proxy-Connection: Keep-Alive\r\n\r\n",
                ip_str, port_host, ip_str, port_host, b64);
        } else {
            snprintf(req, sizeof(req),
                "CONNECT %s:%u HTTP/1.1\r\n"
                "Host: %s:%u\r\n"
                "Proxy-Connection: Keep-Alive\r\n\r\n",
                ip_str, port_host, ip_str, port_host);
        }
        if (write_exact(fd, req, strlen(req)) < 0) { close(fd); return -1; }

        char resp[1024];
        size_t pos = 0;
        while (pos < sizeof(resp) - 1) {
            ssize_t r = recv(fd, resp + pos, 1, 0);
            if (r <= 0) { close(fd); return -1; }
            pos++;
            resp[pos] = '\0';
            if (pos >= 4 && strcmp(resp + pos - 4, "\r\n\r\n") == 0) break;
        }
        if (strstr(resp, " 200 ") == NULL) {
            close(fd);
            return -1;
        }
    }

    struct timeval tv_long = { .tv_sec = 300, .tv_usec = 0 };
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv_long, sizeof(tv_long));
    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv_long, sizeof(tv_long));
    return fd;
}

static void *tcp_client_worker(void *arg) {
    int client_fd = (int)(intptr_t)arg;
    struct sockaddr_in orig_dst;
    socklen_t addrlen = sizeof(orig_dst);

    if (getsockopt(client_fd, SOL_IP, SO_ORIGINAL_DST, &orig_dst, &addrlen) < 0) {
        close(client_fd);
        return NULL;
    }

    /* Avoid loops if connected directly to REDIR_TCP_PORT */
    if (ntohs(orig_dst.sin_port) == REDIR_TCP_PORT &&
        ntohl(orig_dst.sin_addr.s_addr) == INADDR_LOOPBACK) {
        close(client_fd);
        return NULL;
    }

    int remote_fd = connect_upstream_tunnel(orig_dst.sin_addr.s_addr, orig_dst.sin_port);
    if (remote_fd < 0) {
        close(client_fd);
        return NULL;
    }

    struct pollfd fds[2];
    fds[0].fd = client_fd;
    fds[0].events = POLLIN;
    fds[1].fd = remote_fd;
    fds[1].events = POLLIN;

    unsigned char buf[16384];
    while (1) {
        int pr = poll(fds, 2, 180000);
        if (pr <= 0) break;

        if (fds[0].revents & (POLLERR | POLLHUP | POLLNVAL)) break;
        if (fds[1].revents & (POLLERR | POLLHUP | POLLNVAL)) break;

        if (fds[0].revents & POLLIN) {
            ssize_t n = recv(client_fd, buf, sizeof(buf), 0);
            if (n <= 0) break;
            if (write_exact(remote_fd, buf, (size_t)n) < 0) break;
        }
        if (fds[1].revents & POLLIN) {
            ssize_t n = recv(remote_fd, buf, sizeof(buf), 0);
            if (n <= 0) break;
            if (write_exact(client_fd, buf, (size_t)n) < 0) break;
        }
    }

    close(remote_fd);
    close(client_fd);
    return NULL;
}

typedef struct {
    int udp_sock;
    struct sockaddr_in client_addr;
    socklen_t client_len;
    unsigned char query[512];
    ssize_t query_len;
} dns_job_t;

static void *dns_query_worker(void *arg) {
    dns_job_t *job = (dns_job_t *)arg;
    uint32_t dns_ip;
    inet_pton(AF_INET, "8.8.8.8", &dns_ip);
    uint16_t dns_port = htons(53);

    int remote_fd = connect_upstream_tunnel(dns_ip, dns_port);
    if (remote_fd >= 0) {
        unsigned char tcp_q[514];
        uint16_t qlen_net = htons((uint16_t)job->query_len);
        memcpy(tcp_q, &qlen_net, 2);
        memcpy(tcp_q + 2, job->query, (size_t)job->query_len);

        if (write_exact(remote_fd, tcp_q, (size_t)job->query_len + 2) == 0) {
            uint16_t rlen_net = 0;
            if (read_exact(remote_fd, &rlen_net, 2) == 0) {
                uint16_t rlen = ntohs(rlen_net);
                if (rlen > 0 && rlen <= 1500) {
                    unsigned char rbuf[1500];
                    if (read_exact(remote_fd, rbuf, rlen) == 0) {
                        sendto(job->udp_sock, rbuf, rlen, 0,
                               (struct sockaddr *)&job->client_addr, job->client_len);
                    }
                }
            }
        }
        close(remote_fd);
    }

    free(job);
    return NULL;
}

static void *dns_listener_thread(void *arg) {
    (void)arg;
    int udp_fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (udp_fd < 0) return NULL;

    int one = 1;
    setsockopt(udp_fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = htons(REDIR_DNS_PORT);

    if (bind(udp_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        close(udp_fd);
        return NULL;
    }

    while (1) {
        dns_job_t *job = (dns_job_t *)malloc(sizeof(dns_job_t));
        if (!job) {
            sleep(1);
            continue;
        }
        job->udp_sock = udp_fd;
        job->client_len = sizeof(job->client_addr);
        job->query_len = recvfrom(udp_fd, job->query, sizeof(job->query), 0,
                                  (struct sockaddr *)&job->client_addr, &job->client_len);
        if (job->query_len <= 0) {
            free(job);
            continue;
        }

        pthread_t tid;
        if (pthread_create(&tid, NULL, dns_query_worker, job) == 0) {
            pthread_detach(tid);
        } else {
            free(job);
        }
    }
    return NULL;
}

static void setup_iptables(const char *proxy_ip) {
    char cmd[2048];
    /* Clean any previous SECNETD rules */
    system("/system/bin/iptables -t nat -D OUTPUT -j SECNETD 2>/dev/null");
    system("/system/bin/iptables -t nat -F SECNETD 2>/dev/null");
    system("/system/bin/iptables -t nat -X SECNETD 2>/dev/null");
    system("/system/bin/iptables -D OUTPUT -p udp ! -d 127.0.0.0/8 ! --dport 53 -j REJECT 2>/dev/null");

    snprintf(cmd, sizeof(cmd),
        "/system/bin/iptables -t nat -N SECNETD && "
        "/system/bin/iptables -t nat -A SECNETD -d 127.0.0.0/8 -j RETURN && "
        "/system/bin/iptables -t nat -A SECNETD -d %s -j RETURN && "
        "/system/bin/iptables -t nat -A SECNETD -m owner --gid-owner %d -j RETURN && "
        "/system/bin/iptables -t nat -A SECNETD -p udp --dport 53 -j REDIRECT --to-ports %d && "
        "/system/bin/iptables -t nat -A SECNETD -p tcp -j REDIRECT --to-ports %d && "
        "/system/bin/iptables -t nat -A OUTPUT -j SECNETD && "
        "/system/bin/iptables -A OUTPUT -p udp ! -d 127.0.0.0/8 ! --dport 53 -j REJECT",
        proxy_ip, SECNET_GID, REDIR_DNS_PORT, REDIR_TCP_PORT);
    system(cmd);
}

int main(int argc, char *argv[]) {
    signal(SIGPIPE, SIG_IGN);

    if (argc > 1 && strcmp(argv[1], "stop") == 0) {
        system("/system/bin/iptables -t nat -D OUTPUT -j SECNETD 2>/dev/null");
        system("/system/bin/iptables -t nat -F SECNETD 2>/dev/null");
        system("/system/bin/iptables -t nat -X SECNETD 2>/dev/null");
        system("/system/bin/iptables -D OUTPUT -p udp ! -d 127.0.0.0/8 ! --dport 53 -j REJECT 2>/dev/null");
        return 0;
    }

    const char *conf_file = (argc > 1) ? argv[1] : "/data/system/.proxy.conf";
    char url[512] = {0};

    if (strncmp(conf_file, "socks5://", 9) == 0 || strncmp(conf_file, "http://", 7) == 0) {
        strncpy(url, conf_file, sizeof(url) - 1);
    } else {
        FILE *fp = fopen(conf_file, "r");
        if (!fp) return 0;
        if (!fgets(url, sizeof(url), fp)) {
            fclose(fp);
            return 0;
        }
        fclose(fp);
    }

    if (!parse_proxy_url(url, &g_proxy)) {
        return 0;
    }

    /* Set iptables before dropping GID to SECNET_GID */
    setup_iptables(g_proxy.resolved_ip);

    /* Set our effective GID to SECNET_GID so iptables skips our outbound sockets */
    setregid(SECNET_GID, SECNET_GID);

    int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (listen_fd < 0) return 1;

    int one = 1;
    setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = htons(REDIR_TCP_PORT);

    if (bind(listen_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        close(listen_fd);
        return 1;
    }
    if (listen(listen_fd, 128) < 0) {
        close(listen_fd);
        return 1;
    }

    pthread_t dns_tid;
    if (pthread_create(&dns_tid, NULL, dns_listener_thread, NULL) == 0) {
        pthread_detach(dns_tid);
    }

    while (1) {
        struct sockaddr_in client_addr;
        socklen_t clen = sizeof(client_addr);
        int client_fd = accept(listen_fd, (struct sockaddr *)&client_addr, &clen);
        if (client_fd < 0) continue;

        pthread_t tid;
        if (pthread_create(&tid, NULL, tcp_client_worker, (void *)(intptr_t)client_fd) == 0) {
            pthread_detach(tid);
        } else {
            close(client_fd);
        }
    }

    return 0;
}
