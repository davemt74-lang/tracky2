// Volatile aggregate-only live camera diagnostic. No pixels, photos, speech, IDs or coordinates retained.
const COLORS = ['green', 'blue'];

export function createLiveDiagnostics({ maxFrames = 3600 } = {}) {
  if (!Number.isInteger(maxFrames) || maxFrames < 60 || maxFrames > 7200) {
    throw new RangeError('maxFrames must be between 60 and 7200.');
  }
  let running = false;
  let startAt = null;
  let endAt = null;
  let lastAt = null;
  let frames = 0;
  let discontinuities = 0;
  let marker = {};
  let runtime = {};
  const empty = () => ({ observed: 0, confidenceSum: 0, interruptions: 0, lastSeen: false, maxConsecutive: 0, streak: 0 });
  const clear = () => {
    running = false; startAt = null; endAt = null; lastAt = null; frames = 0; discontinuities = 0;
    marker = { green: empty(), blue: empty() };
    runtime = { secureContext: null, camera: false, identity: false, microphone: false,
      voiceModel: false, transcriptModel: false };
  };
  clear();

  function snapshot() {
    const elapsedMs = startAt === null ? 0 : Math.max(0, (endAt ?? lastAt ?? startAt) - startAt);
    const markers = {};
    for (const color of COLORS) {
      const s = marker[color];
      markers[color] = Object.freeze({
        detectionRate: frames ? s.observed / frames : 0,
        observedFrames: s.observed,
        interruptions: s.interruptions,
        longestStreak: s.maxConsecutive,
        meanConfidence: s.observed ? s.confidenceSum / s.observed : null
      });
    }
    return Object.freeze({
      schemaVersion: 1,
      type: 'tracky2-live-aggregate-diagnostic',
      status: running ? 'recording' : startAt === null ? 'idle' : 'stopped',
      frames, elapsedMs, averageFps: elapsedMs > 0 ? (frames - 1) * 1000 / elapsedMs : 0,
      timestampDiscontinuities: discontinuities,
      markers: Object.freeze(markers),
      runtime: Object.freeze({ ...runtime }),
      hardwareCertified: false
    });
  }

  return {
    get running() { return running; },
    start(initialRuntime = {}) {
      clear();
      running = true;
      this.runtime(initialRuntime);
      return snapshot();
    },
    runtime(values = {}) {
      if (!running) return snapshot();
      for (const key of Object.keys(runtime)) {
        if (Object.hasOwn(values, key) && typeof values[key] === 'boolean') runtime[key] = values[key];
      }
      return snapshot();
    },
    frame(timestamp, detections) {
      if (!running) return { type: 'inactive' };
      if (!Number.isFinite(timestamp) || timestamp < 0 || (lastAt !== null && timestamp <= lastAt)) {
        discontinuities += 1;
        return { type: 'invalid-or-stale-frame' };
      }
      if (startAt === null) startAt = timestamp;
      lastAt = timestamp;
      frames += 1;
      for (const color of COLORS) {
        const s = marker[color], d = detections?.[color];
        const seen = Boolean(d && Number.isFinite(d.confidence) && d.confidence >= 0 && d.confidence <= 1);
        if (seen) {
          s.observed++;
          s.confidenceSum += d.confidence;
          s.streak++;
          s.maxConsecutive = Math.max(s.maxConsecutive, s.streak);
        } else {
          if (s.lastSeen) s.interruptions++;
          s.streak = 0;
        }
        s.lastSeen = seen;
      }
      if (frames >= maxFrames) this.stop();
      return { type: 'sampled', frames };
    },
    stop() {
      if (running) {
        running = false;
        endAt = lastAt;
      }
      return snapshot();
    },
    snapshot
  };
}
