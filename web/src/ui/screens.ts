import { describeRun } from '../best';
import { CONFIG } from '../game/config';
import { countdownShown } from '../game/schedule';
import type { World } from '../game/types';
import type { View } from '../render/view';

export type ScreenName = 'title' | 'options' | 'playing' | 'paused' | 'gameover' | 'congrats';
export type UIAction = 'play' | 'options' | 'back' | 'pause' | 'resume' | 'restart' | 'menu' | 'slowmo' | 'toggleMute';

export interface UI {
  show(name: ScreenName): void;
  onAction(handler: (action: UIAction) => void): void;
  onVolume(handler: (kind: 'music' | 'sfx', value: number) => void): void;
  onHover(handler: () => void): void;
  /** Publishes the arena rectangle so the HUD hangs off it. */
  layout(view: View): void;
  hud(world: World, touch: boolean): void;
  banner(text: string): void;
  pulseTimer(): void;
  gameOver(seconds: number, best: number, isNew: boolean): void;
  setBest(best: number): void;
  setVolumes(music: number, sfx: number): void;
  setMuted(muted: boolean): void;
  /** Closes an iris over the screen, calls `onCovered`, then opens it again. */
  iris(onCovered: () => void, fast?: boolean): void;
}

const POP: Keyframe[] = [{ transform: 'translateX(-50%) scale(1.3)' }, { transform: 'translateX(-50%) scale(1)' }];

/** The 2020 start-screen "sun": the dot with the seven missiles flying outward. */
function logoSvg(): string {
  const rays = CONFIG.missiles
    .map((m, i) => {
      const a = (-90 + (i * 360) / CONFIG.missiles.length).toFixed(1);
      return (
        `<g transform="rotate(${a})"><g class="ray" style="--i:${i}">` +
        `<line x1="24" y1="-4" x2="31" y2="-4"/><line x1="20" y1="0" x2="31" y2="0"/><line x1="25" y1="4" x2="31" y2="4"/>` +
        `<rect class="cap" x="36" y="-6" width="28" height="12" rx="6" fill="${m.color}"/></g></g>`
      );
    })
    .join('');
  return `<svg viewBox="-80 -80 160 160" aria-hidden="true"><g class="spin">${rays}<circle class="dot" r="17" fill="#fff"/></g></svg>`;
}

export function createUI(root: HTMLElement): UI {
  const bind = (name: string) => {
    const el = root.querySelector<HTMLElement>(`[data-bind="${name}"]`);
    if (!el) throw new Error(`missing [data-bind="${name}"]`);
    return el;
  };
  const screens = Array.from(root.querySelectorAll<HTMLElement>('[data-screen]'));
  const timer = bind('timer');
  const stage = bind('stage');
  const slowmo = bind('slowmo');
  const slowmoFill = bind('slowmoFill');
  const slowmoBtn = bind('slowmoBtn');
  const banner = bind('banner');
  const titleBest = bind('titleBest');
  const goRun = bind('goRun');
  const goBest = bind('goBest');
  const goNew = bind('goNew');
  const iris = bind('iris');
  const music = root.querySelector<HTMLInputElement>('input[data-volume="music"]')!;
  const sfx = root.querySelector<HTMLInputElement>('input[data-volume="sfx"]')!;
  const muteBtn = root.querySelector<HTMLElement>('[data-action="toggleMute"]')!;
  bind('logo').innerHTML = logoSvg();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let onAction: (action: UIAction) => void = () => {};
  let onVolume: (kind: 'music' | 'sfx', value: number) => void = () => {};
  let onHover: () => void = () => {};

  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;
    btn.blur();
    onAction(btn.dataset.action as UIAction);
  });
  let hovered: Element | null = null;
  root.addEventListener('pointerover', (e) => {
    const btn = (e.target as Element).closest('button');
    if (btn && btn !== hovered && e.pointerType === 'mouse') onHover();
    hovered = btn;
  });
  for (const input of [music, sfx]) {
    input.addEventListener('input', () => onVolume(input.dataset.volume as 'music' | 'sfx', Number(input.value) / 100));
  }

  const shown = { timer: -1, urgent: false, stage: 0, unlocked: false, btn: false, active: false, meter: -1 };
  let irisBusy = false;

  return {
    show(name) {
      for (const el of screens) el.classList.toggle('is-visible', el.dataset.screen!.split(' ').includes(name));
    },

    onAction(h) {
      onAction = h;
    },
    onVolume(h) {
      onVolume = h;
    },
    onHover(h) {
      onHover = h;
    },

    layout(v) {
      const s = root.style;
      s.setProperty('--ax', `${v.x}px`);
      s.setProperty('--ay', `${v.y}px`);
      s.setProperty('--aw', `${v.w}px`);
      s.setProperty('--ah', `${v.h}px`);
    },

    hud(world, touch) {
      const n = countdownShown(world.elapsed);
      if (n !== shown.timer) {
        timer.textContent = String(n);
        shown.timer = n;
      }
      const urgent = n <= 10 && world.phase === 'running';
      if (urgent !== shown.urgent) {
        timer.classList.toggle('urgent', urgent);
        shown.urgent = urgent;
      }
      if (world.stage !== shown.stage) {
        stage.textContent = `Stage ${world.stage}`;
        shown.stage = world.stage;
      }
      const unlocked = world.stage >= 6 && world.phase === 'running';
      if (unlocked !== shown.unlocked) {
        slowmo.classList.toggle('is-on', unlocked);
        shown.unlocked = unlocked;
      }
      const btn = unlocked && touch;
      if (btn !== shown.btn) {
        slowmoBtn.classList.toggle('is-on', btn);
        shown.btn = btn;
      }
      const active = world.slowmo.active;
      if (active !== shown.active) {
        slowmo.classList.toggle('is-active', active);
        slowmoBtn.classList.toggle('is-active', active);
        shown.active = active;
      }
      const meter = Math.round((world.slowmo.meter / CONFIG.slowmo.capacity) * 100) / 100;
      if (meter !== shown.meter) {
        slowmoFill.style.transform = `scaleX(${meter})`;
        shown.meter = meter;
      }
    },

    banner(text) {
      banner.textContent = text;
      banner.classList.remove('is-playing');
      void banner.offsetWidth; // restart the animation
      banner.classList.add('is-playing');
    },

    pulseTimer() {
      timer.animate?.(POP, { duration: 260, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    },

    gameOver(seconds, best, isNew) {
      goRun.textContent = `Survived ${describeRun(seconds)}`;
      goBest.textContent = `Best ${describeRun(best)}`;
      goNew.classList.toggle('is-on', isNew);
    },

    setBest(best) {
      titleBest.textContent = best <= 0 ? '' : best >= CONFIG.countdown ? describeRun(best) : `Best ${describeRun(best)}`;
    },

    setVolumes(m, s) {
      music.value = String(Math.round(m * 100));
      sfx.value = String(Math.round(s * 100));
    },

    setMuted(m) {
      muteBtn.textContent = m ? 'Sound: off' : 'Sound: on';
      muteBtn.setAttribute('aria-pressed', String(m));
    },

    iris(onCovered, fast = false) {
      if (irisBusy || typeof iris.animate !== 'function') {
        onCovered();
        return;
      }
      irisBusy = true;
      iris.classList.add('is-on');
      const frames: Keyframe[] = reduced
        ? [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }]
        : [{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(1)' }];
      const close = iris.animate(frames, { duration: fast ? 220 : 380, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
      close.onfinish = () => {
        onCovered();
        const open = iris.animate([...frames].reverse(), {
          duration: fast ? 260 : 440,
          delay: 60,
          easing: 'cubic-bezier(.25,1,.5,1)',
          fill: 'forwards',
        });
        open.onfinish = () => {
          iris.classList.remove('is-on');
          irisBusy = false;
        };
      };
    },
  };
}
