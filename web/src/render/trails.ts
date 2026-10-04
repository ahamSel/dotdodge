export interface TrailSample {
  x: number;
  y: number;
  t: number;
}

export interface TrailSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 0 at the old end, 1 at the newest point. */
  k: number;
}

/** The trail's segments younger than maxAge, oldest first. */
export function trailSegments(samples: TrailSample[], now: number, maxAge: number): TrailSegment[] {
  const out: TrailSegment[] = [];
  const from = now - maxAge;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a.t < from) continue;
    out.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, k: Math.max(0, Math.min(1, (b.t - from) / maxAge)) });
  }
  return out;
}

export interface Trail {
  push(x: number, y: number, now: number): void;
  /** A tapered, fading stroke: full `width` and opacity at the head. */
  draw(ctx: CanvasRenderingContext2D, now: number, maxAge: number, width: number, color: string): void;
  clear(): void;
}

const KEEP = 1.2; // seconds of samples kept, longer than any trail drawn

export function createTrail(): Trail {
  let samples: TrailSample[] = [];
  return {
    push(x, y, now) {
      samples.push({ x, y, t: now });
      while (samples.length > 2 && samples[0].t < now - KEEP) samples.shift();
    },
    draw(ctx, now, maxAge, width, color) {
      const segs = trailSegments(samples, now, maxAge);
      if (segs.length === 0) return;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      for (const s of segs) {
        ctx.globalAlpha = s.k * 0.85;
        ctx.lineWidth = Math.max(0.01, width * s.k);
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      samples = [];
    },
  };
}
