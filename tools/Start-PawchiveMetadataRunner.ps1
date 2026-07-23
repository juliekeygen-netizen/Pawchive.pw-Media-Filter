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

function Write-RunnerLog {
    param([Parameter(Mandatory)][string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    try { Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 } catch { }
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

$browserInfo = Resolve-Browser
$ProfileDirectory = Resolve-ProfileDirectory -BrowserInfo $browserInfo
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

    if ($Once) {
        Write-RunnerLog 'Once mode selected. The browser was launched; the PowerShell watchdog is exiting.'
        return
    }

    Write-RunnerLog 'Watchdog is active. Press Ctrl+C to stop the PowerShell runner.'
    while ($true) {
        Start-Sleep -Seconds $RestartDelaySeconds
        if (-not $NoKeepAwake) {
            [void][PmfRunnerNative]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED -bor $ES_AWAYMODE_REQUIRED)
        }
        if (-not (Test-MaintenanceBrowserRunning -BrowserInfo $browserInfo)) {
            Write-RunnerLog 'Maintenance browser was no longer running; restarting it.'
            Start-MaintenanceBrowser -BrowserInfo $browserInfo
        } else {
            Minimize-MaintenanceWindows -BrowserInfo $browserInfo
        }
    }
}
finally {
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
