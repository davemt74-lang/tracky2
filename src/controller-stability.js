// Independent fail-closed marker stability gate for the currently active board color.
// Raw camera data and participant identity never enter the event history.
export function createControllerStability({
  stableFrames = 3, maxJump = 0.38, minConfidence = 0.03
} = {}) {
  if (!Number.isInteger(stableFrames) || stableFrames < 2 || stableFrames > 12 ||
      !Number.isFinite(maxJump) || maxJump <= 0 || maxJump > 1 ||
      !Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    throw new RangeError('Invalid marker stability thresholds.');
  }
  let consecutive = 0;
  let locked = false;
  let lastPoint = null;
  let lastTime = null;
  let status = 'searching';

  function clear(nextStatus = 'searching') {
    const lost = locked;
    consecutive = 0;
    locked = false;
    lastPoint = null;
    status = nextStatus;
    return lost;
  }
  const valid = d => Boolean(d &&
    Number.isFinite(d.x) && Number.isFinite(d.y) &&
    d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1 &&
    Number.isFinite(d.confidence) && d.confidence >= minConfidence && d.confidence <= 1);

  return {
    snapshot() {
      return Object.freeze({ status, locked, consecutive, stableFrames });
    },
    reset() {
      clear();
      lastTime = null;
      return this.snapshot();
    },
    observe(detection, timestamp) {
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        return { type: 'invalid-timestamp', accepted: false, sample: null };
      }
      if (lastTime !== null && timestamp <= lastTime) {
        return { type: 'stale-frame', accepted: false, sample: null };
      }
      lastTime = timestamp;
      if (!valid(detection)) {
        const lost = clear(locked ? 'lost' : 'searching');
        return { type: lost ? 'lost' : 'missing', accepted: false, sample: null, lost };
      }
      if (lastPoint &&
          Math.hypot(detection.x - lastPoint.x, detection.y - lastPoint.y) > maxJump) {
        const lost = clear('jump-rejected');
        // Suspicious marker leaps never become the first candidate of a new track.
        return { type: 'jump-rejected', accepted: false, sample: null, lost };
      }
      lastPoint = { x: detection.x, y: detection.y };
      if (!locked) {
        consecutive += 1;
        if (consecutive < stableFrames) {
          status = 'acquiring';
          return { type: 'acquiring', accepted: false, sample: null, consecutive, stableFrames };
        }
        locked = true;
      }
      status = 'tracking';
      return {
        type: 'tracking', accepted: true,
        sample: Object.freeze({ x: detection.x, y: detection.y,
          confidence: detection.confidence, timestamp })
      };
    }
  };
}
