# Pawchive.pw Media Filter

## Installation

[Install the Pawchive.pw Media Filter userscript](https://raw.githubusercontent.com/juliekeygen-netizen/Pawchive.pw-Media-Filter/master/pawchive-pw-media-filter.user.js)

Open the link with Tampermonkey installed to install or update the script.

## v0.13.6 Creator catalogue filters and settings polish

- Centered the All Scans Day/Week/Month selector with equal-width period columns.
- Removed the redundant Local creator-count text, restored service-specific Patreon/Fanbox card backdrops, and right-aligned the Local sort-direction indicator.
- Made Custom extensions and Advanced rules toggle only from their checkbox rows while their chevrons exclusively open the editors; empty custom-extension lists can now be saved.
- Simplified Seen/Hide quick filters to Off and No match, fixed Between-rule field geometry, and standardized creator preset menus to Rename, Duplicate, and Delete.
- Reorganized catalogue repair, retry, native-favorite synchronization, and destructive actions into a categorized maintenance workspace.
- Renamed Scanning to Scanning & detection, moved creator Count method and missing-attachment exclusion there, and removed creator-card scan confirmations.
- Audited export/import coverage for Popular snapshots, aggregate state, statuses, and both post and creator presets.

## v0.13.5 Popular period controls, custom dates, sorting, and card reliability

- Replaced the fragile All Scans reuse of Pawchive period links with a PMF-owned Day/Week/Month selector, so dated Previous/Next links stay hidden and the active aggregate period always updates correctly.
- Right-click Day, Week, or Month to open a native date picker and jump directly to a custom dated period; period links show a small “Right click for custom date” tooltip.
- Kept native Previous/Next period links permanently in Pawchive’s reddish link color instead of allowing stale white active/focus styling.
- Enabled Popular, Publish date, and Post title sorting in Local and All Scans; selecting the active option reverses its direction.
- Hardened reconstructed Popular thumbnails by removing stale cloned picture sources and eagerly loading the stored thumbnail URL.
- Hidden the erroneous registered-users-only notice on Popular pages when the logged-in navigation is present.

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