# Changelog

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
