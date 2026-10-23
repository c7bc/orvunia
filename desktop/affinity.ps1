param([long]$WindowHandle)
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class CadenceCaptureDiagnostic { [DllImport("user32.dll", SetLastError=true)] public static extern bool GetWindowDisplayAffinity(IntPtr hWnd, out uint affinity); }'
[uint32]$captureAffinity = 0
$captureResult = [CadenceCaptureDiagnostic]::GetWindowDisplayAffinity([IntPtr]$WindowHandle,[ref]$captureAffinity)
@{ok=$captureResult;affinity=$captureAffinity;excluded=($captureAffinity -eq 17)} | ConvertTo-Json -Compress
