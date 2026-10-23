using System;
using System.Collections.Generic;
namespace OrvuniaSystemAudio {
  public sealed class PcmConverter {
    const int Radius = 16, Phases = 256;
    readonly AudioFormat format;
    readonly Action<byte[], int> output;
    readonly double[][] coefficients = new double[Phases][];
    readonly List<float> samples = new List<float>();
    readonly byte[] pending = new byte[960];
    long origin, inputFrames, outputFrames;
    int pendingBytes;
    public long Frames { get { return outputFrames; } }
    public PcmConverter(AudioFormat format, Action<byte[], int> output) {
      this.format = format; this.output = output;
      double cutoff = 0.45 * Math.Min(1.0, 24000.0 / format.SampleRate);
      for (int phase = 0; phase < Phases; phase++) {
        coefficients[phase] = new double[Radius * 2 + 1];
        double total = 0;
        for (int tap = -Radius; tap <= Radius; tap++) {
          double distance = tap - phase / (double)Phases;
          double argument = 2 * cutoff * distance;
          double sinc = Math.Abs(argument) < 0.0000001 ? 1 : Math.Sin(Math.PI * argument) / (Math.PI * argument);
          double window = Math.Abs(distance) >= Radius ? 0
            : 0.42 + 0.5 * Math.Cos(Math.PI * distance / Radius) + 0.08 * Math.Cos(2 * Math.PI * distance / Radius);
          double weight = 2 * cutoff * sinc * window;
          coefficients[phase][tap + Radius] = weight; total += weight;
        }
        for (int index = 0; index < coefficients[phase].Length; index++) coefficients[phase][index] /= total;
      }
    }
    public void Push(byte[] data, int frames, bool silent) {
      if (frames < 0 || frames > format.SampleRate * 2 || (!silent && data.Length < (long)frames * format.BlockAlign))
        throw new AudioFailure("packet_invalid");
      for (int frame = 0; frame < frames; frame++) samples.Add(silent ? 0 : format.Mono(data, frame));
      inputFrames += frames;
      Produce(false);
    }
    public void Flush() { Produce(true); Emit(); }
    void Produce(bool edgePadding) {
      while (inputFrames > 0) {
        double position = outputFrames * (double)format.SampleRate / 24000;
        if (position >= inputFrames || (!edgePadding && Math.Floor(position) + Radius >= inputFrames)) break;
        long center = (long)Math.Floor(position);
        int phase = Math.Min(Phases - 1, (int)((position - center) * Phases));
        double value = 0;
        for (int tap = -Radius; tap <= Radius; tap++) {
          long index = Math.Max(origin, Math.Min(inputFrames - 1, center + tap));
          value += samples[checked((int)(index - origin))] * coefficients[phase][tap + Radius];
        }
        int sample = Math.Max(-32768, Math.Min(32767,
          (int)Math.Round(Math.Max(-1, Math.Min(1, value)) * 32768, MidpointRounding.AwayFromZero)));
        pending[pendingBytes++] = (byte)(sample & 255);
        pending[pendingBytes++] = (byte)((sample >> 8) & 255);
        outputFrames++;
        if (pendingBytes == pending.Length) Emit();
      }
      long keepFrom = Math.Max(origin, (long)Math.Floor(outputFrames * (double)format.SampleRate / 24000) - Radius);
      int remove = checked((int)Math.Min(samples.Count, keepFrom - origin));
      if (remove > 0) { samples.RemoveRange(0, remove); origin += remove; }
    }
    void Emit() {
      if (pendingBytes == 0) return;
      output(pending, pendingBytes);
      pendingBytes = 0;
    }
  }
}
