# Pawchive.pw Media Filter

Tampermonkey userscript for scanning a Pawchive creator’s complete post catalogue, filtering the locally stored metadata, and showing attachment badges on creator and post cards.

Current version: **0.8.4**

## v0.8.4 native stylesheet and settings patch

v0.8.4 keeps post schema 2, IndexedDB version 4, and the stable `pmf-settings-v5` key. It adds guarded native-stylesheet health monitoring and one-shot recovery, document/head generation tracking, PMF-owned mutation filtering, stylesheet-aware BFCache/Turbo resume, and a bounded native-content fallback if mounting cannot complete.

When PMF debug logging is enabled, `globalThis.__PMF_DEBUG__.stylesheetHealth()` returns the current state, captured descriptor baseline, live snapshot, and deduplicated health history. If descriptor restoration cannot recover styling, a session-scoped normalized-URL guard permits one controlled hard reload and suppresses a reload loop.

Settings now use an explicit schema-2 migration. The former shared attachment badge size is migrated once into independent post-card and creator-card sizes, with a raw pre-migration backup. Select controls use a consistent arrow shell, main tabs have restrained titles, and badge/status/Seen appearance controls live in their related child pages.

Post-page Like/Unlike and Seen/Unsee actions continue to sit beside native Flag and Favorite. Their action spacing, line height, and separate icon width/height are measured from the native group; inner icons use optical scaling and receive at most one clamped vertical alignment correction.

Creator quick-filter icons and post-card status icons use separate, stable outer boxes. Active, inactive, and no-match states change color/fill/overlay only, so state changes do not resize either scope. The quick-filter row, `Showing …` summary, and paginator buttons use one equal vertical-gap variable.

## v0.8.3 corrective architecture

v0.8.3 keeps post schema 2 and IndexedDB version 4. It adds a one-time card-scale migration, one compact-layout authority, persistent post-status coordination, a five-creator LRU session cache, coalesced navigation reconciliation, soft BFCache/Turbo reuse, direct-sibling post actions, and a reusable draft-based Settings UI.

Scanned creators always use the compact Catalogue grid; unscanned creators retain Pawchive's native grid. Filter, preset, search, sort, page/anchor, layout, and scroll state are persisted automatically.

## Installation

1. Install Tampermonkey.
2. Create a userscript.
3. Copy the contents of `pawchive-pw-media-filter.user.js`.
4. Save it and open a Pawchive creator page, post page, or `/artists`.

The script runs only on `pawchive.pw` and `www.pawchive.pw`. Catalogue scans store metadata, not media files.

## Catalogue-only scanning

Version 0.8.4 retains the Catalogue-only model introduced in v0.7.1. There are no page-range, Fast/Verify, Rescan, scan-cache, display-mode, or remember controls. The main creator-page action always uses the complete Catalogue pipeline:

| Catalogue state | Button | Action |
|---|---|---|
| None | Scan | Scan every creator-list page immediately |
| Initial scan active | Stop scan | Stop safely after committed work |
| Partial | Resume scan | Request missing or failed pages |
| Resume active | Stop scan | Stop safely |
| Complete | Update | Check newest pages for new posts |
| Updating | Stop update | Stop the update safely |

The main Scan button has no confirmation. Update also starts directly. Stopped scans preserve committed pages and posts.

Optional post-detail retries are separate from coverage. **Retry incomplete** requests only records with explicit evidence that useful optional metadata may still be available.

## Filtering and sorting

The toolbar order is:

1. Media filter
2. Sort
3. Scan / Resume scan / Update
4. Settings

Before a Catalogue exists, Pawchive’s native page and search remain usable. Once Catalogue records exist, the existing Pawchive search field filters local Catalogue posts.

The custom Sort menu supports:

- **Publish date ▼** — newest to oldest
- **Publish date ▲** — oldest to newest
- **Post title ▼** — A to Z, case-insensitive and numeric-aware
- **Post title ▲** — Z to A

Choosing a different sort mode selects its default direction. Choosing the active mode again toggles its direction. Sort state is stored per creator, resets the filtered page to 1, and is not part of presets.

Unknown publication dates remain after valid dates in both date directions. Equal values use stable timestamp, numeric post-ID, and original-index fallbacks.

## Like, Seen, and native Favorite status

Post pages add **Like** and **Seen** beside Pawchive’s native Favorite action. They use outlined heart/eye icons when off and filled icons when on. Like and Seen are manual local state: opening a post does not mark it Seen, and neither value is sent to Pawchive.

Favorite is tri-state: known favorited, known not favorited, or unknown. Newer direct post-page evidence can override an older complete snapshot; a newer complete host snapshot can override older direct evidence. Partial crawls add positive evidence only and never turn missing posts into “not favorited.”

Settings > Data & performance provides **Synchronize native favorites now** with progress and Stop. There is no startup synchronization. When enabled, successful Scan, Resume, and Update operations request a freshness-checked sync through the existing scheduler and whole-operation concurrency budget.

Creator pages provide:

- centered Favorite, Like, and Seen three-state quick-filter buttons above the result count;
- heart, eye, and star status badges on matching post cards;
- global status-filter state separate from creator state and presets.

Each quick filter cycles Off → Match → No match → Off. Unknown Favorite records match neither active Favorite mode. Like and Seen default to false when no local record exists.

Status changes are distributed by one persistent coordinator to the current post and every retained creator session. Existing Catalogue records do not need to be rebuilt or reread after Back.

## Display and attachment badges

The Catalogue grid supports:

- Post thumbnail size: Big, Medium, Small
- Post thumbnail aspect ratio: 16:9, 4:3, 1:1 (original)
- Post attachment badge size: Small, Medium, Big
- Creator attachment badge size: Small, Medium, Big
- Post status badge size: Small, Medium, Big

The v0.8.3 sizes are derived from the exact v0.8.2 Small result: new Big = legacy Small / 1.25, Medium = Big / 1.5, and Small = Big / 2. A one-time `pmf-card-scale-v083-migrated` marker maps existing size choices to new Big; later choices persist normally.

Settings tabs are General, Default detection, Scanning, and Data & performance. Badge details and Seen dim strength use child views. Settings edits share one draft: Save writes once; Cancel, Close, Escape, and outside click restore the opening preview.
- Optional seen-card dimming, default off, with Low/Medium/High strength

Card size and aspect ratio are one fixed-height layout calculation. Big, Medium, and Small choose the row height; the aspect ratio changes the entire card width, not only the image crop. Container width determines the column count. Filtered page capacity is the largest complete-row page size at or below 50 posts, so the paginator does not intentionally render a short row before the last page. A resize preserves the first retained post and recalculates its page.

Post and creator attachment badge sizes are independent. Small exactly preserves the v0.6.0 dimensions. Medium and Big increase badge height, minimum width, icons, fonts, padding, and spacing; post sizing owns footer reservation, while creator sizing owns creator-card text reservation.

Badge size changes preview immediately in Settings. Cancel restores the prior size; Save persists it; Reset returns to Small. Creator-card reserved width is measured from the rendered badge rail and recalculated after changes and resize.

The attachment parent setting is **Show attachment badges on post cards**.

## Creator-card actions

Right-click a creator card, or use the Context Menu key / Shift+F10, to run its current action.

- Initial and resumed scans follow the global **Confirm initial and resumed scans from creator cards** preference.
- Update always starts immediately.
- Stop may show a short confirmation.

Creator identities use `Creator name (Platform)`, for example `Nagoonimation (Patreon)`. Service badges, favorite counts, and trailing creator IDs are excluded from dialog titles and progress labels.

## Navigation and pagination

The lifecycle uses a generation and abort controller for every route mount. Stale asynchronous mounts cannot complete over a newer Back/Forward navigation. A creator native-page identity includes creator, `o=` offset, and native query.

On BFCache `pageshow`, PMF first keeps a healthy existing PMF/native DOM alive and resumes suspended work instead of forcing teardown. If health checks fail, it restores native visibility, removes stale owned roots, and remounts against the current route. Candidate native grids must have a stable card signature before binding. Compact rendering verifies that the direct card count equals the current result slice and falls back to generated cards once if cloning fails.

The filtered paginator uses a stable sliding window: five numbered buttons on desktop and three in a narrow container. Page 1 and the last page are not permanently pinned, no ellipses are rendered, and First/Previous/Next/Last stay present but disabled at boundaries. Every button exposes a live `data-pmf-page-action`; Previous and Next do not retain stale numeric destinations.

Creator and post routes both participate in the lifecycle. A clicked compact card stores its post as the retained page anchor. Back, Forward, refresh, BFCache restoration, later filtered pages, ratio/size changes, and responsive column changes restore the page containing that anchor.

## Storage compatibility

Version 0.8.2 keeps:

- `pmf-settings-v5`
- the existing preset key and schema
- normalized post schema 2
- IndexedDB database `pawchive-media-filter`, upgraded in place to version 4
- complete and partial Catalogue progress
- page manifests and end evidence
- creator-card summaries
- optional retry state and update timestamps
- filters, presets, card scale, aspect ratio, crop settings, and per-creator UI state

Database version 4 preserves `postStatuses` and adds `favoriteSnapshotEntries` plus `favoriteSyncMeta`. Complete Favorite snapshots activate atomically. Catalogue deletion does not clear status records or Favorite snapshots.

A one-time transaction-safe migration, marked by `pmf-catalogue-only-migration-v1`, preserves every Catalogue-owned record, normalizes it to Catalogue-only ownership, removes legacy scan-only records and metadata, and strips obsolete scan fields from UI state. It does not require complete Catalogues to be rescanned.

Settings can explicitly clear this creator’s full catalogue scan or all full catalogue scans. Presets and global settings are preserved.

## Queue, concurrency, and request pacing

Version 0.8.2 preserves the shared FIFO Catalogue queue for creator-page actions, `/artists` card actions, optional metadata retries, and the Favorite-sync maintenance slot. Pending jobs are unlimited, but each creator can have only one queued or active operation. Queued cards show live positions; invoking a queued card removes only that item. Stopping one active creator does not affect other work.

Settings > Full catalogue scan > Queue provides **Concurrent scans and updates**. **1 - Recommended** is the default; **2** permits two creators to run together. Increasing the value pumps the next FIFO job immediately. Decreasing it lets existing jobs finish and starts no replacement until the active count is below the new limit. Optional detail-request concurrency remains separate.

Queued actions are derived again from current IndexedDB metadata when their slot opens. All creator-list and post-detail attempts share a request-start scheduler with at least 250 ms between starts. Any HTTP 429 `Retry-After` response extends a shared cooldown for every worker.

## Creator-card badge layout repair

Enabled badge types are grouped dynamically in canonical order, at most two per vertical column. Logical column 0 is the rightmost column. Badges equalize width only within their own column; adjacent columns remain independent. PMF measures the connected full rail and reserves that width plus a 12 px safety gap after rendering, resize, badge-size or category changes, grid replacement, backfill, and job completion.

PMF-owned rails, columns, badges, and job labels are excluded from native mutation refreshes. Refresh revisions discard stale async reads. Settings load once before route mounting, and badge display changes rerender the currently loaded cards without invalidating summaries or rereading IndexedDB.

## Verification

Run:

```powershell
node --check .\pawchive-pw-media-filter.user.js
Get-ChildItem .\tests\*.cjs |
  Where-Object Name -ne 'test-helper.cjs' |
  Sort-Object Name |
  ForEach-Object { node $_.FullName; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
```

See [TESTING.md](TESTING.md) for the required live Tampermonkey matrix. Node and static tests do not prove browser history behavior, native navigation, IndexedDB upgrades in a real profile, or visual geometry.
