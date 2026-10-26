FROM redroid/redroid:12.0.0-latest
LABEL org.opencontainers.image.source=https://github.com/IluminCloud-Applications/geenjutsu

COPY build/overlay/ /
RUN ["/vendor/bin/image_cleaner"]

ENTRYPOINT ["/init", "androidboot.hardware=exynos2200", "androidboot.verifiedbootstate=green", "androidboot.flash.locked=1", "androidboot.vbmeta.device_state=locked", "androidboot.mode=normal", "androidboot.boot_devices=13520000.ufs"]
