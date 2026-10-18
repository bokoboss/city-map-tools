import { useState } from 'react';
import type { LineStringFeature } from '../features/featureModel';
import type { ProjectCommand } from '../project/projectHistory';
import { MAX_TRAFFIC_MOVEMENTS, type TrafficMovementV2, type TrafficMovementStyleV2 } from '../project/trafficMovement';
import type { OperationResult } from './MapCanvas';

const numericFields = [
  ['opacity', 'Opacity', 0, 1, 0.05],
  ['lineWidthPixels', 'Line width (display px)', 1, 16, 1],
  ['arrowSizePixels', 'Arrow size (display px)', 8, 48, 1],
  ['arrowSpacingPixels', 'Visual arrow spacing (display px)', 24, 256, 1],
  ['displayOffsetPixels', 'Visual display offset (px)', -64, 64, 1],
  ['layoutOrder', 'Visual layout order', -24, 24, 1],
] as const;

export function TrafficMovementInspector({ feature, movements, disabled, onCommand }: {
  feature: LineStringFeature;
  movements: Readonly<Record<string, TrafficMovementV2>>;
  disabled: boolean;
  onCommand: (command: ProjectCommand) => OperationResult;
}) {
  const [error, setError] = useState('');
  const movement = Object.hasOwn(movements, feature.id) ? movements[feature.id] : undefined;
  const reason = disabled ? 'Finish or cancel the active geometry interaction first.'
    : feature.lineage !== 'authored' ? 'Only authored LineStrings can be converted. Imported and derived geometry remain unchanged.'
    : !movement && Object.keys(movements).length >= MAX_TRAFFIC_MOVEMENTS ? 'This project already has 24 Traffic Movements. Unconvert one before converting another.' : '';
  const run = (command: ProjectCommand) => {
    const result = onCommand(command);
    setError(result.ok ? '' : result.message);
  };
  const style = (patch: Partial<TrafficMovementStyleV2>) => run({ type: 'updateTrafficMovementStyle', id: feature.id, patch });
  return <section className="movement-presentation" aria-label="Traffic Movement inspector" key={feature.id}>
    <h3>{movement ? 'Traffic Movement' : 'Directional annotation'}</h3>
    <p id="movement-help">Visual presentation only. Direction follows the authored WGS84 path; display tracks are schematic, not lane geometry.</p>
    {reason && <p id="movement-disabled-reason">{reason}</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={Boolean(reason)} aria-describedby={reason ? 'movement-disabled-reason' : 'movement-help'}
      onClick={() => run({ type: movement ? 'unconvertTrafficMovement' : 'convertToTrafficMovement', id: feature.id })}>
      {movement ? 'Unconvert to LineString' : 'Convert to Traffic Movement'}
    </button>
    {movement && <fieldset disabled={disabled} aria-describedby="movement-help">
      <legend>Movement visual presentation</legend>
      <label htmlFor="movement-direction">Movement direction</label>
      <select id="movement-direction" value={movement.direction} onChange={event => run({ type: 'setTrafficMovementDirection', id: feature.id, direction: event.target.value as TrafficMovementV2['direction'] })}>
        <option value="forward">Forward · first to last vertex</option><option value="reverse">Reverse · last to first vertex</option>
      </select>
      <label htmlFor="movement-color">Movement color</label>
      <input id="movement-color" type="color" value={movement.style.color} onChange={event => style({ color: event.target.value })} />
      {numericFields.map(([key, label, min, max, step]) => <label key={key} htmlFor={`movement-${key}`}>{label}
        <input id={`movement-${key}`} type="number" min={min} max={max} step={step}
          key={`${feature.id}:${movement.style[key]}`} defaultValue={movement.style[key]}
          onBlur={event => {
            if (!event.currentTarget.validity.valid || event.currentTarget.value === '') {
              event.currentTarget.value = String(movement.style[key]);
              setError(`${label} must be between ${min} and ${max}${key === 'layoutOrder' ? ', as a whole number' : ''}.`);
              return;
            }
            style({ [key]: event.currentTarget.valueAsNumber });
          }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      </label>)}
      <label className="presentation-checkbox"><input type="checkbox" checked={movement.style.animationEnabled} onChange={event => style({ animationEnabled: event.target.checked })} />Animation enabled</label>
      <label htmlFor="movement-rate">Visual animation rate</label>
      <select id="movement-rate" value={movement.style.animationRate} onChange={event => style({ animationRate: event.target.value as TrafficMovementStyleV2['animationRate'] })}>
        <option value="slow">Slow</option><option value="medium">Medium</option><option value="fast">Fast</option>
      </select>
      <label className="presentation-checkbox"><input type="checkbox" checked={movement.style.autoLayout} onChange={event => style({ autoLayout: event.target.checked })} />Automatic visual track layout</label>
    </fieldset>}
  </section>;
}
