using System;
using System.IO;
using System.Runtime.InteropServices;
namespace OrvuniaSystemAudio {
  public static class Capture {
    static void Packet(IAudioCaptureClient capture, AudioFormat format, PcmConverter converter, ref long glitches) {
      IntPtr data; uint frames, flags; ulong devicePosition, clockPosition;
      Marshal.ThrowExceptionForHR(capture.GetBuffer(out data, out frames, out flags, out devicePosition, out clockPosition));
      try {
        if (frames == 0) return;
        long bytes = (long)frames * format.BlockAlign;
        if (bytes > 16 * 1024 * 1024 || frames > format.SampleRate * 2) throw new AudioFailure("packet_invalid");
        bool silent = (flags & 2) != 0;
        var buffer = silent ? new byte[0] : new byte[checked((int)bytes)];
        if (!silent) {
          if (data == IntPtr.Zero) throw new AudioFailure("packet_invalid");
          Marshal.Copy(data, buffer, 0, buffer.Length);
        }
        if ((flags & 1) != 0) glitches++;
        converter.Push(buffer, checked((int)frames), silent);
      } finally { Marshal.ThrowExceptionForHR(capture.ReleaseBuffer(frames)); }
    }
    public static void Run(string selected, AudioProtocol protocol, Stream output) {
      IDevices devices = null; IDevice device = null; IAudioClient client = null; IAudioCaptureClient capture = null;
      IntPtr pointer = IntPtr.Zero; bool started = false;
      try {
        if (protocol.Stop.WaitOne(0)) { protocol.AssertValid(); protocol.Write(new { @event = "stopped", frames = 0, discontinuities = 0 }); return; }
        devices = (IDevices)new DeviceEnumerator();
        device = Endpoints.Select(devices, selected);
        string endpointId; Marshal.ThrowExceptionForHR(device.GetId(out endpointId));
        var clientId = new Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"); object value;
        Marshal.ThrowExceptionForHR(device.Activate(ref clientId, 23, IntPtr.Zero, out value)); client = (IAudioClient)value;
        Marshal.ThrowExceptionForHR(client.GetMixFormat(out pointer));
        var format = AudioFormat.FromPointer(pointer);
        Marshal.ThrowExceptionForHR(client.Initialize(0, 0x00020000, 1000000, 0, pointer, IntPtr.Zero));
        var captureId = new Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317");
        Marshal.ThrowExceptionForHR(client.GetService(ref captureId, out value)); capture = (IAudioCaptureClient)value;
        var converter = new PcmConverter(format, delegate(byte[] bytes, int count) { output.Write(bytes, 0, count); });
        Marshal.ThrowExceptionForHR(client.Start()); started = true;
        protocol.Write(new { @event = "ready", endpointId = endpointId, sampleRate = 24000, channels = 1,
          format = "pcm_s16le", sourceSampleRate = format.SampleRate, sourceChannels = format.Channels });
        long discontinuities = 0;
        while (!protocol.Stop.WaitOne(0)) {
          uint frames; Marshal.ThrowExceptionForHR(capture.GetNextPacketSize(out frames));
          while (frames > 0 && !protocol.Stop.WaitOne(0)) {
            Packet(capture, format, converter, ref discontinuities);
            Marshal.ThrowExceptionForHR(capture.GetNextPacketSize(out frames));
          }
          protocol.Flush(converter, output);
          protocol.Stop.WaitOne(5);
        }
        Marshal.ThrowExceptionForHR(client.Stop()); started = false;
        converter.Flush(); output.Flush(); protocol.Flush(converter, output); protocol.AssertValid();
        protocol.Write(new { @event = "stopped", frames = converter.Frames, discontinuities = discontinuities });
      } finally {
        if (client != null && started) client.Stop();
        Endpoints.Release(capture); Endpoints.Release(client); Endpoints.Release(device); Endpoints.Release(devices);
        if (pointer != IntPtr.Zero) Marshal.FreeCoTaskMem(pointer);
      }
    }
  }
}
