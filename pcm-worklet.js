class SpeechActivity {
  constructor() {
    this.active = false; this.lastSpeechAt = 0; this.floor = 0.00002; this.previous = 0;
    this.steadyMilliseconds = 0; this.attackMilliseconds = 0; this.quietMilliseconds = 0;
  }
  get threshold() { return Math.max(0.00004, Math.min(0.00007, this.floor * 1.5)); }
  observe(energy, milliseconds, at) {
    const rms = Number.isFinite(energy) ? Math.max(0, energy) : 0;
    const stable = Math.abs(rms - this.previous) <= Math.max(0.00001, this.previous * 0.15);
    this.steadyMilliseconds = stable ? this.steadyMilliseconds + milliseconds : 0;
    this.previous = rms;
    const stationary = this.steadyMilliseconds >= 1000;
    const voiced = rms >= Math.max(0.000045, this.floor * 2.4) && !stationary;
    if (stationary || (!this.active && rms < this.floor))
      this.floor = Math.max(0.00001, this.floor * 0.8 + rms * 0.2);
    if (voiced) {
      this.attackMilliseconds += milliseconds; this.quietMilliseconds = 0; this.lastSpeechAt = at;
      if (this.attackMilliseconds >= 60) this.active = true;
    } else {
      this.attackMilliseconds = 0; this.quietMilliseconds += milliseconds;
      if (this.quietMilliseconds >= 600) this.active = false;
    }
    return this.active;
  }
}
class CadencePCM extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();
    this.buffer = [];
    this.pre = [];
    this.active = false;
    this.silence = 0;
    this.turn = 0;
    this.activitySamples = 0;
    this.continuous = options.processorOptions?.continuous === true;
    this.receivedSamples = 0;
    this.sentSamples = 0;
    this.commits = 0;
    this.signalSamples = 0;
    this.rms = 0;
    this.peak = 0;
    this.channels = 0;
    this.speech = new SpeechActivity();
    this.port.onmessage = (e) => {
      if (e.data.type === "flush") {
        this.flush();
        this.commit(false);
        this.reportSignal(true);
        this.port.postMessage({
          type: "flushed",
          ...(e.data.id ? { id: e.data.id } : {}),
        });
      }
    };
  }
  send(data) {
    this.sentSamples += data.length;
    this.port.postMessage({ type: "audio", data: data.buffer }, [data.buffer]);
  }
  flush() {
    if (!this.buffer.length) return;
    const values = this.buffer;
    this.buffer = [];
    const pcm = new Int16Array(values.length);
    let energy = 0, peak = 0;
    for (let i = 0; i < values.length; i++) {
      const v = Number.isFinite(values[i]) ? Math.max(-1, Math.min(1, values[i])) : 0;
      pcm[i] = v < 0 ? v * 32768 : v * 32767;
      energy += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    const seconds = values.length / sampleRate;
    this.rms = Math.sqrt(energy / values.length);
    const wasSpeaking = this.speech.active;
    const speaking = this.speech.observe(this.rms, seconds * 1000, this.receivedSamples / sampleRate * 1000);
    const voice = this.continuous ? this.rms >= this.speech.threshold : this.rms > 0.007;
    this.peak = peak;
    this.signalSamples += values.length;
    this.activitySamples += values.length;
    if (this.activitySamples >= sampleRate * 0.1) {
      this.port.postMessage({ type: "activity", active: speaking,
        silentForMilliseconds: speaking ? 0 : Math.min(60000, Math.max(0, this.receivedSamples / sampleRate * 1000 - this.speech.lastSpeechAt)) });
      this.activitySamples %= Math.round(sampleRate * 0.1);
    }
    if (voice) {
      if (!this.active) {
        for (const p of this.pre) this.send(p);
        this.pre = [];
        this.active = true;
      }
      this.silence = 0;
    } else this.silence += seconds;
    if (this.active) {
      this.send(pcm);
      this.turn += pcm.length;
      const end = this.silence >= 0.6 || (this.continuous && wasSpeaking && !speaking);
      if (end || (this.continuous ? this.turn >= sampleRate * 15 : this.turn > sampleRate * 18)) this.commit(end);
    } else {
      this.pre.push(pcm);
      if (this.pre.length > 3) this.pre.shift();
    }
    this.reportSignal();
  }
  commit(end = false) {
    if (this.active && this.turn > 0) {
      if (this.turn < sampleRate * 0.1) this.send(new Int16Array(Math.ceil(sampleRate * 0.1 - this.turn)));
      this.commits++;
      this.port.postMessage({ type: "commit", end });
    }
    this.active = false;
    this.turn = 0;
    this.silence = 0;
  }
  reportSignal(force = false) {
    if (!force && this.signalSamples < sampleRate) return;
    this.signalSamples %= sampleRate;
    this.port.postMessage({ type: "signal", mode: this.continuous ? "continuous" : "gated",
      receivedSamples: this.receivedSamples, sentSamples: this.sentSamples, commits: this.commits,
      rms: this.rms, peak: this.peak, channels: this.channels });
  }
  input(channels) {
    if (!this.continuous || channels.length < 2) return channels[0];
    const energy = channels.map((channel) => channel.reduce((sum, value) =>
      sum + (Number.isFinite(value) ? value * value : 0), 0));
    let strongest = 0;
    for (let index = 1; index < energy.length; index++)
      if (energy[index] > energy[strongest]) strongest = index;
    const active = channels.filter((_channel, index) => energy[index] > 0);
    if (active.length < 2) return active[0] || channels[0];
    const mixed = new Float32Array(channels[0].length);
    let mixedEnergy = 0;
    for (let index = 0; index < mixed.length; index++) {
      for (const channel of active) mixed[index] += (channel[index] || 0) / active.length;
      mixedEnergy += mixed[index] * mixed[index];
    }
    return mixedEnergy < energy[strongest] * 0.25 ? channels[strongest] : mixed;
  }
  process(inputs, outputs) {
    const channels = inputs[0] || [];
    const source = this.input(channels);
    if (source) {
      this.channels = channels.length;
      this.receivedSamples += source.length;
      for (const value of source) this.buffer.push(value);
      if (this.buffer.length >= 2400) this.flush();
    }
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}
registerProcessor("cadence-pcm", CadencePCM);
