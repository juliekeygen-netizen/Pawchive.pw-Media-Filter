# Pawchive metadata runner

`Start-PawchiveMetadataRunner.ps1` keeps missing-attachment metadata and creator-profile repair running in a dedicated minimized Chrome, Edge, or Brave app window.

A completely browser-free runner cannot safely operate on the existing catalogue because the catalogue is stored in Pawchive's browser-origin IndexedDB and the maintenance checkpoint is stored by Tampermonkey. This tool launches the browser engine itself, but your normal browser window does not need to remain open.

## Requirements

- Windows 10 or 11
- Chrome, Microsoft Edge, or Brave
- Tampermonkey and Pawchive Media Filter installed in the selected browser profile
- The same browser profile that contains your existing Pawchive local catalogue

Close that browser completely before starting the runner. Chromium browsers lock a profile while it is in use. The runner must open a real maintenance window to access Tampermonkey and Pawchive IndexedDB; that window is expected and is minimized automatically after launch.

## Start the continuous runner

From PowerShell in the repository folder:

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\Start-PawchiveMetadataRunner.ps1"
```

The default mode is `watch-all`. It:

1. starts or resumes the all-unknown missing-attachment pass;
2. retries missing-attachment failures when appropriate;
3. runs or resumes creator-profile metadata repair after missing-attachment work is idle;
4. checks the active checkpoint every 20 seconds;
5. after a completed pass, inventories the catalogue at most once every five minutes and starts another pass if new unknown posts appeared;
6. restarts the minimized maintenance browser after a full browser exit;
7. keeps Windows awake while the runner is active.

Press `Ctrl+C` in PowerShell to stop the watchdog.

## Browser and profile examples

Use Brave and automatically select Chromium's last-used profile:

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\Start-PawchiveMetadataRunner.ps1" -Browser Brave
```

Specify a profile explicitly only when needed:

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\Start-PawchiveMetadataRunner.ps1" -Browser Brave -ProfileDirectory "Profile 1"
```

Use Edge:

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\Start-PawchiveMetadataRunner.ps1" -Browser Edge
```

Use Chrome profile `Profile 1`:

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\Start-PawchiveMetadataRunner.ps1" -Browser Chrome -ProfileDirectory "Profile 1"
```

Use a custom browser user-data folder:

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\Start-PawchiveMetadataRunner.ps1" -UserDataDirectory "C:\Users\Julie\AppData\Local\Google\Chrome\User Data" -ProfileDirectory "Default"
```

## Other modes

```powershell
# Resume the saved checkpoint once.
.\tools\Start-PawchiveMetadataRunner.ps1 -Mode resume-missing -Once

# Retry only saved retryable failures once.
.\tools\Start-PawchiveMetadataRunner.ps1 -Mode retry-missing -Once

# Start a new all-unknown pass once.
.\tools\Start-PawchiveMetadataRunner.ps1 -Mode start-missing -Once

# Continuously repair creator profile metadata.
.\tools\Start-PawchiveMetadataRunner.ps1 -Mode watch-profiles

# Start creator-profile repair once.
.\tools\Start-PawchiveMetadataRunner.ps1 -Mode start-profiles -Once

# Watch both maintenance systems (the default).
.\tools\Start-PawchiveMetadataRunner.ps1 -Mode watch-all
```

The corresponding maintenance URLs are:

- `?pmf_maintenance=watch-all`
- `?pmf_maintenance=watch-missing`
- `?pmf_maintenance=resume-missing`
- `?pmf_maintenance=retry-missing`
- `?pmf_maintenance=start-missing`
- `?pmf_maintenance=watch-profiles`
- `?pmf_maintenance=resume-profiles`
- `?pmf_maintenance=retry-profiles`
- `?pmf_maintenance=start-profiles`

## Notes

- Do not use a separate empty browser profile unless you intentionally want a separate empty Pawchive catalogue.
- `-AllowBrowserAlreadyRunning` is available, but then the maintenance page joins the existing browser session and may stop when that browser closes.
- Chromium background timer throttling, native-window occlusion throttling, renderer backgrounding, and background mode are disabled for the maintenance app.
- The runner writes `tools\PawchiveMetadataRunner.log`.
- Use `-NoKeepAwake` to allow Windows to sleep.
- Use `-CloseBrowserOnExit` to close the maintenance app process when the PowerShell runner exits.

The runner now validates the selected profile folder, auto-detects Chromium's `profile.last_used` value when `-ProfileDirectory` is omitted, and logs a warning when Tampermonkey cannot be found in that profile.
