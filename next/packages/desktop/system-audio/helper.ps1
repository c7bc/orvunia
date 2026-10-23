param([ValidateSet('enumerate', 'capture', 'selftest')][string]$Action = 'enumerate')
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
  $sources = @('endpoints-interfaces.cs', 'audio-interfaces.cs', 'endpoints.cs', 'format.cs',
    'converter.cs', 'protocol.cs', 'capture.cs', 'host.cs') |
    ForEach-Object { Join-Path $PSScriptRoot $_ }
  if ($Action -eq 'selftest') {
    $sources += Join-Path $PSScriptRoot '../../../tests/support/system-audio-selftest.cs'
  }
  Add-Type -Path $sources -ReferencedAssemblies 'System.Web.Extensions' | Out-Null
  $result = [OrvuniaSystemAudio.AudioHost]::Run($Action)
  exit $result
} catch {
  [Console]::Error.WriteLine('{"event":"error","code":"helper_unavailable"}')
  exit 1
}
