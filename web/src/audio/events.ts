import type { SimEvent } from '../game/types';
import type { SfxName } from './sfx';

/** Which sound (and variant) a sim event makes, or null for silence. */
export function soundForEvent(e: SimEvent): [SfxName, number] | null {
  switch (e.type) {
    case 'blink':
      return ['blink', e.n];
    case 'launch':
      return ['launch', 0];
    case 'stage':
      return ['stage', 0];
    case 'bounce':
      return ['bounce', e.speed];
    case 'nearMiss':
      return ['whoosh', 0];
    case 'fire':
      return ['cannon', 0];
    case 'slowmo':
      return [e.on ? 'slowIn' : 'slowOut', 0];
    case 'tick':
      return ['tick', e.remaining];
    case 'death':
      return ['gotcha', 0];
    case 'win':
      return ['fanfare', 0];
    case 'warn':
      return null;
  }
}
