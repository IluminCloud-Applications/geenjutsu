# 🤖 AGENTS.md — Camoufox-Inspired Anti-Detect Android 12 Architecture & Guide

> **Documento de Referência Técnica para Desenvolvedores e Agentes de IA**  
> **Escopo do Projeto:** `/home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth`  
> **Imagem Docker:** `geenjutsu/android12-camoufox:latest`  
> **Dispositivo Alvo Emulado:** Samsung Galaxy S22 5G (`SM-S901B`) | Plataforma Exynos 2200  
> **Versão do Android:** Android 12 (API Level 31)

---

## 1. 🎯 Objetivo e Visão do Projeto

### O que é o projeto?
O **Camoufox Android** é um ambiente Android 12 containerizado de alto desempenho baseado no AOSP/Redroid, modificado estruturalmente em níveis profundos de kernel, HAL, propriedades de sistema e rede para **eliminar 100% dos vetores de detecção de emuladores e containers**.

### A Filosofia Camoufox aplicada ao Android
Assim como o projeto **Camoufox** (Firefox) altera o código fonte do navegador C++ e WebGL para gerar impressões digitais matematicamente perfeitas de navegadores reais sem depender de simples scripts de injeção JavaScript facilmente detectáveis, o nosso contêiner Android aplica a mesma filosofia ao sistema operacional:
1. **Consistência Estrutural em Profundidade**: Em vez de mascarar valores superficialmente via Xposed ou Magisk (que deixam rastros de hooking e chamadas de reflexão), as modificações são feitas nos arquivos reais do sistema (`/system`, `/vendor`), no binário estático `uname`, nas tabelas de hardware PCI e na memória de processos via bind mounts de `/proc` e `/sys`.
2. **Zero Inconsistências de Hardware**: O hardware reportado é um **Samsung Galaxy S22 5G (SM-S901B)** com arquitetura **Exynos 2200** e GPU **Samsung Xclipse 920** (desenvolvida pela Samsung em parceria com a AMD sob arquitetura RDNA2). O SurfaceFlinger, o driver GLES e o Vulkan reportam dados consistentes com essa GPU real, mesmo renderizando através da GPU host (AMD Radeon RX 6600).
3. **Resistência a Anti-Cheats e Detecções Agressivas**: Projetado para que aplicativos com checagens avançadas de integridade (Free Fire, PUBG Mobile, TikTok, Instagram, Facebook, apps bancários e SafetyNet/Play Integrity) vejam o ambiente como um dispositivo de varejo genuíno, bloqueado e de produção.

---

## 2. 🏗️ Arquitetura Técnica: Como Estamos Fazendo

### 2.1. Mascaramento Pre-Zygote de Kernel e Hardware (`/proc` e `/sys`)
O utilitário estático compilado [`src/device_init.c`](file:///home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth/src/device_init.c) executa no gatilho `on post-fs-data` (`device_init early`), **antes** da inicialização do Zygote e de qualquer processo de aplicativo:
- **/proc/cpuinfo**: Mascarado via bind-mount para reportar um processador octa-core ARMv9 Samsung Exynos 2200 genuíno (1x Cortex-X2 + 3x Cortex-A710 + 4x Cortex-A510) com implementação `0x41`, arquitetura `8`, e campo `Hardware: Samsung EXYNOS2200`.
- **/proc/version**: Mascarado para reportar o kernel oficial de varejo da Samsung: `Linux version 5.10.136-android12-9-24750181-abS901BXXU2AVF1 (kleaf@build-host) (Android (8490178, based on r450784d) clang version 14.0.6, LLD 14.0.6) #1 SMP PREEMPT Fri Jun 10 18:22:14 KST 2022`.
- **/proc/cmdline**: Mascarado para uma linha de boot Samsung retail, eliminando completamente `qemu=1`, parâmetros de virtualização ou flags de debug.
- **/proc/1/cmdline**: Mascarado para `/system/bin/init second_stage`.
- **/proc/bus/input/devices**: Mascarado para expor controladores de entrada físicos reais de toque Samsung (`sec_touchscreen`, `gpio_keys`).
- **/sys/class/dmi/id/**: Bloqueado/mascarado para evitar vazamentos de informações da placa-mãe do PC host.
- **/system/bin/uname**: Substituído por um executável C estático compilado com `gcc -static` que responde `aarch64` em qualquer chamada `uname -m`, mascarando o fato de que a VM roda nativamente em CPU x86_64.

### 2.2. Identidade Persistente de Hardware por Volume (`/data`)
Uma falha comum em emuladores é a troca de Identificadores (Android ID, MAC, IMEI, Serial) a cada reinicialização ou criação de container, o que bloqueia contas e dispara heurísticas de segurança de redes sociais.
- **Arquivo de Configuração**: `/data/system/.device_identity.conf` armazenado dentro do volume Docker montado em `/data`.
- **Primeiro Boot**: Se o arquivo não existir, o [`device_init`](file:///home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth/src/device_init.c) gera um conjunto de identificadores matematicamente válidos:
  - `SERIAL_NO`: Padrão Samsung alfanumérico de 11 caracteres (iniciado por `R5CT...`).
  - `ANDROID_ID`: Hexadecimal de 16 caracteres criptograficamente aleatório.
  - `IMEI1` e `IMEI2`: TAC oficial do Galaxy S22 (`35407215`) com 14 dígitos e o 15º dígito calculado pelo algoritmo de **Luhn Checksum**.
  - `IMSI` e `ICCID`: Gerados com MCC/MNC realistas de operadoras móveis.
  - `MAC Address`: Gerado respeitando o OUI oficial da Samsung Electronics (`A8:7C:01:xx:xx:xx`).
  - `BSSID` e `SSID`: Nomes de redes residenciais críveis (`Home_Wi-Fi_5G`, `NetVirtua-XXXX`).
  - `BOOT_ID`: UUID v4 fixo.
- **Boots Subsequentes**: O arquivo é carregado intacto, garantindo que o dispositivo mantenha a mesmíssima impressão digital para sempre enquanto aquele volume for utilizado.

### 2.3. Pipeline Gráfico e Aceleração de Hardware (DRM, GBM e Xclipse 920)
- **Modo Host DRM/GBM**:
  O container roda com acesso direto a `/dev/dri` (`/dev/dri/renderD128`) utilizando a GPU do host (AMD Radeon RX 6600).
  - O HAL alocador de buffers é o **GBM** (`gralloc.gbm.so`), que cria buffers de hardware via descritores DRM.
  - O script [`scripts/build_image.mjs`](file:///home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth/scripts/build_image.mjs) e o inicializador de GPU vinculam dinamicamente `gralloc.exynos2200.so` e `gralloc.default.so` diretamente ao módulo `gralloc.gbm.so`, evitando o erro clássico de `invalid gralloc handle / importBuffer failed: 2`.
  - A propriedade `gralloc.gbm.device=/dev/dri/renderD128` é estritamente mantida para garantir que o SurfaceFlinger, o encoder h264 e o `scrcpy` consigam importar e capturar frames sem tela preta.
- **Spoofing da GPU Samsung Xclipse 920**:
  - A tabela de identificação PCI da AMD (`/vendor/etc/hwdata/amdgpu.ids.samsung`) foi editada para mapear os Device IDs da GPU para `"Samsung Xclipse 920"`.
  - As strings de versão do driver em `/vendor/lib64/dri/libgallium_dri.so` foram tratadas para reportar o driver oficial Samsung `v1.r38p1-01eac0` e fabricante `Samsung`.
  - O SurfaceFlinger reporta autenticamente:
    `GLES: AMD, Samsung Xclipse 920 (radeonsi, navi23, ACO, DRM 3.64, 7.1.5-generic), OpenGL ES 3.2 v1.r38p1-01eac0`
- **Resolução e Densidade Nativa**:
  - Resolução física primária: **1080x1920 (Full HD)** a **60 FPS**.
  - Densidade de tela: **420 DPI** (`ro.sf.lcd_density=420`), resultando em uma largura útil de `sw411dp`, proporcionando layout proporcional e nítido.

### 2.4. Roteamento Transparente de Rede em Nível Profundo (`secnetd`)
Para contornar proxies HTTP comuns que são detectados por checagens de `settings get global http_proxy` ou inspeção de rede nos apps:
- O daemon [`src/secnetd.c`](file:///home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth/src/secnetd.c) escuta em porta local interna (`127.0.0.1:10800`).
- Regras de `iptables` na tabela `nat (PREROUTING / OUTPUT)` redirecionam todo o tráfego TCP de aplicativos para o `secnetd`.
- O `secnetd` recupera o destino real da conexão via `getsockopt(fd, SOL_IP, SO_ORIGINAL_DST)` e conecta ao upstream via túnel **SOCKS5** (com suporte a autenticação RFC 1928/1929) ou **HTTP CONNECT**.
- **DNS Leak Protection**: Consultas DNS na porta UDP 53 são interceptadas e resolvidas através do túnel SOCKS5 pelo proxy remoto.
- **Anti-Leak UDP/WebRTC**: Tráfego UDP direto que tentaria expor o IP residencial/real do host é bloqueado via Netfilter.
- A propriedade `http_proxy` no Android permanece configurada como `:0` (desativada), de modo que apps convencionais veem uma conexão de internet direta e limpa.

### 2.5. Telemetria Dinâmica de Bateria e Hardware
O loop contínuo em background do `device_init boot`:
- Simula status de bateria descarregando gradualmente em segundo plano (nível entre 75% e 89%, temperatura oscilando organicamente entre 31.4°C e 32.6°C).
- Alimenta os serviços do Android (`dumpsys battery`) para que apps que monitoram nível de bateria e temperatura vejam o comportamento orgânico de um celular em uso.

### 2.6. Limpeza de Imagem (`image_cleaner`)
Executado durante a compilação do container:
- Remove `/system/xbin/su`, `/system/bin/su` e outros binários de superusuário que disparariam detecções de root.
- Remove o arquivo `/.dockerenv`.
- Remove scripts e referências antigas do redroid (`redroid.common.rc`, `redroid.legacy.rc`).
- Ajusta permissões e propriedades de segurança para `ro.secure=1`, `ro.debuggable=0` e SELinux enforcing.

---

## 3. 📊 Status Atual do Projeto

| Funcionalidade | Status | Detalhes |
|---|---|---|
| **Base Android 12 AOSP** | ✅ Concluído | Imagem `geenjutsu/android12-camoufox:latest` gerada e funcional |
| **Perfil Samsung S22 (SM-S901B)** | ✅ Concluído | Todas as props de produto, marca, modelo e plataforma Exynos 2200 aplicadas |
| **Persistência de Identidade** | ✅ Concluído | Serial, IMEI (Luhn), Android ID e MAC persistentes via volume `/data` |
| **Mascaramento Kernel (/proc, /sys, uname)** | ✅ Concluído | CPUinfo 8-core Exynos, versão de kernel Samsung, uname `aarch64` |
| **Aceleração Gráfica Host GPU (AMD RX 6600)** | ✅ Concluído | DRI `/dev/dri/renderD128` funcional com driver GBM |
| **Resolução Nativa 1080x1920 @ 420 DPI** | ✅ Concluído | Resolução Full HD nítida com HWComposer ajustado e densidade de 420 DPI |
| **Fix da Tela Preta no scrcpy** | ✅ Concluído | Resolvido pareamento de `gralloc.gbm.so` e preservado `gralloc.gbm.device` |
| **Roteamento Transparente SOCKS5/HTTP** | ✅ Concluído | Implementado em C (`secnetd`) com proteção contra vazamentos de DNS e WebRTC |
| **Apps Base Embutidos** | ✅ Concluído | **Aurora Store** e **Via Browser** pré-instalados em `/system/app/` |
| **Suite de Testes Automatizada** | ✅ Concluído | 8/8 testes de stealth e integridade passando com 100% de sucesso |

---

## 4. 🛠️ Como Operar, Compilar e Testar

### 4.1. Compilação da Imagem Docker
Sempre que fizer alterações nos fontes C (`src/`) ou nos geradores de propriedades:
```bash
cd /home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth
node scripts/build_image.mjs
```

### 4.2. Inicialização do Contêiner
O script [`scripts/run_container.sh`](file:///home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth/scripts/run_container.sh) gerencia o ciclo de vida do contêiner, volumes e conexão ADB:

```bash
cd /home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth

# 1. Iniciar contêiner padrão:
./scripts/run_container.sh camoufox-android12 camoufox_android12_data

# 2. Iniciar contêiner conectado a um proxy SOCKS5 residencial:
./scripts/run_container.sh camoufox-android12 camoufox_android12_data "socks5://usuario:senha@192.168.1.100:1080"
```

### 4.3. Visualização GUI via `scrcpy`
Para visualizar e controlar a tela do Android com aceleração total:
```bash
scrcpy -s 127.0.0.1:5555 --window-title="Camoufox Android 12" --stay-awake
```

### 4.4. Execução da Suite de Verificação Anti-Detecção
Para rodar a bateria de testes que valida as 8 camadas de camuflagem:
```bash
cd /home/celio/Documents/VSCode/Extension/electron-apps/geenjutsu/android-stealth
./scripts/test_stealth.sh
```

---

## 5. 🗺️ Próximos Passos: Integração com o Geenjutsu

Quando formos incorporar essa tecnologia no aplicativo principal do Geenjutsu:

1. **Serviço de Gerenciamento (`src/main/services/redroidManager.ts`)**:
   - Atualizar o launcher de contêineres do Electron para utilizar a imagem `geenjutsu/android12-camoufox:latest`.
   - Repassar os parâmetros de resolução (`1080x1920`), densidade (`420 DPI`) e aceleração GPU (`--device /dev/dri:/dev/dri`).
2. **Gerenciamento de Perfis e Volumes Dedicados**:
   - Cada perfil de conta criado no Geenjutsu deve ter seu respectivo volume de dados Docker (`geenjutsu_profile_<id>_data`), garantindo que cada perfil tenha um IMEI, Android ID e Serial Number únicos e imutáveis.
3. **Injeção de Proxy por Perfil na UI**:
   - Conectar o campo de proxy configurado na interface React/Electron diretamente ao parâmetro `androidboot.proxy_url` do contêiner, ativando automaticamente o `secnetd`.
4. **Instalação Automática de APKs nos Perfis**:
   - O modal de instalação de APKs (`InstallApkModal.tsx`) já existente no Geenjutsu poderá direcionar instalações diretamente para o ADB do contêiner correspondente.

---

> **Mantenha esta documentação atualizada sempre que novas camadas de evasão ou modificações estruturais forem adicionadas ao contêiner.**
