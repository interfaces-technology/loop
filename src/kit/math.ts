export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

const START_ANGLE = 225;
const SWEEP = 270;

export function angleForValue(value: number): number {
  return START_ANGLE + clamp01(value) * SWEEP;
}

export function valueForAngle(angleDeg: number): number {
  let raw = ((angleDeg % 360) + 360) % 360;
  let t = (raw - START_ANGLE + 360) % 360;
  if (t > SWEEP) t = 0;
  return clamp01(t / SWEEP);
}

export function angleAtPoint(x: number, y: number, cx: number, cy: number): number {
  return ((Math.atan2(x - cx, cy - y) * 180) / Math.PI + 360) % 360;
}

export function positionToValue(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  horizontal: boolean,
): number {
  if (horizontal) {
    if (rect.width <= 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  }
  if (rect.height <= 0) return 0;
  return clamp01(1 - (clientY - rect.top) / rect.height);
}

export function valueForClient(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  horizontal: boolean,
  thumbSize: number,
): number {
  const raw = positionToValue(clientX, clientY, rect, horizontal);
  const major = horizontal ? rect.width : rect.height;
  const span = Math.max(1, major - thumbSize);
  return clamp01((raw * major - thumbSize / 2) / span);
}