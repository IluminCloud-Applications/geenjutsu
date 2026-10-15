# Git Subtree - Geenjutsu Studio

Repositório Oficial: [https://github.com/IluminCloud-Applications/geenjutsu](https://github.com/IluminCloud-Applications/geenjutsu)

---

### Configurar Remote (Executar 1x caso ainda não configurado na raiz do monorepo)
```bash
git remote add geenjutsu https://github.com/IluminCloud-Applications/geenjutsu.git
```

---

### PUSH (Enviar alterações do Geenjutsu para o GitHub)

#### Geenjutsu App (Com Atualização de Versão)
> ⚠️ **IMPORTANTE - Sempre antes de subir uma nova versão:**
> 1. Atualize a versão no arquivo `electron-apps/geenjutsu/package.json` (ex: `"version": "1.0.1"` ou `"1.1.0"`).
> 2. Atualize o arquivo `electron-apps/geenjutsu/public/version.json` com a mesma versão e as novidades nas `"notes"`.
> 3. Faça o commit dessas alterações antes do push:
>    ```bash
>    git add . && git commit -m "feat(geenjutsu): release v1.0.0"
>    ```

```bash
git subtree push --prefix=electron-apps/geenjutsu geenjutsu main
```

---

### PULL (Puxar alterações do GitHub)

```bash
git subtree pull --prefix=electron-apps/geenjutsu geenjutsu main --squash
```

---

### GERAÇÃO E PUBLICAÇÃO AUTOMÁTICA DE INSTALADORES (.exe + .deb + .dmg)

Ao enviar o código do **Geenjutsu App** para o repositório remoto via subtree, o GitHub Actions é disparado automaticamente:
1. Lê a versão do `package.json` (ex: `1.0.0` ➔ tag `v1.0.0`).
2. Compila os instaladores para as 3 plataformas (**Windows**, **Linux** e **macOS**).
3. Cria/atualiza a Release no repositório `IluminCloud-Applications/geenjutsu` com a tag correspondente (`v1.0.0`) e anexa os executáveis.
4. Sem desperdício de armazenamento de artefatos de build (apenas consumo de minutos dos runners e publicação direta nas releases do GitHub sem superlotar o storage).
