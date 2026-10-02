// Color tracking is an input provider, not the game's scoring authority.
import { clamp01 } from './tracker-core.js';

export function toColorControllerInput(detection, mirror = false, timestamp = 0) {
  if (!detection || !Number.isFinite(detection.x) || !Number.isFinite(detection.y) ||
      !Number.isFinite(timestamp) || timestamp < 0) return null;
  return Object.freeze({
    source: 'color-object',
    x: clamp01(mirror ? 1 - detection.x : detection.x),
    y: clamp01(detection.y),
    timestamp
  });
}
