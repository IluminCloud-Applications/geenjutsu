# Camoufox-Inspired Anti-Detect Android 12 Container

Imagem Docker personalizada de Android 12 (`geenjutsu/android12-camoufox:latest`) desenvolvida com a filosofia do **Camoufox**: mascaramento em profundidade de hardware, consistência rigorosa de perfis AOSP, identidade de dispositivo persistente por container e roteamento transparente de proxy.

---

## 🎯 Principais Características

1. **Perfil de Hardware Autêntico (Samsung Galaxy S22 5G - `SM-S901B`)**:
   - `ro.product.model`: `SM-S901B`
   - `ro.product.brand`: `samsung`
   - `ro.product.manufacturer`: `samsung`
   - `ro.product.board`: `s5e9925`
   - `ro.board.platform`: `exynos2200`
   - `ro.build.tags`: `release-keys`
   - `ro.build.type`: `user`
   - `ro.boot.verifiedbootstate`: `green`
   - `ro.debuggable`: `0` | `ro.secure`: `1`

2. **Identidade Persistente por Container (`/data/system/.device_identity.conf`)**:
   - Na primeira inicialização com um novo volume `/data`, gera identificadores criptograficamente realistas e válidos:
     - `SERIAL_NO` (formato Samsung R5CT...)
     - `ANDROID_ID` (16 caracteres hex)
     - `IMEI1` e `IMEI2` com TAC oficial do Galaxy S22 (`35407215`) e dígito verificador pelo algoritmo de **Luhn**
     - `IMSI` e `ICCID` realistas de operadoras móveis
     - `MAC Address` (OUI Samsung `A8:7C:01:...`)
     - `BSSID` e `SSID` residenciais
     - `BOOT_ID` UUIDv4
   - Em reinicializações subsequentes com o mesmo volume, a identidade é **100% preservada**, evitando mudanças de dispositivo suspeitas para aplicativos bancários e redes sociais.

3. **Mascaramento do Kernel (`/proc` e `/sys`) no Boot Pre-Zygote (`device_init early`)**:
   - `/proc/cpuinfo`: 8 núcleos ARMv9 Samsung Exynos 2200 (Cortex-X2 + Cortex-A710 + Cortex-A510).
   - `/proc/version`: Kernel Samsung oficial `5.10.136-android12-9-24750181-abS901BXXU2AVF1`.
   - `/proc/cmdline`: Inicialização segura Samsung sem parâmetros de emulador (`qemu=1`, etc.).
   - `/proc/1/cmdline`: Processo `/system/bin/init second_stage`.
   - `/proc/bus/input/devices`: Dispositivos de toque autênticos (`sec_touchscreen`, `gpio_keys`).
   - `/sys/class/dmi/id/*`: Mascarado para Samsung Electronics.
   - `/system/bin/uname`: Binário estático que reporta `aarch64` e versão de kernel real.

4. **Camada de Rede Transparente (`secnetd`)**:
   - Roteamento transparente via Netfilter/iptables (`REDIRECT` + `SO_ORIGINAL_DST`) ouvindo em porta local.
   - Suporte completo a **SOCKS5** (com autenticação RFC 1928 / RFC 1929) e **HTTP CONNECT**.
   - Encaminhamento transparente de DNS (porta 53) via túnel TCP pelo proxy upstream.
   - Bloqueio de vazamentos de WebRTC/STUN via UDP direto.
   - A configuração de sistema `http_proxy` do Android permanece `:0` (nula), impedindo que apps detectem configurações de proxy HTTP comuns.

5. **Eliminação de Indicadores de Emulação**:
   - Remoção de `su`, `/.dockerenv`, `redroid.common.rc`, `redroid.legacy.rc`.
   - Renomeação e isolamento dos módulos HAL gráficos (`hwcomposer.exynos2200.so`, `gralloc.default.so`, `libEGL_mali.so`, `libGLESv2_mali.so`).
   - Remoção de propriedades de depuração pós-boot.

---

## 📁 Estrutura de Arquivos

```
android-stealth/
├── Dockerfile                  # Especificação da imagem Docker
├── README.md                   # Esta documentação
├── build/                      # Artefatos compilados e overlay
├── scripts/
│   ├── build_image.mjs         # Script gerador de propriedades, HALs e Docker build
│   ├── run_container.sh        # Script para inicializar o container facilmente
│   └── test_stealth.sh         # Suite automatizada de testes de verificação
└── src/
    ├── device_init.c           # Inicializador de identidade, /proc bind-mounts e telemetria
    ├── image_cleaner.c         # Utilitário de limpeza durante o build da imagem
    ├── secnetd.c               # Daemon de proxy transparente TCP + DNS
    └── uname.c                 # Binário estático para retorno consistente de arquitetura
```

---

## 🚀 Como Usar

### 1. Construir a Imagem

```bash
cd /home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth
node scripts/build_image.mjs
```

### 2. Inicializar o Container

Para inicializar um container com volume de dados persistente:

```bash
# Uso padrão:
./scripts/run_container.sh camoufox-android12 meu_volume_data

# Com proxy SOCKS5 transparente (com ou sem autenticação):
./scripts/run_container.sh camoufox-android12 meu_volume_data "socks5://usuario:senha@ip:porta"
```

### 3. Conectar e Controlar

- **ADB**:
  ```bash
  adb connect 127.0.0.1:5555
  adb devices
  ```
- **Visualização da tela (Scrcpy)**:
  ```bash
  scrcpy -s 127.0.0.1:5555
  ```

### 4. Executar os Testes Automatizados

```bash
./scripts/test_stealth.sh
```
