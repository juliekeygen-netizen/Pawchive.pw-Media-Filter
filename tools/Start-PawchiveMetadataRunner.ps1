[CmdletBinding()]
param(
    [ValidateSet('Auto', 'Chrome', 'Edge', 'Brave')]
    [string]$Browser = 'Auto',

    [ValidateSet('watch-missing', 'resume-missing', 'retry-missing', 'start-missing')]
    [string]$Mode = 'watch-missing',

    [string]$ProfileDirectory = 'Default',
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

    return (Get-MaintenanceProcesses -BrowserInfo $BrowserInfo).Count -gt 0
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
    if ($running.Count -gt 0 -and -not $AllowBrowserAlreadyRunning -and -not $script:MaintenanceSessionStarted) {
        throw "$($BrowserInfo.Name) is already running. Close it first so this runner can safely use the same profile and Pawchive IndexedDB. Alternatively pass -AllowBrowserAlreadyRunning, but the maintenance page will then belong to your normal browser session."
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
        '--disable-background-mode'
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
Write-RunnerLog "Using $($browserInfo.Name): $($browserInfo.Executable)"
Write-RunnerLog "User data: $($browserInfo.Data); profile: $ProfileDirectory"
Write-RunnerLog 'This runner uses a real minimized browser engine because Tampermonkey storage and Pawchive IndexedDB are browser-profile data.'

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
