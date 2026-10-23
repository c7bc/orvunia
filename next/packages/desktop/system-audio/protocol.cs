using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Web.Script.Serialization;
namespace OrvuniaSystemAudio {
  public sealed class AudioProtocol {
    readonly TextReader input;
    readonly TextWriter status;
    readonly object statusLock = new object();
    readonly Queue<string> flushes = new Queue<string>();
    readonly ManualResetEvent stopping = new ManualResetEvent(false);
    volatile bool invalid;
    public WaitHandle Stop { get { return stopping; } }
    public AudioProtocol(TextReader input, TextWriter status) { this.input = input; this.status = status; }
    public Dictionary<string, object> Read() {
      var text = new System.Text.StringBuilder();
      while (true) {
        int character = input.Read();
        if (character < 0) return text.Length == 0 ? null : Parse(text.ToString());
        if (character == 10) return Parse(text.ToString().TrimEnd('\r'));
        if (text.Length >= 4096) throw new AudioFailure("command_invalid");
        text.Append((char)character);
      }
    }
    static Dictionary<string, object> Parse(string text) {
      try { return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(text); }
      catch { throw new AudioFailure("command_invalid"); }
    }
    public string Start() {
      var command = Read();
      if (command == null) return null;
      object action, endpoint;
      if (command.Count != 2 || !command.TryGetValue("command", out action) || !Equals(action, "start")
        || !command.TryGetValue("endpointId", out endpoint) || !(endpoint is string)
        || ((string)endpoint).Length < 1 || ((string)endpoint).Length > 512
        || ((string)endpoint).IndexOfAny(new char[] { '\0', '\r', '\n' }) >= 0)
        throw new AudioFailure("command_invalid");
      return (string)endpoint;
    }
    public void Controls() {
      try {
        while (!stopping.WaitOne(0)) {
          var command = Read();
          if (command == null) { stopping.Set(); return; }
          object action;
          if (!command.TryGetValue("command", out action)) throw new AudioFailure("command_invalid");
          if (Equals(action, "stop") && command.Count == 1) { stopping.Set(); return; }
          object id; Guid parsed;
          if (!Equals(action, "flush") || command.Count != 2 || !command.TryGetValue("id", out id)
            || !(id is string) || !Guid.TryParseExact((string)id, "D", out parsed)) throw new AudioFailure("command_invalid");
          lock (flushes) {
            if (flushes.Count >= 16) throw new AudioFailure("command_limit");
            flushes.Enqueue((string)id);
          }
        }
      } catch { invalid = true; stopping.Set(); }
    }
    public void Flush(PcmConverter converter, Stream output) {
      lock (flushes) {
        while (flushes.Count > 0) {
          converter.Flush(); output.Flush();
          Write(new { @event = "flushed", id = flushes.Dequeue(), frames = converter.Frames });
        }
      }
    }
    public void AssertValid() { if (invalid) throw new AudioFailure("command_invalid"); }
    public void Write(object value) {
      lock (statusLock) { status.WriteLine(new JavaScriptSerializer().Serialize(value)); status.Flush(); }
    }
  }
}
