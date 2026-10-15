import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';

const PROMPT_TEMPLATE_PT = `Você é um especialista em automação web com Playwright em JavaScript / Node.js.

Sua tarefa é gerar o código JavaScript puro para ser executado diretamente com Playwright.

DIRETRIZES TÉCNICAS OBRIGATÓRIAS:
1. GERE APENAS CÓDIGO JAVASCRIPT PURO. NUNCA use formatação LaTeX ou caracteres de escape (como \\vert, \\vert{}\\vert{} ou similares). Use operadores normais do JavaScript (||, &&, ==, etc.).
2. RESPONDA OBRIGATORIAMENTE DENTRO DE UM CODEBLOCK (\`\`\`js e \`\`\`). NÃO coloque explicações ou textos fora do bloco de código, responda apenas com o bloco de código \`\`\`js ... \`\`\`.
3. NÃO importe bibliotecas (sem 'require' ou 'import'). As variáveis 'page' (Page do Playwright) e 'context' (BrowserContext) já estão instanciadas e disponíveis globalmente.
4. NÃO declare funções assíncronas externas (como 'async function main()'). Use 'await' diretamente nas linhas de código.
5. Emita logs informativos com 'console.log("...")' a cada etapa importante para acompanhamento do progresso em tempo real.
6. Sempre trate elementos opcionais (banners de cookies, popups, modais) de forma segura:
   - Use 'const btn = page.locator(...).first(); if (await btn.count() > 0 && await btn.isVisible()) { await btn.click(); }' dentro de blocos try/catch para não interromper a execução caso o elemento não exista.
7. Para dados dinâmicos a serem definidos pelo usuário (como email, senha, termos de busca, urls), utilize variáveis no formato {{nome_da_variavel}} (ex: const email = "{{email}}"; const senha = "{{senha}}";).
8. Use seletores resilientes e 'await page.waitForTimeout(ms)' para pausas e esperas necessárias.
9. Para rolagem suave (scroll) em páginas, use 'await page.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), distancia)'.

EXEMPLOS DE ESTRUTURA ESPERADA:

--- EXEMPLO 1: Navegação em portal de notícias com rolagem e leitura de matérias ---
console.log('Iniciando navegação no portal de notícias...');
await page.goto('https://noticias.uol.com.br/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// Fechar banner de cookies de forma segura se existir
try {
  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), .btn-accept').first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }
} catch (e) {}

// Coletar links de notícias da página usando evaluate (seguro e sem quebrar)
const links = await page.evaluate(() => {
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const urls = anchors
    .map(a => a.href)
    .filter(h => (h.includes('/noticias/') || h.includes('/ultimas-noticias/') || h.includes('/cotidiano/')))
    .filter(h => !h.includes('#') && !h.includes('login') && h.startsWith('http'));
  return Array.from(new Set(urls));
});

console.log(\`\${links.length} matérias encontradas.\`);

// Selecionar 3 matérias aleatórias
const selecionadas = links.sort(() => 0.5 - Math.random()).slice(0, 3);

for (let i = 0; i < selecionadas.length; i++) {
  const url = selecionadas[i];
  console.log(\`[\${i + 1}/\${selecionadas.length}] Lendo matéria: \${url}\`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Rolagem suave simulando leitura
  for (let s = 0; s < 4; s++) {
    const scrollPx = Math.floor(Math.random() * 250) + 200;
    await page.evaluate((px) => window.scrollBy({ top: px, behavior: 'smooth' }), scrollPx);
    await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1500);
  }
}
console.log('Leitura das notícias finalizada com sucesso!');

--- EXEMPLO 2: Login com variáveis dinâmicas ---
const email = "{{email}}";
const senha = "{{senha}}";

console.log('Acessando página de autenticação...');
await page.goto('https://exemplo.com/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await page.locator('input[type="email"], input[name="email"]').first().fill(email);
await page.locator('input[type="password"], input[name="password"]').first().fill(senha);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);
console.log('Login submetido com sucesso!');

--- EXEMPLO 3: Pesquisa com termo dinâmico e clique orgânico ---
const termo = "{{termo_busca}}";

console.log(\`Pesquisando por: \${termo}...\`);
await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const inputBusca = page.locator('textarea[name="q"], input[name="q"]').first();
await inputBusca.fill(termo);
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);

const primeiroResultado = page.locator('div#search a h3').first();
if (await primeiroResultado.count() > 0) {
  await primeiroResultado.click();
  await page.waitForTimeout(3000);
  console.log('Primeiro resultado acessado com sucesso!');
}

Minha tarefa para você automatizar:
{USER_TASK}`;

const PROMPT_TEMPLATE_EN = `You are an expert in web automation with Playwright in JavaScript / Node.js.

Your task is to generate pure JavaScript code to be executed directly with Playwright.

MANDATORY TECHNICAL GUIDELINES:
1. GENERATE PURE JAVASCRIPT CODE ONLY. NEVER use LaTeX formatting or escape characters. Use normal JavaScript operators (||, &&, ==, etc.).
2. ALWAYS RESPOND INSIDE A CODEBLOCK (\`\`\`js and \`\`\`). Do NOT put explanations or text outside the code block, respond only with \`\`\`js ... \`\`\`.
3. Do NOT import libraries (no 'require' or 'import'). The variables 'page' (Playwright Page) and 'context' (BrowserContext) are already globally instantiated and available.
4. Do NOT declare external async functions (like 'async function main()'). Use 'await' directly in the code lines.
5. Emit informative logs with 'console.log("...")' at each important step for real-time progress tracking.
6. Always handle optional elements (cookie banners, popups, modals) safely:
   - Use 'const btn = page.locator(...).first(); if (await btn.count() > 0 && await btn.isVisible()) { await btn.click(); }' inside try/catch blocks so execution doesn't halt if the element does not exist.
7. For dynamic user-defined data (such as email, password, search terms, URLs), use variables in {{variable_name}} format (e.g., const email = "{{email}}"; const password = "{{password}}";).
8. Use resilient selectors and 'await page.waitForTimeout(ms)' for necessary pauses and delays.
9. For smooth scrolling on pages, use 'await page.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), distance)'.

EXAMPLES OF EXPECTED STRUCTURE:

--- EXAMPLE 1: News portal navigation with smooth scrolling and article reading ---
console.log('Starting navigation on news portal...');
await page.goto('https://news.ycombinator.com/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// Safe cookie handling
try {
  const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("Agree"), .btn-accept').first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }
} catch (e) {}

// Collect links
const links = await page.evaluate(() => {
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  return Array.from(new Set(anchors.map(a => a.href).filter(h => h.startsWith('http'))));
});

console.log(\`\${links.length} articles found.\`);
const selected = links.sort(() => 0.5 - Math.random()).slice(0, 3);

for (let i = 0; i < selected.length; i++) {
  const url = selected[i];
  console.log(\`[\${i + 1}/\${selected.length}] Reading: \${url}\`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  for (let s = 0; s < 4; s++) {
    const scrollPx = Math.floor(Math.random() * 250) + 200;
    await page.evaluate((px) => window.scrollBy({ top: px, behavior: 'smooth' }), scrollPx);
    await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1500);
  }
}
console.log('News reading routine finished successfully!');

--- EXAMPLE 2: Login with dynamic variables ---
const email = "{{email}}";
const password = "{{password}}";

console.log('Accessing login page...');
await page.goto('https://example.com/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await page.locator('input[type="email"], input[name="email"]').first().fill(email);
await page.locator('input[type="password"], input[name="password"]').first().fill(password);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);
console.log('Login submitted successfully!');

--- EXAMPLE 3: Search with dynamic term and organic click ---
const term = "{{search_term}}";

console.log(\`Searching for: \${term}...\`);
await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const searchInput = page.locator('textarea[name="q"], input[name="q"]').first();
await searchInput.fill(term);
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);

const firstResult = page.locator('div#search a h3').first();
if (await firstResult.count() > 0) {
  await firstResult.click();
  await page.waitForTimeout(3000);
  console.log('First result opened successfully!');
}

My task for you to automate:
{USER_TASK}`;

const PROMPT_EXAMPLES_PT = [
  {
    title: 'Navegação e leitura de notícias (UOL / G1)',
    request: 'Crie uma automação para acessar https://noticias.uol.com.br/, aceitar cookies se houver, coletar links de notícias reais da página, sortear 3 matérias e abrir cada uma fazendo rolagem suave para simular leitura.',
  },
  {
    title: 'Login com preenchimento de variáveis',
    request: 'Crie um script para abrir https://meusite.com/login, preencher {{email}} e {{senha}}, aguardar 2 segundos e clicar em entrar.',
  },
  {
    title: 'Pesquisa no Google e clique orgânico',
    request: 'Gere um script Playwright para abrir o Google, pesquisar pelo termo {{termo_busca}}, aguardar 2 segundos e clicar no primeiro resultado orgânico.',
  },
  {
    title: 'Extração de texto e print de tela',
    request: 'Crie uma automação para acessar a página {{url_destino}}, aguardar o card com a classe .preco carregar e emitir no console.log o texto contido.',
  },
];

const PROMPT_EXAMPLES_EN = [
  {
    title: 'News browsing and smooth reading',
    request: 'Create an automation to open https://news.google.com, accept cookies if prompted, collect top article links, randomly pick 3 and read them with smooth scrolling.',
  },
  {
    title: 'Login with variable substitution',
    request: 'Create a script to open https://example.com/login, fill in {{email}} and {{password}}, wait 2 seconds, and click submit.',
  },
  {
    title: 'Google search and organic click',
    request: 'Generate a Playwright script to open Google, search for {{search_term}}, wait 2 seconds, and click the first organic search result.',
  },
  {
    title: 'Text extraction and selector wait',
    request: 'Create an automation to navigate to {{target_url}}, wait for element .price to load, and log its inner text with console.log.',
  },
];

export const AiPromptModal: React.FC = () => {
  const { isAiPromptModalOpen, setIsAiPromptModalOpen } = useProfiles();
  const { locale, t } = useI18n();

  const isEn = locale === 'en';
  const promptTemplate = isEn ? PROMPT_TEMPLATE_EN : PROMPT_TEMPLATE_PT;
  const promptExamples = isEn ? PROMPT_EXAMPLES_EN : PROMPT_EXAMPLES_PT;

  const [userTask, setUserTask] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAllExamples, setShowAllExamples] = useState(false);

  const fullPrompt = useMemo(() => {
    const defaultPlaceholder = isEn
      ? '[DESCRIBE HERE WHAT YOU WANT THE BROWSER TO DO]'
      : '[DESCREVA AQUI O QUE VOCÊ QUER QUE O NAVEGADOR FAÇA]';
    const taskText = userTask.trim() || defaultPlaceholder;
    return promptTemplate.replace('{USER_TASK}', taskText);
  }, [userTask, promptTemplate, isEn]);

  if (!isAiPromptModalOpen) return null;

  const handleCopy = () => {
    if (!userTask.trim()) return;
    navigator.clipboard.writeText(fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectExample = (request: string) => {
    setUserTask(request);
  };

  const displayedExamples = showAllExamples ? promptExamples : promptExamples.slice(0, 1);

  return (
    <Modal
      isOpen={isAiPromptModalOpen}
      onClose={() => setIsAiPromptModalOpen(false)}
      title={t.aiPromptModal.title}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] text-[var(--muted)]">
            {userTask.trim()
              ? t.aiPromptModal.readyToCopy
              : t.aiPromptModal.describeTaskHint}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAiPromptModalOpen(false)}
            >
              {t.actions.close}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopy}
              disabled={!userTask.trim()}
            >
              <i className={copied ? 'ri-check-line mr-1' : 'ri-file-copy-line mr-1'} />
              <span>{copied ? t.aiPromptModal.copied : t.aiPromptModal.copyPrompt}</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* User Description Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none block">
            {t.aiPromptModal.inputLabel} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={userTask}
            onChange={e => setUserTask(e.target.value)}
            rows={3}
            placeholder={t.aiPromptModal.inputPlaceholder}
            className="w-full bg-[var(--muted-bg)] text-xs text-[var(--foreground)] border border-[var(--border)] rounded-lg p-2.5 focus:outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10 placeholder:text-[var(--muted)] resize-none"
            autoFocus
          />
        </div>

        {/* Examples Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.aiPromptModal.examplesTitle}
            </span>
            <button
              type="button"
              onClick={() => setShowAllExamples(!showAllExamples)}
              className="text-[11px] text-red-500 hover:text-red-600 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{showAllExamples ? t.aiPromptModal.showLess : t.aiPromptModal.showMore}</span>
              <i className={showAllExamples ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
            </button>
          </div>

          <div className="space-y-1.5">
            {displayedExamples.map((ex, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectExample(ex.request)}
                className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--sidebar-primary)] hover:border-red-500/40 hover:bg-[var(--muted-bg)] transition-all cursor-pointer group flex items-start justify-between gap-3 text-left"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11.5px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
                    <i className="ri-sparkling-2-line text-xs text-red-500" />
                    <span>{ex.title}</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] truncate">
                    "{ex.request}"
                  </p>
                </div>
                <span className="text-[10.5px] text-red-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5">
                  {t.aiPromptModal.useExample}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Master Prompt Output Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.aiPromptModal.previewTitle}
            </label>
            <span className="text-[10px] text-[var(--muted)] font-mono">
              {t.aiPromptModal.variablesSupported}
            </span>
          </div>

          <div className="relative rounded-lg border border-[var(--border)] bg-[var(--sidebar-primary)] p-3 text-[11px] font-mono text-[var(--foreground)]/80 max-h-48 overflow-y-auto leading-relaxed">
            <pre className="whitespace-pre-wrap font-mono">{fullPrompt}</pre>
          </div>
        </div>
      </div>
    </Modal>
  );
};
