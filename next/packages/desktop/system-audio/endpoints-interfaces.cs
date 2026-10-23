using System;
using System.Runtime.InteropServices;
namespace OrvuniaSystemAudio {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  public class DeviceEnumerator { }
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IDevices {
    [PreserveSig] int EnumAudioEndpoints(int flow, uint state, out IDeviceCollection devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IDevice device);
    [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IDevice device);
    [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr callback);
    [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr callback);
  }
  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IDeviceCollection {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int Item(uint index, out IDevice device);
  }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IDevice {
    [PreserveSig] int Activate(ref Guid id, uint context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object value);
    [PreserveSig] int OpenPropertyStore(uint access, out IProperties properties);
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig] int GetState(out uint state);
  }
  [ComImport, Guid("1BE09788-6894-4089-8586-9A2A6C265AC5"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IEndpoint { [PreserveSig] int GetDataFlow(out int flow); }
  [StructLayout(LayoutKind.Sequential)] public struct PropertyKey { public Guid format; public uint property; }
  [StructLayout(LayoutKind.Explicit, Size = 24)] public struct PropertyValue {
    [FieldOffset(0)] public ushort type;
    [FieldOffset(8)] public IntPtr pointer;
  }
  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IProperties {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int GetAt(uint index, out PropertyKey key);
    [PreserveSig] int GetValue(ref PropertyKey key, out PropertyValue value);
    [PreserveSig] int SetValue(ref PropertyKey key, ref PropertyValue value);
    [PreserveSig] int Commit();
  }
}
