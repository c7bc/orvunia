using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
namespace OrvuniaSystemAudio {
  public static class SyntheticTest {
    static int assertions;
    static void Assert(bool condition, string message) { assertions++; if (!condition) throw new Exception(message); }
    static byte[] FloatTone(int rate, int frequency, int frames) {
      var result = new byte[frames * 8];
      for (int frame = 0; frame < frames; frame++) {
        float value = (float)Math.Sin(2 * Math.PI * frequency * frame / rate);
        Buffer.BlockCopy(BitConverter.GetBytes(value * 0.75f), 0, result, frame * 8, 4);
        Buffer.BlockCopy(BitConverter.GetBytes(value * 0.25f), 0, result, frame * 8 + 4, 4);
      }
      return result;
    }
    static byte[] Convert(byte[] input, AudioFormat format, int chunkFrames) {
      using (var output = new MemoryStream()) {
        var converter = new PcmConverter(format, delegate(byte[] bytes, int count) {
          if (count > 960 || count % 2 != 0) throw new Exception("invalid chunk alignment");
          output.Write(bytes, 0, count);
        });
        int frames = input.Length / format.BlockAlign;
        for (int offset = 0; offset < frames; offset += chunkFrames) {
          int count = Math.Min(chunkFrames, frames - offset);
          var data = new byte[count * format.BlockAlign];
          Buffer.BlockCopy(input, offset * format.BlockAlign, data, 0, data.Length);
          converter.Push(data, count, false);
        }
        converter.Flush(); long before = output.Length; converter.Flush();
        Assert(before == output.Length, "flush duplicated samples");
        return output.ToArray();
      }
    }
    static double Rms(byte[] bytes) {
      double energy = 0; int count = bytes.Length / 2;
      for (int index = 100; index < count - 100; index++) {
        double value = BitConverter.ToInt16(bytes, index * 2) / 32768.0;
        energy += value * value;
      }
      return Math.Sqrt(energy / Math.Max(1, count - 200));
    }
    public static string Run() {
      assertions = 0;
      var format = new AudioFormat(2, 48000, 8, 32, true);
      var tone = Convert(FloatTone(48000, 1000, 48000), format, 37);
      Assert(tone.Length == 48000, "48k to 24k frame count");
      Assert(Math.Abs(Rms(tone) - 0.35355) < 0.005, "stereo downmix amplitude");
      var alias = Convert(FloatTone(48000, 16000, 48000), format, 127);
      Assert(Rms(alias) < 0.01, "anti-alias rejection");
      var alternate = Convert(FloatTone(44100, 1000, 44100), new AudioFormat(2, 44100, 8, 32, true), 53);
      Assert(alternate.Length == 48000, "44.1k to 24k frame count");
      Assert(Math.Abs(Rms(alternate) - 0.35355) < 0.005, "44.1k amplitude");
      var invalid = new byte[8];
      Buffer.BlockCopy(BitConverter.GetBytes(float.NaN), 0, invalid, 0, 4);
      Buffer.BlockCopy(BitConverter.GetBytes(float.PositiveInfinity), 0, invalid, 4, 4);
      Assert(format.Mono(invalid, 0) == 0, "non-finite samples");
      var constant = new byte[4800];
      for (int index = 0; index < constant.Length; index += 2) { constant[index] = 0; constant[index + 1] = 32; }
      var sameRate = Convert(constant, new AudioFormat(1, 24000, 2, 16, false), 31);
      Assert(sameRate.Length == constant.Length, "same rate length");
      Assert(Math.Abs(BitConverter.ToInt16(sameRate, 200) - 8192) <= 1, "PCM16 normalization");
      using (var silence = new MemoryStream()) {
        var converter = new PcmConverter(format, delegate(byte[] bytes, int count) { silence.Write(bytes, 0, count); });
        converter.Push(new byte[0], 480, true); converter.Flush();
        Assert(silence.Length == 480, "silent packet frame count");
        foreach (byte value in silence.ToArray()) if (value != 0) throw new Exception("silent packet produced audio");
      }
      var outputStatus = new StringWriter(); string id = Guid.NewGuid().ToString("D");
      var input = new StringReader("{\"command\":\"start\",\"endpointId\":\"default:communications\"}\n"
        + "{\"command\":\"flush\",\"id\":\"" + id + "\"}\n{\"command\":\"stop\"}\n");
      var protocol = new AudioProtocol(input, outputStatus);
      Assert(protocol.Start() == "default:communications", "start endpoint");
      protocol.Controls(); Assert(protocol.Stop.WaitOne(0), "stop lifecycle");
      using (var stream = new MemoryStream()) {
        var converter = new PcmConverter(format, delegate(byte[] bytes, int count) { stream.Write(bytes, 0, count); });
        converter.Push(new byte[480 * 8], 480, false); protocol.Flush(converter, stream);
        Assert(outputStatus.ToString().Contains(id), "flush receipt");
        Assert(outputStatus.ToString().Contains("\"frames\":240"), "flush frame watermark");
      }
      Assert(new AudioProtocol(new StringReader(""), new StringWriter()).Start() == null, "EOF no capture");
      bool rejected = false;
      try { new AudioFormat(2, 48000, 8, 48, true); } catch (AudioFailure) { rejected = true; }
      Assert(rejected, "unsupported format rejected");
      var pcm24 = new AudioFormat(1, 44100, 3, 24, false);
      Assert(Math.Abs(pcm24.Mono(new byte[] { 255, 255, 127 }, 0) - 1) < 0.00001, "PCM24 positive sign");
      Assert(pcm24.Mono(new byte[] { 0, 0, 128 }, 0) == -1, "PCM24 negative sign");
      Assert(new AudioFormat(1, 48000, 4, 32, false).Mono(BitConverter.GetBytes(536870912), 0) == 0.25f,
        "PCM32 normalization");
      Assert(new AudioFormat(1, 8000, 1, 8, false).Mono(new byte[] { 128 }, 0) == 0, "PCM8 midpoint");
      IntPtr pointer = Marshal.AllocCoTaskMem(40);
      try {
        Marshal.Copy(new byte[40], 0, pointer, 40);
        Marshal.StructureToPtr(new WaveFormat { tag = 65534, channels = 2, sampleRate = 48000,
          averageBytes = 384000, blockAlign = 8, bits = 32, extra = 22 }, pointer, false);
        Marshal.WriteInt16(pointer, 18, 32);
        Marshal.Copy(new Guid("00000003-0000-0010-8000-00AA00389B71").ToByteArray(), 0, IntPtr.Add(pointer, 24), 16);
        var extensible = AudioFormat.FromPointer(pointer);
        Assert(extensible.Floating && extensible.Channels == 2 && extensible.SampleRate == 48000, "extensible float format");
      } finally { Marshal.FreeCoTaskMem(pointer); }
      return new JavaScriptSerializer().Serialize(new { passed = true, assertions = assertions,
        hardwareCapture = false, networkCalls = 0, toneRms = Rms(tone), aliasRms = Rms(alias),
        outputFormat = "pcm_s16le", sampleRate = 24000, channels = 1 });
    }
  }
}
