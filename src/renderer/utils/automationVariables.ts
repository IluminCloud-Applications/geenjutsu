/**
 * Extracts unique variable placeholders like {{email}}, {{senha}} from script code
 */
export function extractVariables(code: string): string[] {
  if (!code) return [];
  const regex = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    if (match[1]) {
      matches.add(match[1].trim());
    }
  }
  return Array.from(matches);
}

/**
 * Replaces all occurrences of {{key}} with provided values in code
 */
export function substituteVariables(code: string, values: Record<string, string>): string {
  if (!code) return '';
  let result = code;
  for (const [key, val] of Object.entries(values)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g');
    result = result.replace(regex, val ?? '');
  }
  return result;
}

/**
 * Cleans code pasted from LLMs (removes markdown backticks, replaces LaTeX escapes like \vert with ||, etc.)
 */
export function sanitizeAutomationCode(rawCode: string): string {
  if (!rawCode) return '';
  let cleaned = rawCode.trim();

  // Strip or extract markdown code fences if wrapped in ```js, ```javascript, ```
  const codeBlockMatch = cleaned.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n?```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }

  // Replace markdown links pasted accidentally into strings (e.g. '[https://url](https://url)' -> 'https://url')
  cleaned = cleaned.replace(/\[\s*([^\]]+)\s*\]\(\s*(https?:\/\/[^\)\s]+)\s*\)/g, '$2');

  // Replace LaTeX vertical bar escapes produced by some LLMs for || and |
  cleaned = cleaned.replace(/\\vert\{\}\\vert\{\}/g, '||');
  cleaned = cleaned.replace(/\\vert\{\}/g, '|');
  cleaned = cleaned.replace(/\\vert/g, '|');

  // Replace non-breaking spaces or zero-width spaces
  cleaned = cleaned.replace(/\u00A0/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');

  return cleaned;
}
