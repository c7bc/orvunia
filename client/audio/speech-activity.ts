export class SpeechActivity {
  active = false;
  lastSpeechAt = 0;
  private floor = 0.00002;
  private previous = 0;
  private steadyMilliseconds = 0;
  private attackMilliseconds = 0;
  private quietMilliseconds = 0;
  get threshold() { return Math.max(0.00004, Math.min(0.00007, this.floor * 1.5)); }
  observe(energy: number, milliseconds: number, at: number) {
    const rms = Number.isFinite(energy) ? Math.max(0, energy) : 0;
    const stable = Math.abs(rms - this.previous) <= Math.max(0.00001, this.previous * 0.15);
    this.steadyMilliseconds = stable ? this.steadyMilliseconds + milliseconds : 0;
    this.previous = rms;
    const stationary = this.steadyMilliseconds >= 1000;
    const voiced = rms >= Math.max(0.000045, this.floor * 2.4) && !stationary;
    if (stationary || (!this.active && rms < this.floor))
      this.floor = Math.max(0.00001, this.floor * 0.8 + rms * 0.2);
    if (voiced) {
      this.attackMilliseconds += milliseconds;
      this.quietMilliseconds = 0;
      this.lastSpeechAt = at;
      if (this.attackMilliseconds >= 60) this.active = true;
    } else {
      this.attackMilliseconds = 0;
      this.quietMilliseconds += milliseconds;
      if (this.quietMilliseconds >= 600) this.active = false;
    }
    return this.active;
  }
  idle() { this.active = false; this.attackMilliseconds = 0; this.quietMilliseconds = 600; }
}
