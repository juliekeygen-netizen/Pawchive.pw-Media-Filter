# Pawchive.pw Media Filter

## v0.13.4 All Scans Popular mode

- Added a third **All Scans** mode beside Native and Local on Popular Posts pages.
- Choose Day, Week, or Month to combine every saved snapshot of that period type into one local result set; dated Previous/Next links are hidden while this mode is active.
- The same post is shown once. Its highest observed displayed favorite count is retained across all matching snapshots, with the newest observation used as the tie-breaker.
- Aggregate results keep the existing Local filters, status controls, card layout, and top/bottom pagination.
- All Scans is view-only: scanning and updating still happen from the dated Native or Local period views.

## v0.13.3 Popular progress and canonical periods

- Coalesced route-change and mutation bursts so rapid Back/Forward navigation cannot create duplicate mount storms.
- Added bounded retry backoff and stale-route guards for creator and Popular page DOM replacement.
- Preserved and resumed Popular queue state across bfcache pagehide/pageshow restoration.
- Restored native grids and paginator controls left hidden by interrupted or superseded userscript instances.
- Added focused lifecycle audit coverage and synthetic Chromium navigation stress tests.

## v0.12.9 Popular performance, incomplete-scan retry, and platform fixes

- Reduced Popular-page DOM work by narrowing post-link and count discovery and by loading only the status records used by the current Popular snapshot. Interrupted Popular scans are no longer silently resumed after navigation or reload.
- Capped Popular post-detail work at two concurrent requests to reduce background pressure on Pawchive while browsing. Host-side Cloudflare 502 responses can still occur, but PMF no longer restarts interrupted work automatically.
- Pawchive's native top result count and paginator are moved beneath the PMF toolbar in Native mode and restored to their original DOM positions when PMF unmounts.
