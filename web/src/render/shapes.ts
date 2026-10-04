/** Adds a rounded rectangle to the current path (falls back to arcTo where roundRect is missing: Safari < 16). */
export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A capsule lying along +x, centred on the origin. */
export function capsulePath(ctx: CanvasRenderingContext2D, length: number, radius: number): void {
  const half = length / 2 - radius;
  ctx.moveTo(-half, -radius);
  ctx.lineTo(half, -radius);
  ctx.arc(half, 0, radius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-half, radius);
  ctx.arc(-half, 0, radius, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

/** A chevron pointing along +x with its tip on the origin (stroke it). */
export function chevronPath(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.moveTo(-size * 0.5, -size * 0.6);
  ctx.lineTo(0, 0);
  ctx.lineTo(-size * 0.5, size * 0.6);
}
