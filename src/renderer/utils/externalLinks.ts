export const SUPPORT_PROJECT_URL = 'https://link.mercadopago.com.br/celiodev';

/**
 * Safely opens an external URL using Electron's shell via geenjutsuApi or fallback to window.open
 */
export function openExternalLink(url: string): void {
  if (!url) return;
  try {
    if (typeof window !== 'undefined' && (window as any).geenjutsuApi?.openExternal) {
      (window as any).geenjutsuApi.openExternal(url);
      return;
    }
  } catch {
    // fallback
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
