# Validação de Reputação e Checagem Pré-Voo de Proxy (Criar Conta)

Este documento detalha a arquitetura, o fluxo de detecção antifraude e a implementação técnica da **checagem pré-voo de proxy** antes da abertura do navegador em modo de criação de contas no **Reinsta** (Geenjutsu).

---

## 1. O Problema e a Necessidade da Validação

Ao criar novas contas em redes sociais como **Instagram, Facebook, X (Twitter) e TikTok**, a reputação do endereço IP de conexão é um dos fatores mais críticos avaliados pelos sistemas antifraude (Datadome, Kasada, Cloudflare, Meta Risk Engine).

### Riscos de Usar um Proxy com Baixa Confiança:
* **Detecção como Proxy/Datacenter**: Provedores de proxy comercial frequentemente vendem faixas de IP que já constam em listas públicas de VPN ou Datacenter.
* **Checkpoint Imediato**: Criação de conta bloqueada no primeiro passo, exigência mandatória de confirmação por SMS ou suspensão instantânea por "atividade suspeita".
* **Desperdício de Recursos**: Perda de tempo do operador tentando cadastrar perfis em IPs "queimados".
* **Falhas Silenciosas de Conexão**: Proxies com credenciais expiradas ou portas incorretas que travam a automação no meio do cadastro.

Para mitigar esses problemas, foi implementado um **gatekeeper inteligente pré-voo**: antes de inicializar o motor do Camoufox e carregar a página de cadastro, o sistema testa a rota do proxy, obtém o IP real de saída e consulta bases de inteligência contra fraudes.

---

## 2. Visão Geral da Arquitetura

O sistema opera em uma estrutura de camadas desacopladas (UI Renderer, IPC e Main Service), garantindo que nenhum tráfego da rede social seja gerado antes de o IP ser validado.

```mermaid
flowchart TD
    A["Usuário clica em 'Verificar IP & Abrir' ou 'Testar IP Agora'"] --> B["AccountCreatorModal (Renderer)"]
    B --> C["IPC: window.electron.checkProxy(config)"]
    C --> D["profileIpc.ts -> ProxyChecker.check(rawConfig)"]
    
    subgraph S1 ["Túnel & Descoberta do IP Real"]
        D --> E["ProxyChecker.normalizeConfig()"]
        E --> F{"Tipo do Proxy?"}
        F -- "SOCKS5 / SOCKS4" --> G["Túnel SOCKS (socks.SocksClient + TLS)"]
        F -- "HTTP / HTTPS" --> H["Túnel HTTP CONNECT (http.request + Basic Auth + TLS)"]
        F -- "Conexão Direta" --> I["Consulta Direta"]
        G --> J["Obtém IP de Saída em https://api.ipify.org"]
        H --> J
        I --> J
    end

    subgraph S2 ["Inteligência Antifraude"]
        J --> K["Query proxycheck.io (vpn=1&asn=1)"]
        K -- "Falha / Timeout" --> L["Fallback para ip-api.com"]
        K -- "Sucesso" --> M["Calcula isProxy, Provedor, Localização"]
        L --> M
    end

    M --> N["Retorna ProxyCheckResult para a UI"]
    
    subgraph S3 ["Decisão & Ação na UI"]
        N --> O{"IP Detectado como Proxy/VPN?"}
        O -- "SIM (Risco Alto)" --> P["Exibe Modal de Alerta Antifraude"]
        P --> P1["Usuário cancela para rotacionar IP"]
        P --> P2["Usuário força 'Abrir Mesmo Assim'"]
        O -- "NÃO (IP Limpo)" --> Q["Abre Camoufox em Modo Anônimo Descartável"]
        O -- "FALHA DE CONEXÃO" --> R["Exibe Toast de Erro e Bloqueia Abertura"]
    end
```

---

## 3. Serviços e Componentes Envolvidos

### 3.1. `ProxyChecker` (`src/main/services/proxyChecker.ts`)
É a engine central responsável pelo túnel de rede e pela análise de reputação.

1. **Normalização e Parsing Universal (`normalizeConfig`)**:
   - Aceita tanto formatos de objeto quanto strings de colagem rápida (`host:port:user:pass` ou `socks5://user:pass@host:port`).
   - Normaliza portas, protocolos e credenciais para um formato unificado `NormalizedProxyConfig`.

2. **Descoberta do IP de Saída Real (`getExitIp`)**:
   - **SOCKS5/SOCKS4**: Estabelece conexão via socket através de `SocksClient.createConnection()`, engloba em socket TLS e faz requisição segura para `https://api.ipify.org?format=json`.
   - **HTTP/HTTPS**: Envia comando HTTP `CONNECT` com cabeçalho `Proxy-Authorization: Basic <base64>`, estabelece o túnel, envelopa em TLS e resolve o IP.
   - **Fallback Automático de Protocolo**: Se uma conexão configurada como SOCKS5 falhar, o serviço tenta automaticamente HTTP CONNECT (e vice-versa), cobrindo erros comuns de configuração de proxies multiprotocolo.

3. **Consulta de Inteligência Antifraude (`queryReputation`)**:
   - **1º Nível (Primário)**: `proxycheck.io/v2/<ip>?vpn=1&asn=1`
     - Verifica se o IP é de VPN, proxy, TOR ou datacenter.
     - Extrai operador (`operator.name`), tipo (`type`), ASN e localização (`city`, `region`, `country`).
   - **2º Nível (Fallback)**: `ip-api.com/json/<ip>?fields=...`
     - Caso a primeira API sofra rate limit ou timeout, consulta campos `proxy` e `hosting`.
     - Classifica entre `Residencial`, `Datacenter` e `Proxy/VPN`.

---

### 3.2. Estrutura de Retorno (`ProxyCheckResult` em `src/types/profile.ts`)

```typescript
export interface ProxyCheckResult {
  success: boolean;       // Conseguiu conectar e obter resposta?
  ip?: string;            // IP público de saída detectado
  isProxy: boolean;       // O IP consta em listas de Proxy/VPN/Datacenter?
  proxyType?: string;     // Ex: 'Residencial', 'Datacenter', 'VPN'
  operator?: string;      // Nome da empresa do proxy (ex: Oxylabs, BrightData)
  provider?: string;      // Provedor/ISP (ex: Claro, Vivo, Comcast)
  city?: string;          // Cidade do IP
  region?: string;        // Estado/Região
  country?: string;       // País
  message: string;        // Mensagem descritiva de feedback
  error?: string;         // Mensagem de erro caso a conexão falhe
}
```

---

### 3.3. Integração com o Modal de Criação de Conta (`src/renderer/components/profiles/AccountCreatorModal.ts`)

O modal `AccountCreatorModal` implementa duas formas de acionar a checagem:

1. **Botão "Testar IP Agora"**:
   - O usuário pode testar e validar o IP a qualquer momento enquanto configura o proxy.
   - Renderiza um card informativo mostrando:
     - IP de Saída e Cidade/País.
     - Provedor (ISP).
     - Selo de qualidade (Verde = Seguro / Vermelho = Detectado).

2. **Fluxo Automático Pré-Voo ("Verificar IP & Abrir")**:
   - Ao clicar para abrir o navegador, o sistema salva as credenciais e executa a verificação automaticamente.
   - **Se o proxy for detectado como Proxy/VPN (`isProxy === true`)**:
     - A abertura é pausada.
     - Um modal secundário de alerta antifraude é exibido:
       > *"Proxy / VPN Detectado nas Bases Antifraude: O IP atual foi identificado como PROXY comercial. Se tentar criar a conta agora, a plataforma poderá recusar o cadastro ou solicitar validações."*
     - O usuário pode escolher entre **"Cancelar & Rotacionar IP"** (recomendado para pegar outro IP limpo da pool) ou **"Abrir Mesmo Assim"** (caso queira assumir o risco deliberadamente).
   - **Se o proxy estiver limpo (`isProxy === false` e `success === true`)**:
     - O Camoufox é aberto imediatamente em modo anônimo descartável com notificação de sucesso.
   - **Se o proxy falhar na conexão (`success === false`)**:
     - A abertura é abortada e uma mensagem de erro detalhada informa o motivo (timeout, recusa de túnel ou credenciais inválidas).

---

## 4. Integração com o Camoufox em Modo Anônimo (`CamoufoxManager.ts`)

Quando a validação é concluída e o navegador é liberado:

1. **Sessão 100% Descartável**:
   - Uma pasta temporária exclusiva é criada: `userData/camoufox_anonymous/anon_<timestamp>_<random>/`.
   - Nenhum cookie anterior é carregado.
2. **Fingerprint Virgem**:
   - Novos seeds para Canvas, WebGL, AudioContext e spoofing de hardware são gerados na hora.
   - O sistema operacional simulado pode ser fixo ou sorteado aleatoriamente (`windows`, `macos`, `linux`).
3. **Túnel Seguro Local**:
   - O `camoufoxWorker.mjs` cria uma ponte local via `SocksClient` para que todas as conexões do navegador trafeguem estritamente pelo proxy validado.
4. **Destruição Imediata ao Fechar**:
   - Assim que o usuário conclui o cadastro e fecha a janela, a pasta temporária é completamente deletada (`fs.rmSync`), sem deixar resíduos no disco.

---

## 5. Resumo dos Benefícios

| Aspecto | Antes da Checagem | Com a Checagem Pré-Voo |
| :--- | :--- | :--- |
| **Taxa de Sucesso no Cadastro** | Baixa em IPs comerciais sujos | Alta, pois só inicia com IP residencial limpo |
| **Detecção de Proxies Offline** | Travava o navegador durante o carregamento | Detectado em segundos antes de abrir a janela |
| **Controle de Rotação** | O operador não sabia se o IP havia rotacionado | Exibe na tela o IP exato, cidade e ISP |
| **Proteção Antifraude** | Nenhuma transparência sobre listas de VPN | Consulta em tempo real a bases antifraude públicas |
