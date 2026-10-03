import { MOVEMENT_LIMITS } from './directionalPath';

export interface AnimationRuntime {
  now(): number;
  request(callback: (time: number) => void): number;
  cancel(id: number): void;
}

/** One scheduler, absolute elapsed time, no catch-up iterations. Pauses freeze presentation phase. */
export function createDirectionalClock(runtime: AnimationRuntime, update: (elapsedMs: number) => void) {
  let token: number | null = null;
  let started: number | null = null;
  let elapsed = 0;
  let lastUpdate = -Infinity;
  let destroyed = false;
  let updates = 0;
  const tick = (time: number) => {
    token = null;
    if (started === null || destroyed) return;
    if (time - lastUpdate >= MOVEMENT_LIMITS.updateIntervalMs) {
      lastUpdate = time;
      updates++;
      update(elapsed + Math.max(0, time - started));
    }
    if (started !== null && !destroyed) token = runtime.request(tick);
  };
  const pause = () => {
    if (started !== null) elapsed += Math.max(0, runtime.now() - started);
    started = null;
    if (token !== null) runtime.cancel(token);
    token = null;
  };
  return {
    pause,
    resume() {
      if (destroyed || started !== null) return;
      started = runtime.now();
      lastUpdate = started;
      token = runtime.request(tick);
    },
    elapsed: () => elapsed + (started === null ? 0 : Math.max(0, runtime.now() - started)),
    diagnostics: () => ({ running: started !== null, pendingFrames: token === null ? 0 : 1, updates }),
    destroy() { pause(); destroyed = true; },
  };
}
