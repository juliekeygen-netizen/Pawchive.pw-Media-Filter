[CmdletBinding()]
param(
    [ValidateSet('Auto', 'Chrome', 'Edge', 'Brave')]
    [string]$Browser = 'Auto',

    [ValidateSet('watch-all', 'watch-missing', 'resume-missing', 'retry-missing', 'start-missing', 'watch-profiles', 'resume-profiles', 'retry-profiles', 'start-profiles')]
    [string]$Mode = 'watch-all',

    [string]$ProfileDirectory = '',
    [string]$UserDataDirectory = '',

    [switch]$AllowBrowserAlreadyRunning,
    [switch]$NoKeepAwake,
    [switch]$Once,
    [switch]$CloseBrowserOnExit,

    [ValidateRange(5, 300)]
    [int]$RestartDelaySeconds = 15,

    [ValidateRange(1, 30)]
    [int]$StatusPollSeconds = 2,

    [ValidateRange(5, 300)]
    [int]$ProgressLogIntervalSeconds = 30,

    [string]$LogPath = "$PSScriptRoot\PawchiveMetadataRunner.log"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PmfRunnerNative {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
'@

$ES_CONTINUOUS       = [Convert]::ToUInt32('80000000', 16)
$ES_SYSTEM_REQUIRED  = [uint32]0x00000001
$ES_AWAYMODE_REQUIRED = [uint32]0x00000040
$SW_MINIMIZE = 6

$script:MaintenanceRootProcessId = 0
$script:MaintenanceSessionStarted = $false
$script:ResolvedLogPath = ''
$script:LogFailureReported = $false
$script:LastProgressTitle = ''
$script:LastProgressLogAt = [datetime]::MinValue
$script:HandshakeEstablished = $false

function Initialize-RunnerLog {
    try {
        $expanded = [Environment]::ExpandEnvironmentVariables($LogPath)
        if (-not [IO.Path]::IsPathRooted($expanded)) {
            $expanded = Join-Path (Get-Location) $expanded
        }
        $full = [IO.Path]::GetFullPath($expanded)
        $parent = Split-Path -Parent $full
        if ($parent -and -not (Test-Path -LiteralPath $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        if (-not (Test-Path -LiteralPath $full)) {
            New-Item -ItemType File -Path $full -Force | Out-Null
        }
        $script:ResolvedLogPath = $full
    } catch {
        $fallback = Join-Path $env:TEMP 'PawchiveMetadataRunner.log'
        New-Item -ItemType File -Path $fallback -Force -ErrorAction SilentlyContinue | Out-Null
        $script:ResolvedLogPath = $fallback
        Write-Warning "Could not initialize the requested log path '$LogPath'. Falling back to '$fallback': $($_.Exception.Message)"
    }
}

function Write-RunnerLog {
    param([Parameter(Mandatory)][string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    try {
        if (-not $script:ResolvedLogPath) { Initialize-RunnerLog }
        Add-Content -LiteralPath $script:ResolvedLogPath -Value $line -Encoding UTF8 -ErrorAction Stop
    } catch {
        if (-not $script:LogFailureReported) {
            $script:LogFailureReported = $true
            Write-Warning "Could not write the Pawchive runner log '$script:ResolvedLogPath': $($_.Exception.Message)"
        }
    }
}


function Resolve-Browser {
    $candidates = @()

    if ($Browser -in @('Auto', 'Chrome')) {
        $candidates += @(
            @{ Name = 'Chrome'; Process = 'chrome'; Executable = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"; Data = "$env:LOCALAPPDATA\Google\Chrome\User Data" },
            @{ Name = 'Chrome'; Process = 'chrome'; Executable = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"; Data = "$env:LOCALAPPDATA\Google\Chrome\User Data" },
            @{ Name = 'Chrome'; Process = 'chrome'; Executable = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"; Data = "$env:LOCALAPPDATA\Google\Chrome\User Data" }
        )
    }

    if ($Browser -in @('Auto', 'Edge')) {
        $candidates += @(
            @{ Name = 'Edge'; Process = 'msedge'; Executable = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"; Data = "$env:LOCALAPPDATA\Microsoft\Edge\User Data" },
            @{ Name = 'Edge'; Process = 'msedge'; Executable = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"; Data = "$env:LOCALAPPDATA\Microsoft\Edge\User Data" }
        )
    }

    if ($Browser -in @('Auto', 'Brave')) {
        $candidates += @(
            @{ Name = 'Brave'; Process = 'brave'; Executable = "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe"; Data = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data" },
            @{ Name = 'Brave'; Process = 'brave'; Executable = "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe"; Data = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data" },
            @{ Name = 'Brave'; Process = 'brave'; Executable = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"; Data = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data" }
        )
    }

    $match = $candidates | Where-Object { Test-Path -LiteralPath $_.Executable } | Select-Object -First 1
    if (-not $match) {
        throw 'Chrome, Microsoft Edge, or Brave was not found. Pass -Browser Chrome, -Browser Edge, or -Browser Brave after installing one.'
    }

    if ($UserDataDirectory) {
        $match.Data = [Environment]::ExpandEnvironmentVariables($UserDataDirectory)
    }

    if (-not (Test-Path -LiteralPath $match.Data)) {
        throw "Browser user-data directory was not found: $($match.Data)"
    }

    return $match
}


function Resolve-ProfileDirectory {
    param([Parameter(Mandatory)]$BrowserInfo)

    if ($ProfileDirectory) {
        $candidate = Join-Path $BrowserInfo.Data $ProfileDirectory
        if (-not (Test-Path -LiteralPath $candidate)) {
            $available = @(Get-ChildItem -LiteralPath $BrowserInfo.Data -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' } |
                Select-Object -ExpandProperty Name)
            throw "Browser profile '$ProfileDirectory' was not found under $($BrowserInfo.Data). Available profiles: $($available -join ', ')"
        }
        return $ProfileDirectory
    }

    $localStatePath = Join-Path $BrowserInfo.Data 'Local State'
    if (Test-Path -LiteralPath $localStatePath) {
        try {
            $localState = Get-Content -LiteralPath $localStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
            $lastUsed = [string]$localState.profile.last_used
            if ($lastUsed -and (Test-Path -LiteralPath (Join-Path $BrowserInfo.Data $lastUsed))) {
                return $lastUsed
            }
        } catch {
            Write-RunnerLog "Could not read Chromium's last-used profile from Local State: $($_.Exception.Message)"
        }
    }

    if (Test-Path -LiteralPath (Join-Path $BrowserInfo.Data 'Default')) { return 'Default' }
    $fallback = Get-ChildItem -LiteralPath $BrowserInfo.Data -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'Profile *' } | Sort-Object Name | Select-Object -First 1
    if ($fallback) { return $fallback.Name }
    throw "No Chromium profile directory was found under $($BrowserInfo.Data)."
}

function Test-TampermonkeyInstalled {
    param([Parameter(Mandatory)]$BrowserInfo, [Parameter(Mandatory)][string]$ResolvedProfile)
    $extensions = Join-Path (Join-Path $BrowserInfo.Data $ResolvedProfile) 'Extensions'
    if (-not (Test-Path -LiteralPath $extensions)) { return $false }
    if (Test-Path -LiteralPath (Join-Path $extensions 'dhdgffkkebhmkfjojejmpbldmpobfkfo')) { return $true }
    try {
        foreach ($manifest in Get-ChildItem -LiteralPath $extensions -Filter manifest.json -File -Recurse -ErrorAction SilentlyContinue) {
            if ((Get-Content -LiteralPath $manifest.FullName -Raw -ErrorAction SilentlyContinue) -match 'Tampermonkey') { return $true }
        }
    } catch { }
    return $false
}

function Get-MaintenanceProcesses {
    param([Parameter(Mandatory)]$BrowserInfo)
    $needle = 'pmf_maintenance=' + $Mode
    try {
        return @(Get-CimInstance Win32_Process -Filter "Name = '$($BrowserInfo.Process).exe'" |
            Where-Object { $_.CommandLine -and $_.CommandLine.Contains($needle) })
    } catch {
        return @()
    }
}

function Test-MaintenanceBrowserRunning {
    param([Parameter(Mandatory)]$BrowserInfo)

    if ($script:MaintenanceRootProcessId -gt 0) {
        $root = Get-Process -Id $script:MaintenanceRootProcessId -ErrorAction SilentlyContinue
        if ($root -and -not $root.HasExited) { return $true }
    }

    $maintenanceProcesses = @(Get-MaintenanceProcesses -BrowserInfo $BrowserInfo)
    if ($maintenanceProcesses.Count -gt 0) { return $true }
    if ($AllowBrowserAlreadyRunning -and $script:MaintenanceSessionStarted) {
        return (@(Get-Process -Name $BrowserInfo.Process -ErrorAction SilentlyContinue).Count -gt 0)
    }
    return $false
}

function Minimize-MaintenanceWindows {
    param([Parameter(Mandatory)]$BrowserInfo)
    $maintenanceIds = @(Get-MaintenanceProcesses -BrowserInfo $BrowserInfo | ForEach-Object { [int]$_.ProcessId })
    foreach ($id in $maintenanceIds) {
        $process = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($process -and $process.MainWindowHandle -ne 0) {
            [void][PmfRunnerNative]::ShowWindowAsync($process.MainWindowHandle, $SW_MINIMIZE)
        }
    }
}

function Get-MaintenanceStatusTitle {
    param([Parameter(Mandatory)]$BrowserInfo)
    $candidates = @()
    foreach ($item in @(Get-MaintenanceProcesses -BrowserInfo $BrowserInfo)) {
        $process = Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue
        if ($process -and $process.MainWindowTitle) { $candidates += [string]$process.MainWindowTitle }
    }
    if (-not $candidates.Count -and $script:MaintenanceRootProcessId -gt 0) {
        $root = Get-Process -Id $script:MaintenanceRootProcessId -ErrorAction SilentlyContinue
        if ($root -and $root.MainWindowTitle) { $candidates += [string]$root.MainWindowTitle }
    }
    if (-not $candidates.Count) {
        $candidates += @(Get-Process -Name $BrowserInfo.Process -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowTitle -like 'PMF Runner |*' } |
            ForEach-Object { [string]$_.MainWindowTitle })
    }
    return @($candidates | Where-Object { $_ -like 'PMF Runner |*' } | Select-Object -First 1)[0]
}

function Update-RunnerProgress {
    param([Parameter(Mandatory)]$BrowserInfo, [switch]$ForceLog)
    $title = Get-MaintenanceStatusTitle -BrowserInfo $BrowserInfo
    if (-not $title) { return $false }

    $status = $title -replace '^PMF Runner\s*\|\s*', ''
    $percent = -1
    if ($status -match '\((\d{1,3})%\)') {
        $percent = [Math]::Max(0, [Math]::Min(100, [int]$Matches[1]))
    }
    if ($percent -ge 0) {
        Write-Progress -Id 137 -Activity 'Pawchive metadata runner' -Status $status -PercentComplete $percent
    } else {
        Write-Progress -Id 137 -Activity 'Pawchive metadata runner' -Status $status
    }

    $now = Get-Date
    $changedPhase = $title -ne $script:LastProgressTitle
    $logDue = ($now - $script:LastProgressLogAt).TotalSeconds -ge $ProgressLogIntervalSeconds
    if ($ForceLog -or -not $script:HandshakeEstablished -or $logDue) {
        if (-not $script:HandshakeEstablished) {
            Write-RunnerLog 'PMF userscript handshake established. Live progress is now available in this terminal.'
            $script:HandshakeEstablished = $true
        }
        Write-RunnerLog "Progress: $status"
        $script:LastProgressLogAt = $now
    } elseif ($changedPhase -and ($status -match 'complete|failed|stopped|Waiting|Planning')) {
        Write-RunnerLog "Progress: $status"
        $script:LastProgressLogAt = $now
    }
    $script:LastProgressTitle = $title
    return $true
}

function Wait-RunnerHandshake {
    param([Parameter(Mandatory)]$BrowserInfo, [int]$TimeoutSeconds = 45)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Update-RunnerProgress -BrowserInfo $BrowserInfo -ForceLog) { return $true }
        if (-not (Test-MaintenanceBrowserRunning -BrowserInfo $BrowserInfo)) { break }
        Start-Sleep -Seconds 1
    }
    Write-RunnerLog 'WARNING: The browser started, but Pawchive Media Filter did not publish a maintenance heartbeat within 45 seconds.'
    Write-RunnerLog 'Open the minimized maintenance window and confirm that Pawchive is logged in, Tampermonkey is enabled, and Pawchive Media Filter v0.13.9 or newer is installed in this exact profile.'
    return $false
}

function Start-MaintenanceBrowser {
    param([Parameter(Mandatory)]$BrowserInfo)

    $running = @(Get-Process -Name $BrowserInfo.Process -ErrorAction SilentlyContinue)
    $existingMaintenance = @(Get-MaintenanceProcesses -BrowserInfo $BrowserInfo)
    if ($running.Count -gt 0 -and $existingMaintenance.Count -eq 0 -and -not $AllowBrowserAlreadyRunning) {
        throw "$($BrowserInfo.Name) is already running. Close every $($BrowserInfo.Name) window and background process, then rerun this command. To deliberately open maintenance in the existing browser session, pass -AllowBrowserAlreadyRunning."
    }

    $url = "https://pawchive.pw/artists?pmf_maintenance=$Mode"
    $arguments = @(
        "--user-data-dir=$($BrowserInfo.Data)",
        "--profile-directory=$ProfileDirectory",
        "--app=$url",
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-session-crashed-bubble',
        '--disable-background-mode',
        '--start-minimized'
    )

    Write-RunnerLog "Launching $($BrowserInfo.Name) profile '$ProfileDirectory' in $Mode mode."
    $process = Start-Process -FilePath $BrowserInfo.Executable -ArgumentList $arguments -WindowStyle Minimized -PassThru
    $script:MaintenanceRootProcessId = [int]$process.Id
    $script:MaintenanceSessionStarted = $true

    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        Minimize-MaintenanceWindows -BrowserInfo $BrowserInfo
        if (Test-MaintenanceBrowserRunning -BrowserInfo $BrowserInfo) { break }
        if ($process.HasExited -and $attempt -gt 8) { break }
    }

    if (-not (Test-MaintenanceBrowserRunning -BrowserInfo $BrowserInfo)) {
        throw 'The maintenance browser process did not start. Check the log and confirm Tampermonkey is enabled in this browser profile.'
    }
}

Initialize-RunnerLog
$browserInfo = Resolve-Browser
$ProfileDirectory = Resolve-ProfileDirectory -BrowserInfo $browserInfo
Write-RunnerLog "Log file: $script:ResolvedLogPath"
Write-RunnerLog "Using $($browserInfo.Name): $($browserInfo.Executable)"
Write-RunnerLog "User data: $($browserInfo.Data); profile: $ProfileDirectory"
if (-not (Test-TampermonkeyInstalled -BrowserInfo $browserInfo -ResolvedProfile $ProfileDirectory)) {
    Write-RunnerLog 'WARNING: Tampermonkey was not detected in this profile. Install/enable Tampermonkey and Pawchive Media Filter in the selected profile before continuing.'
}
Write-RunnerLog 'This runner uses a real minimized browser engine because Tampermonkey storage and Pawchive IndexedDB are browser-profile data.'
Write-RunnerLog 'A Chrome, Edge, or Brave maintenance window opening briefly is expected; the runner minimizes it after launch.'

try {
    if (-not $NoKeepAwake) {
        [void][PmfRunnerNative]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED -bor $ES_AWAYMODE_REQUIRED)
        Write-RunnerLog 'Windows sleep prevention is active while the runner is running.'
    }

    Start-MaintenanceBrowser -BrowserInfo $browserInfo
    [void](Wait-RunnerHandshake -BrowserInfo $browserInfo)

    if ($Once) {
        Write-RunnerLog 'Once mode selected. The browser was launched; the PowerShell watchdog is exiting.'
        return
    }

    Write-RunnerLog 'Watchdog is active. Press Ctrl+C to stop the PowerShell runner.'
    $nextProcessCheck = (Get-Date).AddSeconds($RestartDelaySeconds)
    while ($true) {
        Start-Sleep -Seconds $StatusPollSeconds
        if (-not $NoKeepAwake) {
            [void][PmfRunnerNative]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED -bor $ES_AWAYMODE_REQUIRED)
        }
        [void](Update-RunnerProgress -BrowserInfo $browserInfo)
        if ((Get-Date) -lt $nextProcessCheck) { continue }
        $nextProcessCheck = (Get-Date).AddSeconds($RestartDelaySeconds)
        if (-not (Test-MaintenanceBrowserRunning -BrowserInfo $browserInfo)) {
            Write-Progress -Id 137 -Activity 'Pawchive metadata runner' -Completed
            $script:HandshakeEstablished = $false
            $script:LastProgressTitle = ''
            Write-RunnerLog 'Maintenance browser was no longer running; restarting it.'
            Start-MaintenanceBrowser -BrowserInfo $browserInfo
            [void](Wait-RunnerHandshake -BrowserInfo $browserInfo)
        } else {
            Minimize-MaintenanceWindows -BrowserInfo $browserInfo
        }
    }
}
finally {
    Write-Progress -Id 137 -Activity 'Pawchive metadata runner' -Completed
    if (-not $NoKeepAwake) {
        [void][PmfRunnerNative]::SetThreadExecutionState($ES_CONTINUOUS)
    }
    if ($CloseBrowserOnExit) {
        foreach ($item in @(Get-MaintenanceProcesses -BrowserInfo $browserInfo)) {
            Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    Write-RunnerLog 'Pawchive metadata runner stopped.'
}
