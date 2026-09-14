// Point presentation is deliberately separate from canonical WGS84 feature state.
// New icon kinds must declare their hotspot; geometry is never inferred from DOM bounds.
export const POINT_MARKER_KINDS = ['dot', 'pin'] as const;
export type PointMarkerKind = typeof POINT_MARKER_KINDS[number];

export const MARKER_HOTSPOTS = ['center', 'bottom-center', 'pole-base', 'custom'] as const;
export type MarkerHotspot = typeof MARKER_HOTSPOTS[number];

export interface MarkerIconDefinition {
  hotspot: MarkerHotspot;
}

export const pointMarkerDefinitions: Readonly<Record<PointMarkerKind, MarkerIconDefinition>> = {
  dot: { hotspot: 'center' },
  pin: { hotspot: 'bottom-center' },
};

export const POINT_LABEL_POSITIONS = [
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;
export type PointLabelPosition = typeof POINT_LABEL_POSITIONS[number];

export const POINT_MARKER_SIZES = [18, 24, 32] as const;
export type PointMarkerSize = typeof POINT_MARKER_SIZES[number];

export interface PointPresentation {
  marker: PointMarkerKind;
  markerSize: PointMarkerSize;
  labelVisible: boolean;
  labelPosition: PointLabelPosition;
}

export const defaultPointPresentation: PointPresentation = {
  marker: 'dot',
  markerSize: 18,
  labelVisible: true,
  labelPosition: 'bottom',
};

export function pointPresentationFor(
  presentations: Readonly<Record<string, PointPresentation>>,
  featureId: string,
): PointPresentation {
  return presentations[featureId] || defaultPointPresentation;
}
