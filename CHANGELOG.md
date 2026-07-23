# Changelog

## 0.13.8

- Kept Popular scans and arbitrarily many queued period jobs alive across Day/Week/Month navigation, Turbo replacement, reload recovery, and BFCache pause/resume.
- Persisted queue descriptors and the queue panel open state outside the currently mounted Popular page.
- Portaled nested maintenance scope dialogs through the global overlay host with deterministic stack z-order.
- Added `watch-all` and creator-profile repair modes to the PowerShell runner, plus last-used profile discovery, profile validation, and Tampermonkey diagnostics.

## 0.13.7

- Restored creator-card backdrop behavior and limited Fanbox neutral styling to the service badge.
- Corrected Date published interaction, empty/open-ended saving, creator-filter ordering, and post-filter wording.
- Added mobile layout hardening for current creator, Popular, queue, filter, dialog, and paginator interfaces.

## 0.13.6

- Centered the All Scans period selector with three equal Day/Week/Month columns.
- Removed the duplicate Local creator count, added gray Pixiv Fanbox versus red Patreon catalogue-card treatments, and aligned Local sort arrows to the right.
- Corrected Custom extensions and Advanced rules row/chevron behavior, allowed empty extension lists, removed per-rule Enabled controls, and repaired Between-rule sizing.
- Reduced Seen/Hide status filters to Off and No match across creator search, creator pages, and Popular Posts.
- Unified creator preset action menus around Rename, Duplicate, and Delete with a wider anchored menu.
- Consolidated maintenance and native-favorite operations into a categorized maintenance dialog and moved creator detection settings into Scanning & detection.
- Disabled obsolete creator-card scan confirmations and verified Popular/preset backup and restore coverage.
- Added focused v0.13.6 regression coverage; all 71 executable tests pass.

## 0.13.5

- Added a PMF-owned Day/Week/Month selector for All Scans, eliminating stale native link highlights and intermittent Previous/Next visibility.
- Added right-click custom-date navigation for Day, Week, and Month with the browser’s native date picker.
- Normalized native Previous/Next period-link color across visited, hover, focus, and active states.
- Enabled Popular, Publish date, and Post title sorting in Local and All Scans, including repeat-selection direction reversal and persisted sort state.
- Removed stale cloned `picture source` data from reconstructed post cards and eagerly bound stored thumbnail URLs to prevent black Local/All Scans cards.
- Suppressed the erroneous registered-users-only notice when Pawchive’s logged-in navigation is present.
- Added focused regression coverage; all 70 executable tests pass.

## 0.13.4

- Added an **All Scans** Popular mode beside Native and Local.
- All Scans groups every saved Popular snapshot by Day, Week, or Month, hides dated Previous/Next navigation, and turns the remaining Day/Week/Month links into local aggregate selectors.
- Deduplicated posts across snapshots by post key. When a post was observed more than once in the selected period type, the entry with the highest displayed favorite count is retained; ties use the newest observation.
- Rebuilt aggregate ranks after deduplication, retained Local filtering/status controls and pagination, and refreshed the aggregate automatically when a matching Popular scan completes.
- Added one-transaction multi-period entry loading plus regression coverage for aggregation, period switching, native-control restoration, and favorite-count selection. All 69 executable tests pass.

## 0.13.3

- Canonicalized the bare `/posts/popular` route to the dated current Day URL with `location.replace`, preventing the legacy rolling 24-hour view from becoming a separate local period or Back-button loop.
- Made Popular overall queue progress track live post-level work inside the active period instead of remaining at 0% until the whole period finished; the toolbar and active row now use the same progress calculation.
- Centered the shared Clear completed action in creator and Popular queue panels.
- Coalesced high-frequency Popular progress renders and session work, especially while the tab is hidden, reducing DOM churn without slowing the underlying scan.
- Confirmed and regression-tested incremental Popular Update behavior: every native list page is refreshed to reconcile membership/rank/favorite counts, while complete stored post-detail metadata is reused and only new/incomplete posts request detail data.

## 0.13.2

- Added immediate History API route signals so `pushState` and `replaceState` navigation no longer waits for URL polling.
- Coalesced same-turn route signals to prevent redundant mount/abort churn during rapid Back/Forward and repeated navigation.
- Hardened mount completion so an aborted or stale route cannot be recorded as successfully mounted.
- BFCache and Turbo snapshots now abort in-flight mounts and pause active Popular scans; scans return as interrupted/retryable instead of continuing in the background.
- Added navigation lifecycle stress regression coverage; 67 executable tests pass.

## 0.13.1

- Fixed Native Popular pagination discovery so normal page links without `data-value` attributes are included; pages 1–10 now render instead of only Previous and the current page.
- Native Popular pagination now shows Previous, pages 1–10, and Next without First/Last controls.
- Normalized paginator navigation glyphs and sizing across Popular and creator-directory Native/Local pagination.
- Added v0.13.1 paginator extraction, layout, and symbol regression coverage; 66 executable tests pass.

## 0.13.0

- Replaced the visible Native Popular paginator and result-count nodes with PMF mirrors at the top and bottom of the post grid.
- Both Native mirrors reuse Pawchive's real hidden pagination actions, show the same PMF `Showing start–end of total` summary, and preserve the selected Popular route/page.
- Original Pawchive paginator/count nodes are hidden in both Native and Local modes while mounted, preventing duplicate selectors and duplicate result counters.
- Added focused mirrored-paginator coverage; 66 executable tests pass.
