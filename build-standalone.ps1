<#
.SYNOPSIS
  Build a self-contained "Overture Vivaldi": the latest official Vivaldi (standalone/portable install,
  its own profile inside the folder) with Overture applied. Copy the folder to any Windows 11 PC.

.DESCRIPTION
  Reads Vivaldi's official update feed, downloads the x64 installer from downloads.vivaldi.com,
  refuses it unless it carries a valid Authenticode signature from Vivaldi Technologies AS,
  installs it with --vivaldi-standalone into -Target, then runs install.ps1 against it.
  Vivaldi keeps updating itself in place; run install.ps1 -VivaldiPath <Target> -AutoRepatch on the
  PC that uses it so Overture is re-applied after each update.

.EXAMPLE
  .\build-standalone.ps1                                # -> .\dist\Overture-Vivaldi
.EXAMPLE
  .\build-standalone.ps1 -Target D:\Apps\Overture-Vivaldi
#>
param(
  [string]$Target = (Join-Path $PSScriptRoot 'dist\Overture-Vivaldi'),
  [switch]$FromOpera # personal builds only: puts this PC's Opera workspace names and artwork into the build
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # Invoke-WebRequest is very slow with the progress bar on PS 5.1

$feed = [xml](Invoke-WebRequest 'https://update.vivaldi.com/update/1.0/public/appcast.x64.xml' -UseBasicParsing).Content
$enc = $feed.rss.channel.item.enclosure | Select-Object -First 1   # full installer, not a delta
$url = $enc.url
if ($url -notmatch '^https://downloads\.vivaldi\.com/') { throw "Unexpected download host: $url" }
$exe = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetFileName($url))
Write-Host "Downloading Vivaldi $($enc.version) ..."
Invoke-WebRequest $url -OutFile $exe -UseBasicParsing

$sig = Get-AuthenticodeSignature $exe
if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'O=Vivaldi Technologies AS') {
  Remove-Item $exe -Force
  throw "Installer signature check failed ($($sig.Status), $($sig.SignerCertificate.Subject))."
}

Write-Host "Installing standalone Vivaldi into $Target ..."
New-Item -ItemType Directory -Force $Target | Out-Null
$p = Start-Process $exe -ArgumentList '--vivaldi-silent', '--do-not-launch-chrome', '--vivaldi-standalone', "--vivaldi-install-dir=`"$Target`"" -Wait -PassThru
Remove-Item $exe -Force
if ($p.ExitCode -ne 0) { throw "Vivaldi installer exited with $($p.ExitCode)." }

& (Join-Path $PSScriptRoot 'install.ps1') -VivaldiPath $Target -FromOpera:$FromOpera
Write-Host "Done. Start $Target\Application\vivaldi.exe (restart it once after the first launch)."
