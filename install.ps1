<#
.SYNOPSIS
  Install, update or remove the Overture mod in a Vivaldi installation (Windows).

.DESCRIPTION
  Copies mod\ into <Vivaldi>\Application\<version>\resources\vivaldi\overture and adds one line of
  <link>/<script> tags to window.html. Vivaldi replaces that folder on every update, so run this
  again after updating, or pass -AutoRepatch once to have Windows re-apply it hourly and at logon.
  Restart Vivaldi after installing.

.EXAMPLE
  .\install.ps1                                   # auto-detect a per-user or system Vivaldi
.EXAMPLE
  .\install.ps1 -VivaldiPath D:\Portable\Vivaldi  # standalone/portable copy (folder holding Application\)
.EXAMPLE
  .\install.ps1 -AutoRepatch                      # also register the "Overture re-patch" scheduled task
.EXAMPLE
  .\install.ps1 -FromOpera                        # copy workspaces, sidebar and icons from the Opera on this PC
.EXAMPLE
  .\install.ps1 -Uninstall                        # remove the mod (and the scheduled task)
#>
param(
  [string]$VivaldiPath,
  [switch]$Uninstall,
  [switch]$AutoRepatch,
  [switch]$FromOpera,
  [switch]$Quiet
)
$ErrorActionPreference = 'Stop'
$mod = Join-Path $PSScriptRoot 'mod'
$marker = '<!-- overture -->'
$head = $marker + '<link rel="stylesheet" href="overture/overture.css" /><script src="overture/layout.js"></script>'
$tail = '<script src="overture/icons.js"></script><script src="overture/overture.js"></script>'
$taskName = 'Overture re-patch'
function Say($m) { if (-not $Quiet) { Write-Host $m } }

function Get-AppDirs {
  $cands = if ($VivaldiPath) { @($VivaldiPath, (Join-Path $VivaldiPath 'Application')) }
           else { @("$env:LOCALAPPDATA\Vivaldi\Application", "$env:ProgramFiles\Vivaldi\Application", "${env:ProgramFiles(x86)}\Vivaldi\Application") }
  $cands | Where-Object { $_ -and (Test-Path (Join-Path $_ 'vivaldi.exe')) } | ForEach-Object { (Resolve-Path $_).Path } | Select-Object -Unique
}

$apps = @(Get-AppDirs)
if (-not $apps) { throw "Vivaldi not found. Pass -VivaldiPath <folder containing vivaldi.exe or Application\>." }

foreach ($app in $apps) {
  $versions = Get-ChildItem $app -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'resources\vivaldi\window.html') }
  foreach ($v in $versions) {
    $res = Join-Path $v.FullName 'resources\vivaldi'
    $html = Join-Path $res 'window.html'
    try {
      $text = [IO.File]::ReadAllText($html)
      if (-not (Test-Path "$html.overture-bak") -and $text -notmatch [regex]::Escape($marker)) { Copy-Item $html "$html.overture-bak" }
      $text = [regex]::Replace($text, '\r?\n?' + [regex]::Escape($marker) + '[^\r\n]*', '')
      if ($Uninstall) {
        Remove-Item (Join-Path $res 'overture') -Recurse -Force -ErrorAction SilentlyContinue
        Say "Removed Overture from $($v.FullName)"
      } else {
        if ($text -notmatch '</body>') { throw "Unexpected window.html layout in $res (no </body>); not patching." }
        New-Item -ItemType Directory -Force (Join-Path $res 'overture') | Out-Null
        Copy-Item (Join-Path $mod '*') (Join-Path $res 'overture') -Recurse -Force
        $extra = Join-Path $res 'overture\from-opera.js' # what was read from Opera, kept across re-installs
        if ($FromOpera) { & (Join-Path $PSScriptRoot 'from-opera.ps1') -OutFile $extra }
        $opera = if (Test-Path $extra) { '<script src="overture/from-opera.js"></script>' } else { '' }
        $text = $text -replace '</body>', "$head$opera$tail`n</body>"
        Say "Installed Overture into $($v.FullName)"
      }
      [IO.File]::WriteAllText($html, $text) # UTF-8 without BOM on both PowerShell 5.1 and 7
    } catch [UnauthorizedAccessException] {
      throw "No write access to $res. Run this from an elevated (Administrator) PowerShell for system-wide installs."
    }
  }
}

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false; Say "Removed scheduled task '$taskName'." }
  Say 'Done. Restart Vivaldi. (Settings Overture changed stay; see README "Undo settings".)'
  return
}

if ($AutoRepatch) {
  $argList = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" -Quiet" + $(if ($VivaldiPath) { " -VivaldiPath `"$VivaldiPath`"" } else { '' }) + $(if ($FromOpera) { ' -FromOpera' } else { '' })
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argList
  $triggers = @(
    (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME),
    (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1))
  )
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 2)) -Force | Out-Null
  Say "Registered scheduled task '$taskName' (re-applies Overture after Vivaldi updates)."
}
Say 'Done. Restart Vivaldi to load Overture.'
