import { buildDisplayPath, MOVEMENT_LIMITS, sampleDisplayPath } from './directionalPath';
import type { DisplayPath, DisplayPoint } from './directionalPath';

/** CSS-pixel presentation heuristics, never lane/engineering dimensions. */
export const LAYOUT_POLICY = {
  step: 8, proximity: 12, angleDegrees: 15, minimumRun: 48, spacing: 14, taper: 40,
  cell: 24, maxSamples: 8192, maxCandidateChecks: 131072, maxProfileChecks: 131072, maxWarnings: 64,
} as const;
export interface LayoutInput {
  id: string;
  points: readonly DisplayPoint[];
  baseOffset: number;
  autoLayout?: boolean;
  layoutOrder?: number;
}
interface Sample extends DisplayPoint { distance: number; tx: number; ty: number }
interface Cached { input: LayoutInput; path: DisplayPath; samples: Sample[] }
interface Match { a: number; b: number }
interface Run { a: number; b: number; matches: Match[]; startA: number; endA: number; startB: number; endB: number }
export interface LayoutDiagnostics {
  sampleCount: number; candidateChecks: number; profileChecks: number; localMatches: number; sharedRuns: number;
  warnings: string[]; suppressedWarnings: number; fallback: boolean;
}
const enabled = (input: LayoutInput) => input.autoLayout ?? input.baseOffset === 0;
const compare = (a: LayoutInput, b: LayoutInput) => (a.layoutOrder ?? 0) - (b.layoutOrder ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Pure, bounded projected-space cache. Input order and semantic travel direction do not own track sides. */
export function layoutDirectionalPaths(inputs: readonly LayoutInput[]) {
  if (inputs.length > MOVEMENT_LIMITS.movements || new Set(inputs.map(input => input.id)).size !== inputs.length) throw new Error('Invalid bounded layout inputs.');
  const diagnostics: LayoutDiagnostics = { sampleCount: 0, candidateChecks: 0, profileChecks: 0, localMatches: 0, sharedRuns: 0, warnings: [], suppressedWarnings: 0, fallback: false };
  const warn = (message: string) => {
    if (diagnostics.warnings.includes(message)) return;
    if (diagnostics.warnings.length < LAYOUT_POLICY.maxWarnings) diagnostics.warnings.push(message);
    else diagnostics.suppressedWarnings++;
  };
  const ordered = [...inputs].sort(compare);
  const paths = new Map<string, DisplayPath>();
  const cached: Cached[] = ordered.map(input => {
    if (input.points.length > MOVEMENT_LIMITS.vertices || !Number.isFinite(input.layoutOrder ?? 0)) throw new Error('Invalid bounded layout input.');
    const path = buildDisplayPath(input.points, 0);
    paths.set(input.id, buildDisplayPath(input.points, input.baseOffset));
    return { input, path, samples: [] };
  });
  const fallback = (reason: string) => {
    diagnostics.fallback = true;
    diagnostics.sharedRuns = 0;
    diagnostics.warnings.push(`${reason} Auto-layout declined for: ${ordered.filter(enabled).map(input => input.id).join(', ')}. Use transient manual offsets or a smaller display extent.`);
    return { paths: new Map(cached.map(c => [c.input.id, buildDisplayPath(c.input.points, c.input.baseOffset)])), diagnostics };
  };
  // Preflight the entire allocation, including canonical corners, before sampling long/off-screen paths.
  const needed = cached.reduce((sum, c) => sum + (enabled(c.input) ? Math.ceil(c.path.length / LAYOUT_POLICY.step) + c.path.points.length : 0), 0);
  if (needed > LAYOUT_POLICY.maxSamples) return fallback(`Layout sample budget ${LAYOUT_POLICY.maxSamples} exceeded (${needed} requested).`);
  for (const c of cached) {
    if (!enabled(c.input)) continue;
    const distances = new Set([0, c.path.length, ...c.path.ends]);
    for (let d = LAYOUT_POLICY.step; d < c.path.length; d += LAYOUT_POLICY.step) distances.add(d);
    c.samples = [...distances].sort((a, b) => a - b).map(distance => {
      const p = sampleDisplayPath(c.path, distance, 'forward');
      const angle = p.bearing * Math.PI / 180;
      return { x: p.x, y: p.y, distance, tx: Math.sin(angle), ty: -Math.cos(angle) };
    });
    diagnostics.sampleCount += c.samples.length;
  }
  // Segment midpoints fit in a 24px cell plus its eight neighbors because every segment is <=8px.
  const grid = new Map<string, Array<{ movement: number; segment: number }>>();
  const cellKey = (x: number, y: number) => `${x},${y}`;
  cached.forEach((c, movement) => c.samples.slice(1).forEach((end, segment) => {
    const start = c.samples[segment]!;
    const key = cellKey(Math.floor((start.x + end.x) / 2 / LAYOUT_POLICY.cell), Math.floor((start.y + end.y) / 2 / LAYOUT_POLICY.cell));
    const entries = grid.get(key) ?? []; entries.push({ movement, segment }); grid.set(key, entries);
  }));
  const pairMatches = new Map<string, Array<{ index: number; match: Match | null }>>();
  const threshold = Math.cos(LAYOUT_POLICY.angleDegrees * Math.PI / 180);
  for (let ai = 0; ai < cached.length; ai++) {
    const a = cached[ai]!;
    for (let si = 0; si < a.samples.length; si++) {
      const sample = a.samples[si]!;
      const nearest = new Map<number, { distance: number; along: number; ambiguous: boolean }>();
      const gx = Math.floor(sample.x / LAYOUT_POLICY.cell), gy = Math.floor(sample.y / LAYOUT_POLICY.cell);
      for (let x = gx - 1; x <= gx + 1; x++) for (let y = gy - 1; y <= gy + 1; y++) {
        for (const entry of grid.get(cellKey(x, y)) ?? []) {
          if (diagnostics.candidateChecks === LAYOUT_POLICY.maxCandidateChecks) return fallback(`Layout candidate budget ${LAYOUT_POLICY.maxCandidateChecks} exhausted.`);
          diagnostics.candidateChecks++;
          if (entry.movement <= ai) continue;
          const b = cached[entry.movement]!;
          const start = b.samples[entry.segment]!, end = b.samples[entry.segment + 1]!;
          const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
          if (length < 1e-6 || Math.abs((sample.tx * dx + sample.ty * dy) / length) < threshold - 1e-10) continue;
          const t = Math.max(0, Math.min(1, ((sample.x - start.x) * dx + (sample.y - start.y) * dy) / (length * length)));
          const distance = Math.hypot(sample.x - start.x - t * dx, sample.y - start.y - t * dy);
          if (distance > LAYOUT_POLICY.proximity + 1e-8) continue;
          const along = start.distance + t * (end.distance - start.distance);
          const previous = nearest.get(entry.movement);
          if (!previous || distance < previous.distance - 1e-6) nearest.set(entry.movement, { distance, along, ambiguous: false });
          else if (Math.abs(distance - previous.distance) <= 1e-6 && Math.abs(along - previous.along) > LAYOUT_POLICY.step * 2) previous.ambiguous = true;
        }
      }
      for (const [bi, found] of nearest) {
        const key = `${ai}:${bi}`;
        const matches = pairMatches.get(key) ?? [];
        matches.push({ index: si, match: found.ambiguous ? null : { a: sample.distance, b: found.along } });
        pairMatches.set(key, matches);
        if (found.ambiguous) warn(`Ambiguous folded corridor: ${a.input.id}, ${cached[bi]!.input.id} at ${sample.distance.toFixed(1)} CSS px; sample declined.`);
        else diagnostics.localMatches++;
      }
    }
  }
  const runs: Run[] = [];
  for (const [key, entries] of pairMatches) {
    const [ai, bi] = key.split(':').map(Number) as [number, number];
    const pairRuns: Run[] = [];
    let group: Match[] = [], lastIndex = -2, sign = 0;
    const flush = () => {
      if (group.length > 1) {
        const first = group[0]!, last = group.at(-1)!;
        if (last.a - first.a >= LAYOUT_POLICY.minimumRun - 1e-8 && Math.abs(last.b - first.b) >= LAYOUT_POLICY.minimumRun - 1e-8) {
          pairRuns.push({ a: ai, b: bi, matches: group, startA: first.a, endA: last.a, startB: Math.min(first.b, last.b), endB: Math.max(first.b, last.b) });
        }
      }
      group = []; sign = 0;
    };
    for (const entry of entries) {
      const previous = group.at(-1), next = entry.match;
      const delta = previous && next ? next.b - previous.b : 0;
      const nextSign = Math.abs(delta) > 1e-6 ? Math.sign(delta) : sign;
      if (!next || entry.index !== lastIndex + 1 || (previous && (Math.abs(delta) > next!.a - previous.a + LAYOUT_POLICY.step * 2 || (sign !== 0 && nextSign !== sign)))) flush();
      if (next) { group.push(next); sign = nextSign; }
      lastIndex = entry.index;
    }
    flush();
    // Source runs are disjoint by construction. Their target intervals must also be disjoint:
    // otherwise a folded reference maps the same straight corridor to two different slots.
    const targetOrder = [...pairRuns].sort((a, b) => a.startB - b.startB);
    if (targetOrder.some((run, i) => i > 0 && run.startB < targetOrder[i - 1]!.endB - 1e-8)) {
      warn(`Ambiguous overlapping pair runs: ${cached[ai]!.input.id}, ${cached[bi]!.input.id}; automatic pair layout declined.`);
    } else runs.push(...pairRuns);
  }
  diagnostics.sharedRuns = runs.length;
  const active = (run: Run, movement: number, d: number) => movement === run.a ? d >= run.startA - 1e-8 && d <= run.endA + 1e-8 : movement === run.b && d >= run.startB - 1e-8 && d <= run.endB + 1e-8;
  const mapped = (run: Run, movement: number, d: number) => {
    const from = movement === run.a ? 'a' : 'b', to = from === 'a' ? 'b' : 'a';
    // Binary search works for opposite canonical traversal too.
    const matches = run.matches, ascending = matches.at(-1)![from] >= matches[0]![from];
    let low = 0, high = matches.length - 1;
    while (high - low > 1) { const mid = (low + high) >>> 1; if ((matches[mid]![from] < d) === ascending) low = mid; else high = mid; }
    const a = matches[low]!, b = matches[high]!;
    const t = b[from] === a[from] ? 0 : Math.max(0, Math.min(1, (d - a[from]) / (b[from] - a[from])));
    return a[to] + (b[to] - a[to]) * t;
  };
  // Budget also covers run lookup/bundle validation, not just grid matching.
  const profileBudgetExceeded = Symbol('profile-budget-exceeded');
  const checked = () => {
    if (diagnostics.profileChecks >= LAYOUT_POLICY.maxProfileChecks) throw profileBudgetExceeded;
    diagnostics.profileChecks++; return true;
  };
  try {
    for (let ci = 0; ci < cached.length; ci++) {
      const c = cached[ci]!;
      const relevant = runs.filter(run => checked() && (run.a === ci || run.b === ci));
      if (!relevant.length) continue; // Exact authored/T1A path preserved when no qualifying run exists.
      const signatures: string[] = [];
      const offsets = c.samples.map(sample => {
        const neighbors = relevant.filter(run => checked() && active(run, ci, sample.distance));
        if (!neighbors.length) { signatures.push(''); return c.input.baseOffset; }
        const members = new Map<number, number>([[ci, sample.distance]]);
        for (const run of neighbors) {
          const neighbor = run.a === ci ? run.b : run.a;
          if (members.has(neighbor)) {
            warn(`Ambiguous duplicate corridor correspondence: ${c.input.id}, ${cached[neighbor]!.input.id}; automatic sample declined.`);
            signatures.push(''); return c.input.baseOffset;
          }
          members.set(neighbor, mapped(run, ci, sample.distance));
        }
        const ids = [...members.keys()].sort((a, b) => a - b);
        // A proximity chain is not an obvious common bundle; require every pair to share this local run.
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i]!, b = ids[j]!;
          const run = runs.find(run => checked() && run.a === a && run.b === b && active(run, a, members.get(a)!) && active(run, b, members.get(b)!));
          if (!run) {
            const warning = `Ambiguous non-common bundle: ${ids.map(id => cached[id]!.input.id).join(', ')}; automatic sample declined.`;
            warn(warning);
            signatures.push('');
            return c.input.baseOffset;
          }
        }
        signatures.push(ids.join(':'));
        const reference = cached[ids[0]!]!;
        const p = sampleDisplayPath(reference.path, members.get(ids[0]!)!, 'forward');
        const angle = p.bearing * Math.PI / 180, nx = Math.cos(angle), ny = Math.sin(angle);
        const ownNx = -sample.ty, ownNy = sample.tx;
        const slot = (ids.indexOf(ci) - (ids.length - 1) / 2) * LAYOUT_POLICY.spacing;
        const target = ((p.x - sample.x) * ownNx + (p.y - sample.y) * ownNy) + slot * (nx * ownNx + ny * ownNy);
        return c.input.baseOffset + target;
      });
      // Membership changes also taper: a surviving pair must not jump when a third path leaves.
      for (let first = 0; first < signatures.length;) {
        let last = first;
        while (last + 1 < signatures.length && signatures[last + 1] === signatures[first]) last++;
        if (signatures[first]) for (let i = first; i <= last; i++) {
          const d = c.samples[i]!.distance;
          const weight = Math.min(first === 0 ? 1 : smooth((d - c.samples[first]!.distance) / LAYOUT_POLICY.taper),
            last === signatures.length - 1 ? 1 : smooth((c.samples[last]!.distance - d) / LAYOUT_POLICY.taper));
          offsets[i] = c.input.baseOffset + (offsets[i]! - c.input.baseOffset) * weight;
        }
        first = last + 1;
      }
      const shifted: DisplayPoint[] = [];
      c.samples.forEach((sample, i) => {
        const before = c.samples[i - 1], after = c.samples[i + 1];
        const normal = (a: DisplayPoint, b: DisplayPoint) => { const length = Math.hypot(b.x - a.x, b.y - a.y); return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }; };
        const n1 = before ? normal(before, sample) : normal(sample, after!);
        const n2 = after ? normal(sample, after) : n1;
        const denominator = 1 + n1.x * n2.x + n1.y * n2.y;
        const append = (n: DisplayPoint) => shifted.push({ x: sample.x + n.x * offsets[i]!, y: sample.y + n.y * offsets[i]! });
        if (denominator >= 0.5) append({ x: (n1.x + n2.x) / denominator, y: (n1.y + n2.y) / denominator });
        else { append(n1); append(n2); }
      });
      try { paths.set(c.input.id, buildDisplayPath(shifted, 0)); }
      catch (error) {
        return fallback(`${c.input.id}: final display path unavailable (${error instanceof Error ? error.message : 'unsupported generated extent'}).`);
      }
    }
  } catch (error) {
    if (error === profileBudgetExceeded) return fallback(`Layout profile budget ${LAYOUT_POLICY.maxProfileChecks} exhausted.`);
    throw error;
  }
  return { paths, diagnostics };
}
