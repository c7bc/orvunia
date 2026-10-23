using System;
using System.IO;
using System.Threading;
using System.Web.Script.Serialization;
namespace OrvuniaSystemAudio {
  public static class AudioHost {
    public static int Run(string action) {
      var protocol = new AudioProtocol(Console.In, Console.Error);
      Exception failure = null;
      var worker = new Thread(delegate() {
        try {
          if (action == "enumerate") { Console.Out.WriteLine(new JavaScriptSerializer().Serialize(Endpoints.List())); return; }
          if (action == "selftest") {
            var tests = typeof(AudioHost).Assembly.GetType("OrvuniaSystemAudio.SyntheticTest", true);
            Console.Out.WriteLine(tests.GetMethod("Run").Invoke(null, null)); return;
          }
          if (action != "capture") throw new AudioFailure("command_invalid");
          string selected = protocol.Start();
          if (selected == null) { protocol.Write(new { @event = "stopped", frames = 0, discontinuities = 0 }); return; }
          var controls = new Thread(protocol.Controls); controls.IsBackground = true; controls.Start();
          using (var output = Console.OpenStandardOutput()) Capture.Run(selected, protocol, output);
        } catch (Exception error) { failure = error; }
      });
      worker.SetApartmentState(ApartmentState.MTA); worker.Start(); worker.Join();
      if (failure == null) return 0;
      var audioFailure = failure as AudioFailure;
      string code = audioFailure == null ? "capture_failed" : audioFailure.Code;
      if (failure.HResult == unchecked((int)0x88890004) || failure.HResult == unchecked((int)0x80070490)) code = "endpoint_unavailable";
      protocol.Write(new { @event = "error", code = code, hresult = "0x" + failure.HResult.ToString("X8") });
      return 1;
    }
  }
}
