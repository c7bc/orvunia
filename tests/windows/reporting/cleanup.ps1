param([Parameter(Mandatory)][string]$State)
$ErrorActionPreference = 'Stop'
$text = & node (Join-Path $PSScriptRoot '../contract.mjs') $State
if ($LASTEXITCODE -ne 0) { throw 'Owned runner context required' }
$qa = ($text | ConvertFrom-Json).state
$remaining = @(Get-CimInstance Win32_Process | Where-Object {
  $_.ExecutablePath -and $_.ExecutablePath.StartsWith($qa.root + '\', [StringComparison]::OrdinalIgnoreCase)
})
$proof = @{ ownedExecutableProcessesRemaining = $remaining.Count; profileUploaded = $false;
  globalProcessKill = $false; runnerDisposalRequired = $true }
[IO.File]::WriteAllText((Join-Path $qa.evidence 'reporting-cleanup.json'), ($proof | ConvertTo-Json))
if ($remaining.Count) { throw 'Owned reporting executable survived; runner disposal required' }
