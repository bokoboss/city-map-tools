import assert from 'node:assert/strict';
import { layoutDirectionalPaths, LAYOUT_POLICY, type LayoutInput } from '../src/map/directionalLayout';
import { buildDisplayPath, sampleDisplayPath, snapshotInputs } from '../src/map/directionalPath';

const input = (id: string, xy: number[][], extra: Partial<LayoutInput> = {}): LayoutInput => ({ id, points: xy.map(([x, y]) => ({ x: x!, y: y! })), baseOffset: 0, ...extra });
const point = (result: ReturnType<typeof layoutDirectionalPaths>, id: string, distance: number) => sampleDisplayPath(result.paths.get(id)!, distance, 'forward');
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const fixtures: string[] = [];
function check(name: string, action: () => void) { action(); fixtures.push(name); }

check('same-direction shared approach then divergence; partial offsets and smooth 40px taper', () => {
  const source = [input('a', [[0, 0], [240, 0], [240, -160]]), input('b', [[0, 0], [400, 0]])];
  const before = JSON.stringify(source), result = layoutDirectionalPaths(source);
  assert.equal(result.diagnostics.sharedRuns, 1);
  near(point(result, 'a', 80).y, -7); near(point(result, 'b', 80).y, 7);
  const b = result.paths.get('b')!.points;
  near(b.find(p => p.x === 200)!.y, 7);
  assert.ok(b.find(p => p.x === 216)!.y > 0 && b.find(p => p.x === 216)!.y < 7);
  near(b.find(p => p.x === 240)!.y, 0);
  near(b.find(p => p.x === 320)!.y, 0);
  near(result.paths.get('a')!.points.at(-1)!.x, 240);
  assert.equal(JSON.stringify(source), before);
});
check('three-way left/through/U-turn approach, deterministic centered slots', () => {
  const result = layoutDirectionalPaths([
    input('c', [[0, 0], [240, 0], [280, 40], [240, 80], [0, 80]]),
    input('b', [[0, 0], [400, 0]]), input('a', [[0, 0], [240, 0], [240, -160]]),
  ]);
  assert.equal(result.diagnostics.sharedRuns, 3);
  near(point(result, 'a', 80).y, -14); near(point(result, 'b', 80).y, 0); near(point(result, 'c', 80).y, 14);
});
check('opposite canonical directions occupy common stable frame', () => {
  const result = layoutDirectionalPaths([input('a', [[0, 0], [240, 0]]), input('b', [[240, 0], [0, 0]])]);
  near(point(result, 'a', 80).y, -7); near(point(result, 'b', 80).y, 7);
});
check('staggered bundle membership tapers surviving tracks instead of jumping', () => {
  const result = layoutDirectionalPaths([input('a', [[0, 0], [400, 0]]), input('b', [[0, 0], [400, 0]]), input('c', [[0, 0], [240, 0], [240, 120]])]);
  const a = result.paths.get('a')!.points;
  assert.ok(Math.abs(a.find(p => p.x === 240)!.y) < 2);
  near(a.find(p => p.x === 248)!.y, 0); near(a.find(p => p.x === 256)!.y, 0);
  near(a.find(p => p.x === 320)!.y, -7);
  for (let i = 1; i < a.length; i++) assert.ok(Math.abs(a[i]!.y - a[i - 1]!.y) < 5);
});
check('downstream merge has symmetric entry taper and zero upstream displacement', () => {
  const result = layoutDirectionalPaths([input('a', [[0, -160], [160, 0], [400, 0]]), input('b', [[0, 0], [400, 0]])]);
  const b = result.paths.get('b')!.points;
  near(b.find(p => p.x === 80)!.y, 0); near(b.find(p => p.x === 240)!.y, 7);
  assert.ok(b.find(p => p.x === 184)!.y > 0 && b.find(p => p.x === 184)!.y < 7);
});
check('curved shared corridor and local bearings are finite and separated', () => {
  const xy = [[0, 0], [80, 0], [160, 24], [220, 80], [240, 160]];
  const result = layoutDirectionalPaths([input('a', xy), input('b', xy)]);
  assert.ok(result.diagnostics.sharedRuns > 0);
  for (const id of ['a', 'b']) for (const p of result.paths.get(id)!.points) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.ok(point(result, 'a', 140).y < point(result, 'b', 140).y);
});
check('U-turn alongside through movement leaves return leg untouched', () => {
  const result = layoutDirectionalPaths([input('a', [[0, 0], [240, 0], [280, 40], [240, 80], [0, 80]]), input('b', [[0, 0], [400, 0]])]);
  assert.equal(result.diagnostics.sharedRuns, 1);
  near(result.paths.get('a')!.points.at(-1)!.y, 80);
});
check('true crossing preserved byte-for-byte with no invented bridge or gap', () => {
  for (const angle of [30, 60, 90]) {
    const dy = Math.tan(angle * Math.PI / 180) * 120;
    const source = [input('a', [[0, 0], [240, 0]]), input('b', angle === 90 ? [[120, -120], [120, 120]] : [[0, -dy], [240, dy]])];
    const result = layoutDirectionalPaths(source);
    assert.equal(result.diagnostics.sharedRuns, 0);
    source.forEach(i => assert.deepEqual(result.paths.get(i.id), buildDisplayPath(i.points, 0)));
  }
});
check('already-distinct parallels outside 12px threshold untouched', () => {
  const source = [input('a', [[0, 0], [240, 0]]), input('b', [[0, 12.01], [240, 12.01]])];
  const result = layoutDirectionalPaths(source); assert.equal(result.diagnostics.sharedRuns, 0);
  source.forEach(i => assert.deepEqual(result.paths.get(i.id), buildDisplayPath(i.points, 0)));
});
check('short tangency, near touch and 40px shared run do not classify', () => {
  for (const xy of [[[100, 0], [140, 0]], [[80, 80], [120, 0], [160, 80]]]) {
    const result = layoutDirectionalPaths([input('a', [[0, 0], [240, 0]]), input('b', xy)]);
    assert.equal(result.diagnostics.sharedRuns, 0);
  }
});
check('near-identical centerlines align on 14px track centers', () => {
  const result = layoutDirectionalPaths([input('a', [[0, 0], [240, 0]]), input('b', [[0, 10], [240, 10]])]);
  near(point(result, 'a', 80).y, -7); near(point(result, 'b', 80).y, 7);
});
check('pan/zoom and input order preserve stable movement ordering', () => {
  for (const scale of [0.75, 1, 2]) for (const pan of [-500, 0, 800]) {
    const result = layoutDirectionalPaths([input('b', [[pan, 20], [pan + 240 * scale, 20]]), input('a', [[pan, 20], [pan + 240 * scale, 20]])]);
    near(point(result, 'a', 80).y, 13); near(point(result, 'b', 80).y, 27);
  }
});
check('manual order/base offset, disable-auto, and explicit T1A offsets remain transient', () => {
  const a = input('a', [[0, 0], [240, 0]], { layoutOrder: 2, baseOffset: 20, autoLayout: true });
  const b = input('b', [[0, 0], [240, 0]], { layoutOrder: 1 });
  const result = layoutDirectionalPaths([a, b]);
  near(point(result, 'a', 80).y, 27); near(point(result, 'b', 80).y, -7);
  const disabled = layoutDirectionalPaths([{ ...a, autoLayout: false }, b]);
  assert.equal(disabled.diagnostics.sharedRuns, 0); near(point(disabled, 'a', 80).y, 20);
  const explicit = layoutDirectionalPaths([{ ...a, autoLayout: undefined }, b]);
  assert.equal(explicit.diagnostics.sharedRuns, 0);
});
check('ambiguous folded and non-common proximity chains return warnings', () => {
  const chain = layoutDirectionalPaths([input('a', [[0, 0], [240, 0]]), input('b', [[0, 10], [240, 10]]), input('c', [[0, 20], [240, 20]])]);
  assert.ok(chain.diagnostics.warnings.some(w => w.includes('Ambiguous')));
  const folded = layoutDirectionalPaths([input('a', [[0, 0], [240, 0]]), input('b', [[0, 0], [240, 0], [0, 0]])]);
  assert.ok(folded.diagnostics.warnings.some(w => w.includes('folded')));
});
check('canonical WGS84 snapshot and Forward/Reverse leave display sides unchanged', () => {
  const common = { coordinates: [[100, 13], [100.001, 13]] as const, color: '#0077cc', opacity: 1, lineWidthPixels: 3, arrowSizePixels: 24,
    arrowSpacingPixels: 64, animationEnabled: true, visualRatePixelsPerSecond: 32, displayOffsetPixels: 0 };
  const forward = snapshotInputs([{ ...common, id: 'a', direction: 'forward' }, { ...common, id: 'b', direction: 'forward' }]);
  const before = JSON.stringify(forward);
  const layout = () => layoutDirectionalPaths(forward.map(i => input(i.id, [[0, 0], [240, 0]])));
  const first = layout(); forward[0]!.direction = 'reverse'; const second = layout();
  assert.deepEqual(first.paths, second.paths);
  const p = first.paths.get('a')!;
  for (const d of [0, 32, 80, p.length]) {
    const f = sampleDisplayPath(p, d, 'forward'), r = sampleDisplayPath(p, p.length - d, 'reverse');
    near(f.x, r.x); near(f.y, r.y);
  }
  forward[0]!.direction = 'forward'; assert.equal(JSON.stringify(forward), before);
});
check('sample and candidate workload caps decline atomically and deterministically', () => {
  const huge = [input('a', [[0, 0], [1e7, 0]]), input('b', [[0, 0], [1e7, 0]])];
  const overSample = layoutDirectionalPaths(huge);
  assert.equal(overSample.diagnostics.fallback, true); assert.equal(overSample.diagnostics.sampleCount, 0);
  const dense = Array.from({ length: 24 }, (_, i) => input(String(i).padStart(2, '0'), [[0, 0], [2400, 0]]));
  const overCandidates = layoutDirectionalPaths(dense);
  assert.equal(overCandidates.diagnostics.fallback, true);
  assert.equal(overCandidates.diagnostics.candidateChecks, LAYOUT_POLICY.maxCandidateChecks);
  assert.ok(overCandidates.diagnostics.sampleCount <= LAYOUT_POLICY.maxSamples);
  assert.ok(overCandidates.diagnostics.profileChecks <= LAYOUT_POLICY.maxProfileChecks);
  dense.forEach(i => assert.deepEqual(overCandidates.paths.get(i.id), buildDisplayPath(i.points, 0)));
  assert.deepEqual(layoutDirectionalPaths(dense).diagnostics, overCandidates.diagnostics);
  assert.ok(overCandidates.diagnostics.warnings.length <= LAYOUT_POLICY.maxWarnings + 1);
  const profile = Array.from({ length: 24 }, (_, i) => input(String(i).padStart(2, '0'), [[0, 0], [80, 0]]));
  const overProfile = layoutDirectionalPaths(profile);
  assert.equal(overProfile.diagnostics.fallback, true);
  assert.equal(overProfile.diagnostics.profileChecks, LAYOUT_POLICY.maxProfileChecks);
  assert.ok(overProfile.diagnostics.candidateChecks < LAYOUT_POLICY.maxCandidateChecks);
  profile.forEach(i => assert.deepEqual(overProfile.paths.get(i.id), buildDisplayPath(i.points, 0)));
  const warningHeavy = layoutDirectionalPaths([input('a', [[0, 0], [1600, 0]]), input('b', [[0, 0], [1600, 0], [0, 0]])]);
  assert.equal(warningHeavy.diagnostics.warnings.length, LAYOUT_POLICY.maxWarnings);
  assert.ok(warningHeavy.diagnostics.suppressedWarnings > 0);
});
const valid = { id: 'valid', coordinates: [[100, 13], [100.001, 13]] as const, direction: 'forward' as const, color: '#0077cc', opacity: 1,
  lineWidthPixels: 3, arrowSizePixels: 24, arrowSpacingPixels: 64, animationEnabled: true, visualRatePixelsPerSecond: 32, displayOffsetPixels: 0 };
assert.throws(() => snapshotInputs([{ ...valid, layoutOrder: NaN }]));
assert.throws(() => snapshotInputs([{ ...valid, layoutOrder: 1e6 + 1 }]));
assert.throws(() => snapshotInputs([{ ...valid, autoLayout: 'yes' as any }]));
fixtures.forEach(name => console.log(`PASS T1B ${name}`));
