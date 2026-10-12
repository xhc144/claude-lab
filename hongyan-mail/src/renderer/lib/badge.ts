/** Draws the taskbar overlay badge (Windows) with the unread count. */
export function drawBadge(count: number, dark: boolean): string {
  const size = 32;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d0432a';
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark ? '#121110' : '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  const text = count > 99 ? '99+' : String(count);
  ctx.font = `700 ${text.length > 2 ? 12 : text.length > 1 ? 15 : 18}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2 + 1);
  return c.toDataURL('image/png');
}
