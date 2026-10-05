class TrackyPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.offset = 0;
    this.leftSumSquares = 0;
    this.rightSumSquares = 0;
    this.energySamples = 0;
    this.channelCount = 1;
  }

  resetEnergy() {
    this.leftSumSquares = 0;
    this.rightSumSquares = 0;
    this.energySamples = 0;
    this.channelCount = 1;
  }

  flush() {
    if (!this.offset) return;
    const count = Math.max(1, this.energySamples);
    this.port.postMessage({
      samples: this.buffer.slice(0, this.offset),
      channelCount: this.channelCount,
      leftRms: Math.sqrt(this.leftSumSquares / count),
      rightRms: this.channelCount >= 2
        ? Math.sqrt(this.rightSumSquares / count)
        : null
    });
    this.offset = 0;
    this.resetEnergy();
  }

  process(inputs, outputs) {
    const channels = inputs?.[0] || [];
    const left = channels[0];
    const right = channels[1] || null;
    if (left?.length) {
      this.channelCount = right?.length ? 2 : 1;
      for (let i = 0; i < left.length; i += 1) {
        const l = left[i] || 0;
        const r = right?.[i] ?? l;
        this.buffer[this.offset] = right ? (l + r) * 0.5 : l;
        this.leftSumSquares += l * l;
        if (right) this.rightSumSquares += r * r;
        this.energySamples += 1;
        this.offset += 1;
        if (this.offset === this.buffer.length) this.flush();
      }
    }

    const output = outputs?.[0]?.[0];
    if (output) output.fill(0);
    return true;
  }
}

registerProcessor('tracky-pcm-processor', TrackyPcmProcessor);
