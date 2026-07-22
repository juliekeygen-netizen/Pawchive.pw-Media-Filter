# Changelog

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
