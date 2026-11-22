<#
.SYNOPSIS
  Copy workspaces, the sidebar selection and the sidebar icons from the Opera One on this PC.

.DESCRIPTION
  install.ps1 -FromOpera calls this. It reads, and never changes:
    - workspace names, icons and order, and which sidebar items are switched on, from Opera's Preferences
    - the icons themselves from Opera's opera.pak, found by the hash of their content
  Nothing else is read and nothing leaves the PC. The result is written into that Vivaldi installation only.
  It holds workspace names and Opera's artwork: don't commit or redistribute it.
#>
param(
  [Parameter(Mandatory)][string]$OutFile,
  [string]$OperaPath,   # folder that holds opera.exe
  [string]$OperaProfile = "$env:APPDATA\Opera Software\Opera Stable"
)
$ErrorActionPreference = 'Stop'
# SHA-256 of each uncompressed SVG in Opera One 140
$want = @{
  'C4E292361630EA136F8B0D77BA64C3525485929A1AE9207FD4AF905406451E81' = 'reading'
  '17778783F8604139920B9804EC7E55569691475F087EBC3C1363588B6FE5CB1D' = 'doc'
  'CBC842D7CCE293328C30654088B8FD9C2A5A164B2611BDD5E7B97DE8B16D310A' = 'home'
  '5BE36521C1CD76488719457C73F8FF3B63FE54050924E1143C9BE2E5EFF9817A' = 'star'
  '34DCB89315A7F54BB8E6AB2D63F6D3F67359731A951A9EFFB17A28617AE33EC8' = 'rocket'
  '478ADC8B35F522248FEB53B709009BE68767B439776269B2E60C7DDF2AB3E473' = 'fun'
  'A731480F736A8CB4C79E59895363FC53C754E5464015D497CBA4312EC35055F9' = 'hourglass'
  '789AA4C1863C37A4B59E06B2A3E799C48C8C011370798BCFBB3AB12EEFAA5938' = 'work'
  '4F8EBB49BB8E42F5D3562AC41DB9C8786B2572CB79CA81DB587DA4483702F1A7' = 'shopping'
  'B9FA990D8C3B2AA370AE5D5E2987C97C628BD9360FEC41298AD29DE2402C3CFB' = 'music'
  '88B7FB954A345EEC4B20E24F0806A7F4943CAEB58D0A69FC697A7E2EDD6899CC' = 'travel'
  '8FBDE1639AF2DB874B8819CE9E31B4DB4189D6469E6E7101775FBBA075D59946' = 'food'
  '26C2E19305FCBC748EF93C147E4884824998689D2BB3A1B4187BD1B0CC9645C4' = 'gaming'
  '943CDD1E186E2515A5725915F95E38B9A5309BD8D2959F0B0F44DE0517000EE6' = 'gift'
  '15BDDAF6CA00EEC6B3FB9F4D774F2467DAFE65B94A5AF64635C1629AC50FB45B' = 'bike'
  'FC99ED9D2C977C4DA441459ECA9EBB1FB6736827C68A11394E87957737F5AEDA' = 'car'
  'DC85AC87E79DAD02F54D0018A7C737C0F762FB1497927FE8C8EF8F5427FEAC9D' = 'crown'
  '8BC9C9D32ACBB04DF85E9E71AF3666AD7E642FA411BAB228DFAD217611FB208B' = 'day'
  'EF2BD0E6EC082610C4A7CC5F48513ED3ECA4DA727D18F428C81C04573B717D61' = 'heart'
  'CD3F5E0AF02549F4C286B601FCD9912CFF4A49A8648FA6BCDE93D02C6E023761' = 'leaf'
  '4340BDE3386A7776B31A76E4582D7307B5BA3CD52816423BE511388D2E41E451' = 'list'
  '9695AC0740AC1F5E796E87EEAC223C8B68A1D6280528AA26B595B89DD1C25D06' = 'night'
  '84DF131C62DCE382D431A7DE73EC7AD83D2C781CE804AE21B3FE6338627CFC20' = 'skull'
  '775B58B5666C75E2E67425C6E864B7FD0B714AEE033ABBF77BD913BCD917E875' = 'bookmarks'
  'E1CD738A6AE0473DF145BA0F01A692BC612394A7EF9BBAAE2A85F843BFFB5006' = 'history'
  'BE9F3440E1F1E992298CBAAB5BBC3405AF0F89CCC7C35B65AEF202B2013EB30F' = 'more'
  '0E6770060CC017EAFE1119EBAD137537BE7CF50E727B70EFE2C3C7DB463DFBAE' = 'ChatGPT'
  '4FBFA10EB185306294D4ED07A7FD9B056818450416B8482B27655274DEE284B3' = 'Gemini'
  '0F8DF1CC4298BB30757564E4289BF6A7B4A4B200585F178B4AE505DBC6771CD5' = 'Messenger'
  '93AE6D7E7F8EA5E17E11547517DC3F9C1B88CD894E4359B7F00DC0C85D6286E1' = 'WhatsApp'
  'CEEE817B3A6BF8722EE5F2EEA5344412322C0A90E1B4145929B974D6C1273E28' = 'Instagram'
  'D7DFF1BA3CC8BDC77B4A8C665FBA87002156E5E4E2609FD68BF7F87084ED6C05' = 'Discord'
  '92A6BFD8514C2E87165C088143B67BEC3164AC92CE537C19F7808DF71AEBB8EF' = 'Spotify'
  '4C6C6A062AE85D5D4AE79714639EC310FA59CD778BF78BE5064A1801BFAE5B89' = 'faeces'
}

function Read-Json([string]$path) {
  # Opera keeps the file open, and it has an empty key, which ConvertFrom-Json in PowerShell 5.1 rejects.
  $stream = New-Object IO.FileStream($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
  $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::UTF8)
  try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
  if ($PSVersionTable.PSVersion.Major -ge 6) { return ($text | ConvertFrom-Json -AsHashtable) }
  Add-Type -AssemblyName System.Web.Extensions
  $json = New-Object Web.Script.Serialization.JavaScriptSerializer
  $json.MaxJsonLength = [int]::MaxValue
  $json.RecursionLimit = 500
  return $json.DeserializeObject($text)
}

function Read-Icons {
  $found = [ordered]@{}
  $dirs = if ($OperaPath) { @($OperaPath) } else { @("$env:LOCALAPPDATA\Programs\Opera", "$env:ProgramFiles\Opera", "${env:ProgramFiles(x86)}\Opera") }
  $pak = $dirs | Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem $_ -Directory } |
    Where-Object { $_.Name -match '^\d+(\.\d+){3}$' -and (Test-Path (Join-Path $_.FullName 'opera.pak')) } |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'opera.pak' }
  if (-not $pak) { Write-Warning 'Opera is not installed here, so Overture keeps its own icons.'; return $found }
  $b = [IO.File]::ReadAllBytes($pak)
  if ([BitConverter]::ToUInt32($b, 0) -ne 5) { Write-Warning "Unknown resource format in $pak, so Overture keeps its own icons."; return $found }
  $sha = [Security.Cryptography.SHA256]::Create()
  $count = [BitConverter]::ToUInt16($b, 8)
  for ($i = 0; $i -lt $count; $i++) {
    $e = 12 + $i * 6
    $start = [int][BitConverter]::ToUInt32($b, $e + 2)
    $size = [int][BitConverter]::ToUInt32($b, $e + 8) - $start
    if ($size -lt 20 -or $size -gt 6000 -or $b[$start] -ne 0x1f -or $b[$start + 1] -ne 0x8b) { continue } # small gzip entries only
    $in = New-Object IO.MemoryStream($b, $start, $size)
    $gz = New-Object IO.Compression.GzipStream($in, [IO.Compression.CompressionMode]::Decompress)
    $out = New-Object IO.MemoryStream
    try { $gz.CopyTo($out) } catch [IO.InvalidDataException] { continue } finally { $gz.Dispose() }
    $data = $out.ToArray()
    $name = $want[[BitConverter]::ToString($sha.ComputeHash($data)).Replace('-', '')]
    if ($name) { $found[$name] = [Text.Encoding]::UTF8.GetString($data) }
  }
  if ($found.Count -lt $want.Count) { Write-Warning "Found $($found.Count) of $($want.Count) Opera icons; the others use Overture's own." }
  return $found
}

$result = [ordered]@{}
$icons = Read-Icons
if ($icons.Count) { $result.icons = $icons }

$file = "$OperaProfile\Default\Preferences", "$OperaProfile\Preferences" | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($file) {
  $ui = (Read-Json $file)['ui']
  $ws = if ($ui -and $ui['workspaces']) { $ui['workspaces']['config'] }
  if ($ws -and $ws['order'] -and $ws['names']) {
    $list = @()
    foreach ($key in $ws['order']) {
      $k = [string]$key
      if (-not $ws['names'][$k]) { continue }
      if ($ws['id'] -and $ws['id'][$k] -eq $false) { continue } # switched off in Opera
      $icon = if ($ws['icons']) { [string]$ws['icons'][$k] -replace '-icon$', '' } else { '' }
      $emoji = if ($ws['emoji_icons'] -and $ws['emoji_icons'][$k] -is [string]) { $ws['emoji_icons'][$k] } else { '' }
      $list += [ordered]@{ name = [string]$ws['names'][$k]; icon = $icon; emoji = $emoji }
    }
    if ($list.Count) { $result.workspaces = $list }
  }
  $side = if ($ui -and $ui['browser'] -and $ui['browser']['sidebar']) { $ui['browser']['sidebar']['item_prefs'] }
  $visible = if ($side) { $side['visibility'] }
  if ($visible) {
    $map = [ordered]@{ ChatGpt = 'ChatGPT'; Gemini = 'Gemini'; FacebookMessenger = 'Messenger'; Whatsapp = 'WhatsApp'; Instagram = 'Instagram'; Discord = 'Discord'; Player = 'Spotify'; Bookmarks = 'Bookmarks'; History = 'History' }
    $on = @($map.Keys | Where-Object { $visible[$_] -eq $true } | ForEach-Object { $map[$_] })
    if ($on.Count) { $result.sidebar = $on }
  }
} else { Write-Warning "No Opera profile at $OperaProfile, so there are no workspaces to copy." }

if (-not $result.Count) { Write-Warning 'Nothing to copy from Opera.'; return }
$json = $result | ConvertTo-Json -Compress -Depth 5
# ASCII only, so names survive whatever encoding the page is read with
$json = [regex]::Replace($json, '[^\x00-\x7F]', [Text.RegularExpressions.MatchEvaluator] { param($m) '\u{0:x4}' -f [int][char]$m.Value })
[IO.File]::WriteAllText($OutFile, "// Read from this PC's Opera by from-opera.ps1: workspace names and Opera's artwork. Don't redistribute.`nwindow.overtureOpera = $json;`n")
Write-Host ("From Opera: {0} workspaces, {1} sidebar items, {2} icons." -f @($result.workspaces | Where-Object { $_ }).Count, @($result.sidebar | Where-Object { $_ }).Count, $icons.Count)
