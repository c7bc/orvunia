param([Parameter(Mandatory)][string]$State, [ValidateSet('first-launch','lifecycle')][string]$Suite = 'first-launch')
$ErrorActionPreference = 'Stop'
$contractText = & node (Join-Path $PSScriptRoot 'contract.mjs') $State
if ($LASTEXITCODE -ne 0) { throw 'Runner context validation failed' }
$contract = $contractText | ConvertFrom-Json; $qa = $contract.state
. (Join-Path $PSScriptRoot 'lifecycle-support.ps1')
$final = Get-Content -LiteralPath (Join-Path $qa.evidence 'build.json') -Raw | ConvertFrom-Json
if ($final.version -ne $contract.desktopVersion -or $final.appId -ne $contract.appId) { throw 'Final build contract differs' }
if (Test-Path -LiteralPath $qa.installation) { throw 'QA installation destination must be new' }
if ($qa.installation.Length -gt $final.pathGuard.maximumDirectoryLength) { throw 'QA installation path exceeds supported budget' }
$uninstallRoot = 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall'
$existing = @()
if (Test-Path -LiteralPath $uninstallRoot) {
  $existing = @(Get-ChildItem -LiteralPath $uninstallRoot | ForEach-Object {
    if ((Get-ItemProperty -LiteralPath $_.PSPath).DisplayName -eq $contract.productName) { $_.PSPath }
  })
}
if ($existing.Count) { throw 'Pre-existing QA registration cannot be replaced' }
$report = [ordered]@{ status = 'running'; suite = $Suite; windows11Qualified = $false; windowsStoreQualified = $false;
  baselineTested = $false; upgradeTested = $false; physicalAudioTested = $false; providerCalls = 0;
  syntheticProfile = $true; steps = @(); registrations = @(); installationRemoved = $false }
$registration = $null
function Run-Native([string]$Phase) { Invoke-OwnedProcess (Get-Command node).Source @((Join-Path $PSScriptRoot 'native.mjs'), $State, $Phase) ('native-' + $Phase) }
try {
  if ($Suite -eq 'lifecycle') {
    $baseline = Join-Path $qa.baseline $contract.baseline.name
    if ((Get-FileHash -LiteralPath $baseline -Algorithm SHA256).Hash.ToLowerInvariant() -ne $contract.baseline.sha256) { throw 'Baseline checksum differs' }
    Invoke-OwnedProcess $baseline @('/S', ('/D=' + $qa.installation)) 'install-baseline' -DeadlineSeconds 600
    Assert-Registration $contract.baseline.version
    Assert-Archive $contract.baseline.archiveSha256 $contract.baseline.runtimeManifestSha256
    Run-Native 'baseline'; Assert-NoOwnedProcesses; $report.baselineTested = $true
  }
  $setup = Join-Path $qa.distribution ('Orvunia-QA-Setup-' + $contract.desktopVersion + '.exe')
  if ((Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant() -ne $final.setupSha256) { throw 'Final installer checksum differs' }
  Invoke-OwnedProcess $setup @('/S', ('/D=' + $qa.installation)) 'install-final' -DeadlineSeconds 600
  Assert-Registration $contract.desktopVersion; Assert-Archive $final.archiveSha256 $final.runtimeManifestSha256
  Assert-FinalFiles; Run-Native 'update'; Assert-NoOwnedProcesses
  $report.upgradeTested = $Suite -eq 'lifecycle'
  Run-Native 'quit'; Assert-NoOwnedProcesses
  Invoke-OwnedProcess (Join-Path $qa.installation ('Uninstall ' + $contract.productName + '.exe')) @('/S') 'uninstall' -DeadlineSeconds 600
  $until = [DateTime]::UtcNow.AddSeconds(45)
  while (((Test-Path -LiteralPath $registration) -or (Test-Path -LiteralPath (Join-Path $qa.installation 'Orvunia QA.exe'))) -and
      [DateTime]::UtcNow -lt $until) { Start-Sleep -Milliseconds 200 }
  if ((Test-Path -LiteralPath $registration) -or (Test-Path -LiteralPath (Join-Path $qa.installation 'Orvunia QA.exe'))) { throw 'Uninstall retained executable or registration' }
  if (-not (Test-Path -LiteralPath (Join-Path $qa.profile 'isolated-qa-profile.json'))) { throw 'Uninstall removed synthetic profile' }
  $report.installationRemoved = $true
  Run-Native 'reopen'; Assert-NoOwnedProcesses; $report.status = 'passed'
} catch { $report.status = 'failed'; $report.errorType = $_.Exception.GetType().Name; throw }
finally {
  if (-not $report.installationRemoved -and $registration -and (Test-Path -LiteralPath $registration)) {
    try {
      $entry = Get-ItemProperty -LiteralPath $registration
      if ($entry.DisplayName -eq $contract.productName -and
          (RegistrationDirectory $entry).Equals($qa.installation, [StringComparison]::OrdinalIgnoreCase)) {
        Invoke-OwnedProcess (Join-Path $qa.installation ('Uninstall ' + $contract.productName + '.exe')) @('/S') 'cleanup-owned-install' -DeadlineSeconds 600
        $report.cleanupRequested = $true
      }
    } catch { $report.cleanupUnconfirmed = $true }
  }
  [IO.File]::WriteAllText((Join-Path $qa.evidence 'lifecycle.json'), ($report | ConvertTo-Json -Depth 6))
}
