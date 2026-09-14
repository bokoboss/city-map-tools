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
console.log('PASS explicit dot-center/pin-tip hotspots, all bounded label positions, and transient presentation lookup');
