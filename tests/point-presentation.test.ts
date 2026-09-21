import assert from 'node:assert/strict';
import {
  POINT_LABEL_POSITIONS,
  POINT_MARKER_SIZES,
  defaultPointPresentation,
  pointMarkerDefinitions,
  pointPresentationFor,
} from '../src/map/pointPresentation';

assert.equal(pointMarkerDefinitions.dot.hotspot, 'center');
assert.equal(pointMarkerDefinitions.pin.hotspot, 'bottom-center');
assert.deepEqual(POINT_LABEL_POSITIONS, [
  'top', 'bottom', 'left', 'right',
  'top-left', 'top-right', 'bottom-left', 'bottom-right',
]);
assert.deepEqual(POINT_MARKER_SIZES, [18, 24, 32]);

const presentations = {
  'point-1': { marker: 'pin' as const, markerSize: 32 as const, labelVisible: false, labelPosition: 'top-left' as const },
};
assert.deepEqual(pointPresentationFor(presentations, 'point-1'), presentations['point-1']);
assert.equal(pointPresentationFor(presentations, 'unknown'), defaultPointPresentation);
for (const featureId of ['__proto__', 'constructor', 'prototype']) {
  assert.equal(pointPresentationFor(presentations, featureId), defaultPointPresentation, `${featureId} never resolves inherited presentation state`);
}
const specialPresentation = { marker: 'pin' as const, markerSize: 24 as const, labelVisible: false, labelPosition: 'top-right' as const };
const ownSpecialPresentations: Record<string, typeof specialPresentation> = {};
Object.defineProperty(ownSpecialPresentations, '__proto__', { value: specialPresentation, enumerable: true, writable: true, configurable: true });
ownSpecialPresentations.constructor = specialPresentation;
ownSpecialPresentations.prototype = specialPresentation;
for (const featureId of ['__proto__', 'constructor', 'prototype']) {
  assert.deepEqual(pointPresentationFor(ownSpecialPresentations, featureId), specialPresentation, `${featureId} resolves an actual own presentation`);
}
console.log('PASS explicit dot-center/pin-tip hotspots, all bounded label positions, and transient presentation lookup');
console.log('PASS prototype-chain presentation IDs default safely and preserve actual own presentations');
