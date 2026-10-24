$ErrorActionPreference = 'Stop'
function Invoke-OwnedProcess([string]$Executable, [string[]]$Arguments, [string]$Label, [int]$Expected = 0, [int]$DeadlineSeconds = 240) {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $Executable; $info.UseShellExecute = $false; $info.CreateNoWindow = $true
  $info.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden; $info.WorkingDirectory = $qa.root
  $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true; $info.Environment.Clear()
  foreach ($name in @('PATH','PATHEXT','SystemRoot','SystemDrive','windir','ComSpec','USERPROFILE','LOCALAPPDATA','APPDATA',
    'TEMP','TMP','ProgramFiles','ProgramFiles(x86)','ProgramData','HOMEDRIVE','HOMEPATH','ALLUSERSPROFILE',
    'NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','GITHUB_ACTIONS','GITHUB_REPOSITORY','GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT','GITHUB_SHA','RUNNER_ENVIRONMENT','RUNNER_OS','RUNNER_TEMP')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value) { $info.Environment[$name] = $value }
  }
  foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::new(); $process.StartInfo = $info
  $stdout = $null; $stderr = $null
  try {
    [void]$process.Start(); $stdout = $process.StandardOutput.ReadToEndAsync(); $stderr = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($DeadlineSeconds * 1000)) {
      $process.Kill($true); $process.WaitForExit()
      $report.timeoutCleanup = 'Owned process tree termination requested; runner disposal remains required'
      throw 'Owned QA process exceeded deadline'
    }
    $report.steps += @{ label = $Label; exitCode = $process.ExitCode }
    if ($process.ExitCode -ne $Expected) { throw ('QA process failed: ' + $Label + ' exit ' + $process.ExitCode) }
  } finally {
    if ($stdout) { [IO.File]::WriteAllText((Join-Path $qa.root ($Label + '.stdout.log')), $stdout.GetAwaiter().GetResult()) }
    if ($stderr) { [IO.File]::WriteAllText((Join-Path $qa.root ($Label + '.stderr.log')), $stderr.GetAwaiter().GetResult()) }
    $process.Dispose()
  }
}
function RegistrationDirectory($Entry) {
  if ($Entry.InstallLocation) { return [IO.Path]::GetFullPath($Entry.InstallLocation).TrimEnd('\') }
  if ($Entry.UninstallString -match '^"([^"]+)"') { return [IO.Path]::GetDirectoryName($Matches[1]) }
  throw 'QA registration does not identify an absolute installation directory'
}
function Assert-Registration([string]$Version) {
  $matches = @(Get-ChildItem HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall | ForEach-Object {
    $entry = Get-ItemProperty -LiteralPath $_.PSPath
    if ($entry.DisplayName -eq $contract.productName) { @{ path = $_.PSPath; entry = $entry } }
  })
  if ($matches.Count -ne 1) { throw 'Expected exactly one QA registration' }
  $candidate = $matches[0]
  if ($candidate.entry.DisplayVersion -ne $Version -or
      -not (RegistrationDirectory $candidate.entry).Equals($qa.installation, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'QA registration version or installation ownership differs'
  }
  $script:registration = $candidate.path
  $report.registrations += @{ version = $Version; ownershipMatched = $true }
}
function Assert-Archive([string]$ExpectedArchive, [string]$RuntimeManifest) {
  $archive = Join-Path $qa.installation 'resources/app.asar'
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedArchive) { throw 'Installed ASAR changed' }
  $manifest = Join-Path $qa.installation 'resources/cadence-runtime/backend-release.json'
  if ((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash.ToLowerInvariant() -ne $RuntimeManifest) { throw 'Installed runtime changed' }
}
function Assert-FinalFiles {
  $expected = Join-Path $qa.distribution 'win-unpacked'
  $count = 0
  $allowed = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($file in Get-ChildItem -LiteralPath $expected -File -Recurse) {
    if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reference file is redirected' }
    $relative = [IO.Path]::GetRelativePath($expected, $file.FullName); [void]$allowed.Add($relative)
    $target = Join-Path $qa.installation $relative
    if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or
      (Get-Item -LiteralPath $target).Length -ne $file.Length -or
      (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash) {
      throw 'Installed file differs from exact final package'
    }
    $count++
  }
  [void]$allowed.Add('Uninstall ' + $contract.productName + '.exe')
  foreach ($file in Get-ChildItem -LiteralPath $qa.installation -File -Recurse) {
    if (-not $allowed.Contains([IO.Path]::GetRelativePath($qa.installation, $file.FullName))) { throw 'Unexpected obsolete installed file' }
  }
  $report.finalInstalledFilesVerified = $count
}
function Assert-NoOwnedProcesses {
  $owned = @(Get-CimInstance Win32_Process | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($qa.root + '\', [StringComparison]::OrdinalIgnoreCase)
  })
  if ($owned.Count) { $report.orphanProcessCount = $owned.Count; throw 'Owned QA executable survived shutdown' }
  $report.orphanProcessCount = 0
}
