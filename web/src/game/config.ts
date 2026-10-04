/** Every tuning number and colour. World units are the original Unity units (arena 624 × 320). */
export const CONFIG = {
  step: 1 / 60,
  maxFrame: 0.25,
  arena: { hw: 312, hh: 160, corner: 12 },
  /** Outline width in world units (never thinner than 2 CSS px on screen). */
  outline: 2.4,
  countdown: 120,
  /** Countdown-elapsed seconds at which stages 2..6 begin. */
  stages: [17, 37, 57, 80, 97],
  player: {
    radius: 9.6,
    thrust: 1400,
    slowmoThrust: 3000,
    drag: 0.5,
    restitution: 0.55,
    minBounce: 180,
    bounceEventSpeed: 40,
  },
  missile: {
    length: 16,
    radius: 3.5,
    /** Warning length; also the intro (the countdown starts when missile 0 launches). */
    warnTime: 2.75,
    blinks: [0.67, 1.33, 2.0],
    blinkLength: 0.33,
    enterMargin: 8,
    separation: 14,
    nearMiss: 14,
    nearMissRearm: 60,
  },
  /** warnAt: countdown-elapsed seconds when the warning starts (missile 0 warns at world time 0). */
  missiles: [
    { color: '#ffffff', speed: 300, turn: 470, x: -336, y: 0, warnAt: -2.75 },
    { color: '#ec1c24', speed: 400, turn: 550, x: 0, y: 179, warnAt: 17 },
    { color: '#0ed145', speed: 450, turn: 600, x: 336, y: 0, warnAt: 37 },
    { color: '#00a8f3', speed: 500, turn: 640, x: 0, y: -182, warnAt: 57 },
    { color: '#b83dba', speed: 600, turn: 765, x: 331, y: -177, warnAt: 80 },
    { color: '#ffd900', speed: 650, turn: 800, x: -331, y: 174, warnAt: 80 },
    { color: '#ff7f27', speed: 700, turn: 830, x: 332, y: 180, warnAt: 97 },
  ],
  cannon: { startAt: 97, interval: 0.3, arrowSpeed: 70, arrowW: 12, arrowH: 10.7, laneY: 156, x: 319 },
  slowmo: { scale: 0.1, capacity: 5, refill: 0.5, minStart: 0.25 },
  retryDelay: 1.2,
  colors: { frame: '#ff0000', field: '#ffad00', outline: '#000000', player: '#ffffff' },
} as const;
