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

## 🍏 Instalação no macOS (Gatekeeper / Quarentena)

Por se tratar de um aplicativo distribuído diretamente sem assinatura da Mac App Store, o Gatekeeper do macOS pode exibir o aviso:
> *"Geenjutsu está danificado e não pode ser aberto"* ou *"Não foi possível verificar o desenvolvedor"*.

Para liberar e abrir o aplicativo normalmente:

1. Baixe o instalador `.dmg` correspondente à arquitetura do seu Mac (**Apple Silicon M1/M2/M3/M4** ➔ `arm64` ou **Intel** ➔ `x64`).
2. Abra o arquivo `.dmg` e arraste o ícone do **Geenjutsu** para a pasta **Aplicativos** (`Applications`).
3. Abra o **Terminal** do macOS (Spotlight: `cmd + espaço` ➔ Terminal).
4. Cole o comando abaixo e aperte Enter:

```bash
sudo xattr -cr /Applications/Geenjutsu.app
```
*(Será solicitada a senha do seu usuário do Mac para confirmar a permissão de administrador)*

5. Pronto! Agora o Geenjutsu abrirá diretamente pelo Launchpad ou pasta Aplicativos sem nenhum bloqueio.

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
