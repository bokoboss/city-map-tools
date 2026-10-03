import assert from 'node:assert/strict';
import { arrowCounts, buildDisplayPath, MOVEMENT_LIMITS, sampleDisplayPath, snapshotInputs } from '../src/map/directionalPath';
import { createDirectionalClock } from '../src/map/directionalClock';

const input = {
  id: 'test', coordinates: [[100, 13], [100.001, 13], [100.001, 13.001]] as const,
  direction: 'forward' as const, color: '#3388cc', opacity: 1, lineWidthPixels: 3,
  arrowSizePixels: 24, arrowSpacingPixels: 64, animationEnabled: true,
  visualRatePixelsPerSecond: 32, displayOffsetPixels: 12,
};
const frozen = JSON.stringify(input);
const snapshots = snapshotInputs([input, { ...input, id: 'reverse', direction: 'reverse' }]);
assert.deepEqual(snapshots[0]!.coordinates, snapshots[1]!.coordinates);
assert.notEqual(snapshots[0]!.coordinates, input.coordinates);
const path = buildDisplayPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 0);
assert.deepEqual(sampleDisplayPath(path, 25, 'forward'), { x: 25, y: 0, bearing: 90 });
assert.deepEqual(sampleDisplayPath(path, 25, 'reverse'), { x: 100, y: 75, bearing: 0 });
assert.deepEqual(sampleDisplayPath(path, 125, 'forward'), { x: 100, y: 25, bearing: 180 });
assert.deepEqual(sampleDisplayPath(path, 200, 'reverse'), { x: 0, y: 0, bearing: 270 });
const shifted = buildDisplayPath(path.points, 12);
assert.deepEqual(shifted.points, [{ x: 0, y: 12 }, { x: 88, y: 12 }, { x: 88, y: 100 }]);
for (const distance of [0, 12, 75, 120, shifted.length]) {
  const forward = sampleDisplayPath(shifted, distance, 'forward');
  const reverse = sampleDisplayPath(shifted, shifted.length - distance, 'reverse');
  assert.equal(forward.x, reverse.x); assert.equal(forward.y, reverse.y);
  assert.equal((forward.bearing + 180) % 360, reverse.bearing);
}
const curved = buildDisplayPath([{ x: 0, y: 0 }, { x: 40, y: 10 }, { x: 70, y: 40 }, { x: 80, y: 80 }], -10);
const uturn = buildDisplayPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 120, y: 20 }, { x: 100, y: 40 }, { x: 0, y: 40 }], 10);
for (const fixture of [curved, uturn]) for (let d = 0; d <= fixture.length; d += 2) {
  const sample = sampleDisplayPath(fixture, d, 'forward');
  assert.ok([sample.x, sample.y, sample.bearing].every(Number.isFinite));
  const reverse = sampleDisplayPath(fixture, fixture.length - d, 'reverse');
  assert.ok(Math.abs(sample.x - reverse.x) < 1e-10 && Math.abs(sample.y - reverse.y) < 1e-10);
}
assert.equal(sampleDisplayPath(uturn, uturn.length - 1, 'forward').bearing, 270);
const hairpin = buildDisplayPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }], 12);
assert.equal(hairpin.points.length, 4); // finite bounded bevel at an exact reversal
assert.equal(buildDisplayPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }], 0).length, 10);
assert.throws(() => buildDisplayPath([{ x: 0, y: 0 }, { x: 0, y: 0 }], 0));
assert.throws(() => buildDisplayPath([{ x: NaN, y: 0 }], 0));
assert.throws(() => sampleDisplayPath(path, NaN, 'forward'));
for (const bad of [
  { ...input, opacity: NaN }, { ...input, displayOffsetPixels: 65 }, { ...input, direction: 'sideways' },
  { ...input, coordinates: [[180, 0], [-180, 0]] }, { ...input, coordinates: [[0, 90], [0, 89]] },
  { ...input, coordinates: [[0, 0], [NaN, 0]] }, { ...input, coordinates: Array.from({ length: 1001 }, (_, i) => [i / 10000, 0]) },
]) assert.throws(() => snapshotInputs([bad as typeof input]));
assert.throws(() => snapshotInputs([input, input]));
assert.throws(() => snapshotInputs(Array.from({ length: 25 }, (_, i) => ({ ...input, id: String(i) }))));
const huge = buildDisplayPath([{ x: 0, y: 0 }, { x: 1e7, y: 0 }], 0);
const budget = arrowCounts(Array.from({ length: 24 }, () => huge), Array(24).fill(24));
assert.equal(budget.limited, true);
assert.ok(budget.counts.every(n => n > 0));
assert.ok(budget.counts.reduce((a, b) => a + b, 0) <= MOVEMENT_LIMITS.arrows);
assert.deepEqual(arrowCounts([path], [64]), { counts: [4], limited: false });
assert.equal(snapshots[0]!.displayOffsetPixels, 12);
assert.equal(JSON.stringify(input), frozen);

// Fake monotonic RAF runtime proves a single loop, throttling, absolute phase and frozen pause time.
let now = 0;
let serial = 0;
const callbacks = new Map<number, (time: number) => void>();
const updates: number[] = [];
const clock = createDirectionalClock({ now: () => now, request: callback => { callbacks.set(++serial, callback); return serial; }, cancel: id => { callbacks.delete(id); } }, elapsed => updates.push(elapsed));
function frame(time: number) {
  now = time;
  const queued = [...callbacks.values()]; callbacks.clear(); queued.forEach(callback => callback(time));
  assert.ok(callbacks.size <= 1);
}
clock.resume(); clock.resume();
for (let t = 10; t <= 1000; t += 10) frame(t);
assert.equal(updates.length, 25);
assert.equal(updates.at(-1), 1000);
frame(9000); // one skipped-frame update, no burst
assert.equal(updates.length, 26); assert.equal(updates.at(-1), 9000);
clock.pause(); assert.equal(callbacks.size, 0);
now = 100000; clock.resume(); clock.resume(); frame(100040);
assert.equal(updates.at(-1), 9040);
clock.destroy(); clock.resume(); frame(100100);
assert.equal(callbacks.size, 0); assert.equal(clock.diagnostics().running, false);
console.log('PASS directional forward/reverse, curves/U-turns, local bearings, display tracks, finite degeneracy, immutable bounded inputs and arrow budgets');
console.log('PASS single 25Hz clock, skipped-frame absolute phase, pause/resume and destroy');
