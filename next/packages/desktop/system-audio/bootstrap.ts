export const systemAudioBootstrap = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
  $directory = [Environment]::GetEnvironmentVariable('ORVUNIA_SYSTEM_AUDIO_DIRECTORY')
  $action = [Environment]::GetEnvironmentVariable('ORVUNIA_SYSTEM_AUDIO_ACTION')
  if ($action -ne 'enumerate' -and $action -ne 'capture') { throw 'Invalid audio action' }
  $sources = @('endpoints-interfaces.cs', 'audio-interfaces.cs', 'endpoints.cs', 'format.cs',
    'converter.cs', 'protocol.cs', 'capture.cs', 'host.cs') |
    ForEach-Object { Join-Path $directory $_ }
  Add-Type -Path $sources -ReferencedAssemblies 'System.Web.Extensions' | Out-Null
  exit ([OrvuniaSystemAudio.AudioHost]::Run($action))
} catch {
  [Console]::Error.WriteLine('{"event":"error","code":"helper_unavailable"}')
  exit 1
}
`;
