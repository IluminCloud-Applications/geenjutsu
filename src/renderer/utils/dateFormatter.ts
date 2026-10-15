/**
 * Formats profile creation date:
 * - Today: "Hoje"
 * - Yesterday: "Ontem"
 * - Older: "dd/mm/yyyy" (e.g. 28/02/2026)
 */
export function formatCreatedDate(timestamp?: number | string | null): string {
  if (!timestamp) return 'Hoje';
  const date = new Date(Number(timestamp));
  if (isNaN(date.getTime())) return 'Hoje';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Hoje';
  } else if (diffDays === 1) {
    return 'Ontem';
  } else {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }
}

/**
 * Formats profile last opened / used time:
 * - If running: "Agora"
 * - If never opened: "Nunca"
 * - Less than 1 minute ago: "Agora"
 * - Less than 60 minutes ago: "Há X min" (e.g. "Há 5 min")
 * - Earlier today (60m+): "Hoje às HH:mm" (e.g. "Hoje às 14:30")
 * - Yesterday: "Ontem às HH:mm"
 * - Older: "dd/mm/yyyy" (e.g. 28/02/2026)
 */
export function formatLastOpenedDate(
  timestamp?: number | string | null,
  isRunning?: boolean
): string {
  if (isRunning) return 'Agora';
  if (!timestamp) return 'Nunca';

  const date = new Date(Number(timestamp));
  if (isNaN(date.getTime())) return 'Nunca';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'Agora';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'Agora';
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  if (diffDays === 0) {
    return `Hoje às ${hours}:${minutes}`;
  } else if (diffDays === 1) {
    return `Ontem às ${hours}:${minutes}`;
  } else {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }
}
