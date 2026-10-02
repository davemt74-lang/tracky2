import { analyzeMask, hueInRange, rgbToHsv } from './tracker-core.js';

// Disjoint visible marker colors. One HSV pass powers both independent masks.
export const CONTROLLER_COLORS = Object.freeze({
  green: Object.freeze({ label: 'Green', hueMin: 70, hueMax: 170, saturationMin: 35, valueMin: 20 }),
  blue: Object.freeze({ label: 'Blue', hueMin: 195, hueMax: 260, saturationMin: 40, valueMin: 20 })
});

export const CALIBRATION_PRESETS = Object.freeze({
  normal: { green: { hueMin: 70, hueMax: 170, saturationMin: 35, valueMin: 20 },
    blue: { hueMin: 195, hueMax: 260, saturationMin: 40, valueMin: 20 }, minAreaRatio: 0.002 },
  lowLight: { green: { hueMin: 65, hueMax: 170, saturationMin: 24, valueMin: 10 },
    blue: { hueMin: 190, hueMax: 265, saturationMin: 28, valueMin: 10 }, minAreaRatio: 0.001 },
  bright: { green: { hueMin: 78, hueMax: 160, saturationMin: 45, valueMin: 28 },
    blue: { hueMin: 202, hueMax: 256, saturationMin: 50, valueMin: 28 }, minAreaRatio: 0.0025 }
});

export function validateColorCalibration(candidate) {
  if (!candidate || typeof candidate !== 'object' || !candidate.green || !candidate.blue ||
      !Number.isFinite(candidate.minAreaRatio) || candidate.minAreaRatio < 0.0005 ||
      candidate.minAreaRatio > 0.02) throw new RangeError('Invalid minimum marker area.');
  const g = candidate.green, b = candidate.blue;
  const valid = (rule, minHue, maxHue) =>
    Object.keys(rule).length === 4 &&
    Object.values(rule).every(Number.isFinite) &&
    rule.hueMin >= minHue && rule.hueMax <= maxHue && rule.hueMax - rule.hueMin >= 10 &&
    rule.saturationMin >= 15 && rule.saturationMin <= 90 &&
    rule.valueMin >= 5 && rule.valueMin <= 90;
  if (!valid(g, 60, 185) || !valid(b, 190, 285) || g.hueMax >= b.hueMin) {
    throw new RangeError('Green and blue hue ranges must be valid and non-overlapping.');
  }
  return Object.freeze({
    green: Object.freeze({ hueMin:g.hueMin, hueMax:g.hueMax, saturationMin:g.saturationMin, valueMin:g.valueMin }),
    blue: Object.freeze({ hueMin:b.hueMin, hueMax:b.hueMax, saturationMin:b.saturationMin, valueMin:b.valueMin }),
    minAreaRatio:candidate.minAreaRatio
  });
}

export function createColorCalibration(preset = 'normal') {
  if (!Object.hasOwn(CALIBRATION_PRESETS, preset)) throw new RangeError('Unknown calibration preset.');
  return validateColorCalibration(CALIBRATION_PRESETS[preset]);
}

export function detectColorControllers(image, { sampleStep = 2, minAreaRatio, calibration = createColorCalibration() } = {}) {
  const profile = validateColorCalibration(calibration);
  if (minAreaRatio === undefined) minAreaRatio = profile.minAreaRatio;
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
      image.width < 1 || image.height < 1 || !image.data ||
      image.data.length < image.width * image.height * 4 ||
      !Number.isInteger(sampleStep) || sampleStep < 1 || sampleStep > 16 ||
      !Number.isFinite(minAreaRatio) || minAreaRatio <= 0 || minAreaRatio > 1) {
    throw new TypeError('Invalid camera frame or tracking options.');
  }
  const colors = Object.keys(CONTROLLER_COLORS);
  const w = Math.ceil(image.width / sampleStep);
  const h = Math.ceil(image.height / sampleStep);
  const masks = Object.fromEntries(colors.map(color => [color, new Uint8Array(w * h)]));
  for (let y = 0; y < h; y++) {
    const sy = Math.min(image.height - 1, y * sampleStep);
    for (let x = 0; x < w; x++) {
      const sx = Math.min(image.width - 1, x * sampleStep);
      const p = 4 * (sy * image.width + sx);
      const hsv = rgbToHsv(image.data[p], image.data[p + 1], image.data[p + 2]);
      for (const color of colors) {
        const rule = profile[color];
        if (hueInRange(hsv.h, rule.hueMin, rule.hueMax) &&
            hsv.s >= rule.saturationMin && hsv.v >= rule.valueMin) {
          masks[color][y * w + x] = 1;
          break;
        }
      }
    }
  }
  const results = {};
  for (const color of colors) {
    const b = analyzeMask(masks[color], w, h, Math.max(1, Math.round(w * h * minAreaRatio)));
    results[color] = b ? {
      x: w > 1 ? b.x / (w - 1) : 0.5,
      y: h > 1 ? b.y / (h - 1) : 0.5,
      confidence: Math.min(1, b.area / (w * h) / 0.03),
      areaRatio: b.area / (w * h),
      bbox: { x: b.minX / w, y: b.minY / h,
        width: (b.maxX - b.minX + 1) / w, height: (b.maxY - b.minY + 1) / h }
    } : null;
  }
  return results;
}
