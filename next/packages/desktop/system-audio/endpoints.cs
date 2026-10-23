using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
namespace OrvuniaSystemAudio {
  public class EndpointDescription {
    public string id, name;
    public bool defaultConsole, defaultMultimedia, defaultCommunications;
  }
  public class EndpointDefaults { public string console, multimedia, communications; }
  public class EndpointCatalog {
    public bool supported = true;
    public List<EndpointDescription> endpoints = new List<EndpointDescription>();
    public EndpointDefaults defaults = new EndpointDefaults();
  }
  public static class Endpoints {
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropertyValue value);
    public static void Release(object value) { if (value != null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value); }
    public static IDevice Select(IDevices devices, string selected) {
      IDevice device;
      if (selected.StartsWith("default:", StringComparison.Ordinal)) {
        int role = selected == "default:console" ? 0 : selected == "default:multimedia" ? 1
          : selected == "default:communications" ? 2 : -1;
        if (role < 0) throw new AudioFailure("endpoint_invalid");
        Marshal.ThrowExceptionForHR(devices.GetDefaultAudioEndpoint(0, role, out device));
      } else Marshal.ThrowExceptionForHR(devices.GetDevice(selected, out device));
      try {
        uint state; int flow;
        Marshal.ThrowExceptionForHR(device.GetState(out state));
        Marshal.ThrowExceptionForHR(((IEndpoint)device).GetDataFlow(out flow));
        if (state != 1 || flow != 0) throw new AudioFailure("endpoint_unavailable");
        return device;
      } catch { Release(device); throw; }
    }
    static string FriendlyName(IDevice device) {
      IProperties properties; Marshal.ThrowExceptionForHR(device.OpenPropertyStore(0, out properties));
      try {
        var key = new PropertyKey { format = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), property = 14 };
        PropertyValue value; Marshal.ThrowExceptionForHR(properties.GetValue(ref key, out value));
        try { return value.type == 31 ? Marshal.PtrToStringUni(value.pointer) : "Audio endpoint"; }
        finally { PropVariantClear(ref value); }
      } finally { Release(properties); }
    }
    static string Default(IDevices devices, int role) {
      IDevice device;
      if (devices.GetDefaultAudioEndpoint(0, role, out device) < 0) return null;
      try { string id; Marshal.ThrowExceptionForHR(device.GetId(out id)); return id; }
      finally { Release(device); }
    }
    public static EndpointCatalog List() {
      var result = new EndpointCatalog();
      var devices = (IDevices)new DeviceEnumerator();
      try {
        result.defaults.console = Default(devices, 0);
        result.defaults.multimedia = Default(devices, 1);
        result.defaults.communications = Default(devices, 2);
        IDeviceCollection collection; Marshal.ThrowExceptionForHR(devices.EnumAudioEndpoints(0, 1, out collection));
        try {
          uint count; Marshal.ThrowExceptionForHR(collection.GetCount(out count));
          if (count > 256) throw new AudioFailure("endpoint_limit");
          for (uint index = 0; index < count; index++) {
            IDevice device; Marshal.ThrowExceptionForHR(collection.Item(index, out device));
            try {
              string id; Marshal.ThrowExceptionForHR(device.GetId(out id));
              result.endpoints.Add(new EndpointDescription { id = id, name = FriendlyName(device),
                defaultConsole = id == result.defaults.console, defaultMultimedia = id == result.defaults.multimedia,
                defaultCommunications = id == result.defaults.communications });
            } finally { Release(device); }
          }
        } finally { Release(collection); }
      } finally { Release(devices); }
      return result;
    }
  }
}
