# Geenjutsu Studio

[![Build & Release Installers](https://github.com/IluminCloud-Applications/geenjutsu/actions/workflows/build-installers.yml/badge.svg)](https://github.com/IluminCloud-Applications/geenjutsu/actions/workflows/build-installers.yml)
[![Release](https://img.shields.io/github/v/release/IluminCloud-Applications/geenjutsu?label=Release)](https://github.com/IluminCloud-Applications/geenjutsu/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Advanced Anti-Detect Multi-Login Browser Studio com isolamento avançado de fingerprints, proxies dedicados e automações.

---

## ⚡ Funcionalidades

- **Isolamento de Perfis**: Gerenciamento de múltiplos perfis isolados em tempo de execução.
- **Fingerprint Masking Avançado**: Spoofing dinâmico de hardware, canvas, webgl, áudio e headers com base no Camoufox.
- **Gerenciador de Proxies**: Suporte completo a proxies HTTP/HTTPS/SOCKS5 com verificação de latência e IP.
- **Multiplataforma**: Instaladores nativos para Windows (.exe), Linux (.deb) e macOS (.dmg).

---

## 🚀 Download dos Instaladores

Baixe a versão mais recente diretamente na página de [Releases](https://github.com/IluminCloud-Applications/geenjutsu/releases/latest):

- **Windows**: `Geenjutsu-Setup-x.x.x-x64.exe`
- **Linux**: `geenjutsu_x.x.x_amd64.deb`
- **macOS**: `Geenjutsu-x.x.x-arm64.dmg` / `Geenjutsu-x.x.x-x64.dmg`

---

## 🛠️ Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Iniciar em ambiente de desenvolvimento
npm run dev

# Compilar para produção
npm run build

# Gerar instaladores locais
npm run dist:linux   # Linux deb
npm run dist:win     # Windows nsis exe
npm run dist:mac     # macOS dmg
```
