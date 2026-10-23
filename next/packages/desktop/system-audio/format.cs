using System;
using System.Runtime.InteropServices;
namespace OrvuniaSystemAudio {
  public sealed class AudioFormat {
    public readonly int Channels, SampleRate, BlockAlign, Bits;
    public readonly bool Floating;
    public AudioFormat(int channels, int sampleRate, int blockAlign, int bits, bool floating) {
      if (channels < 1 || channels > 32 || sampleRate < 8000 || sampleRate > 192000
        || (bits != 8 && bits != 16 && bits != 24 && bits != 32 && bits != 64)
        || (floating && bits != 32 && bits != 64) || (!floating && bits == 64)
        || blockAlign < channels * bits / 8 || blockAlign > channels * bits / 8 + 16)
        throw new AudioFailure("format_unsupported");
      Channels = channels; SampleRate = sampleRate; BlockAlign = blockAlign; Bits = bits; Floating = floating;
    }
    public static AudioFormat FromPointer(IntPtr pointer) {
      var wave = (WaveFormat)Marshal.PtrToStructure(pointer, typeof(WaveFormat));
      ushort tag = wave.tag;
      if (tag == 65534) {
        if (wave.extra < 22) throw new AudioFailure("format_unsupported");
        var subtype = (Guid)Marshal.PtrToStructure(IntPtr.Add(pointer, 24), typeof(Guid));
        if (subtype == new Guid("00000001-0000-0010-8000-00AA00389B71")) tag = 1;
        else if (subtype == new Guid("00000003-0000-0010-8000-00AA00389B71")) tag = 3;
        else throw new AudioFailure("format_unsupported");
      }
      if (tag != 1 && tag != 3) throw new AudioFailure("format_unsupported");
      return new AudioFormat(wave.channels, checked((int)wave.sampleRate), wave.blockAlign, wave.bits, tag == 3);
    }
    double Sample(byte[] data, int offset) {
      double value;
      if (Floating) value = Bits == 32 ? BitConverter.ToSingle(data, offset) : BitConverter.ToDouble(data, offset);
      else if (Bits == 8) value = (data[offset] - 128) / 128.0;
      else if (Bits == 16) value = BitConverter.ToInt16(data, offset) / 32768.0;
      else if (Bits == 24) {
        int integer = data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16;
        if ((integer & 0x800000) != 0) integer |= unchecked((int)0xFF000000);
        value = integer / 8388608.0;
      } else value = BitConverter.ToInt32(data, offset) / 2147483648.0;
      return Double.IsNaN(value) || Double.IsInfinity(value) ? 0 : Math.Max(-1, Math.Min(1, value));
    }
    public float Mono(byte[] data, int frame) {
      double value = 0;
      for (int channel = 0; channel < Channels; channel++) value += Sample(data, frame * BlockAlign + channel * Bits / 8);
      return (float)(value / Channels);
    }
  }
}
