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

## 0.12.9

- Reduced Popular-page DOM scanning and replaced full post-status-store reads with key-scoped lookups for the selected Popular period.
- Stopped interrupted Popular jobs from silently resuming after navigation or reload, and capped Popular detail requests at two concurrent fetches to reduce background pressure on Pawchive.
- Moved Pawchive's native top result count and paginator below the PMF toolbar in Native mode while preserving their original positions for cleanup.
- Added incomplete-snapshot detection: periods such as 494 stored of 500 now show enabled **Retry scans**; only complete snapshots show disabled **Scanned**.
- Shortened the Local unscanned message to one sentence.
- Fixed Local Popular platform icons so Pixiv Fanbox and Patreon always use their matching Pawchive icon assets instead of cloning the first template card's service icon.
- Added focused v0.12.9 performance, incomplete-scan, placement, interrupted-job, and platform-icon regression coverage; 64 executable tests pass.

## 0.12.8

- Removed the PMF-owned Popular period/date card and Native mirrored paginator. Native mode now leaves Pawchive's original period selector, result count, and pagination as the only navigation controls.
- Preserved the selected Native/Local mode across Pawchive period-link navigation. Local mode retains only its own filtered-snapshot paginator.
- Added explicit Popular action states: stored or active Native periods show disabled **Scanned**; Local always shows **Update**, disabled before the first snapshot and while work is active.
- Unified Popular and creator-directory queue rendering through one shared Queue/Issues view, including the same overall progress, sections, progress rows, and action layout.
- Removed the redundant left-side Local post count, kept one stored total on the right, and left-aligned Local Popular card dates.
- Reduced Popular Scan/Update confirmations to the title, Period, and Posts values.
- Added focused v0.12.8 native-navigation, action-state, queue-reuse, confirmation, and card-alignment regression coverage; 63 executable tests pass.

## 0.12.7

- Fixed direct older Popular Day/Week/Month URLs disappearing when Pawchive retained its generic past-24-hours heading. Generic headings are no longer treated as contradictory date evidence, and a heading element is no longer mandatory for a stable mount.
- Detected Pawchive's unclassed `<menu>` pagination containers and hid the duplicate native page selector after PMF installs its mirrored paginator.
- Replaced the Popular inline queue/status fragment with the creator-catalogue-style expandable Queue/Issues panel, including overall progress and normal job actions. Accepted Scan, Resume, and Update operations open the queue automatically.
- Prevented queue counts, Local result counts, and Local storage summaries from overlapping by giving the Popular status row explicit grid columns.
- Rebuilt Local Popular card footers: removed the duplicated native favorite-count text, kept the date at bottom-left, moved the period rank/favorite metric above the footer, moved Patreon/Fanbox icons to the top-left overlay, and restored media plus Favorite/Like/Seen badges.
- Preserved the Popular scanner's known-no-missing observation contract for every scanned card.
- Added focused v0.12.7 dated-mount, paginator, queue, card, badge, and missing-attachment regression coverage; 62 executable tests pass.

## 0.12.6

- Aligned the Popular Posts toolbar with the shared `/artists` creator-directory toolbar width, control columns, typography, and button dimensions.
- Made the period panel content-sized and kept Previous / Next controls visible as disabled, muted, struck-through buttons when Pawchive has no destination.
- Fixed period navigation selecting the wrong Previous / Next URL by pairing navigation links with the active Day, Week, or Month row instead of allowing later rows to overwrite it.
- Switched PMF Popular period and paginator navigation to full-document navigation, retained the old UI until the replacement native DOM is stable, and rejected stale DOM whose heading/date does not match the requested route.
- Prevented the early-shell timeout from deleting a Popular UI while its matching route is still mounting.
- Added direct Scan / Resume / Update, Settings, and Local Filter button handlers. Local mode now permits the same primary action and no longer displays **Scan in Native**.
- Matched Popular status summaries to the creator directory: **Native Popular Posts · Pawchive controls** and **Local Popular Posts · N stored**.
- Added a Popular-safe settings preview path and focused v0.12.6 navigation/control regression coverage; 61 executable tests pass.

## 0.12.5

- Fixed the real-browser `/posts/popular` mount failure by removing Popular Posts from the creator-only compact-layout lifecycle. Popular pages do not have a creator `App.context`, so they now measure their own native grid and apply only the pure card-sizing calculations required by Local mode.
- Mounted the Popular root directly before Pawchive's native post grid, matching the stable grid-adjacent injection used by `/artists`, instead of anchoring it to native period-navigation markup that PMF later hides.
- Popular mounts still publish their AbortController for shared UI actions, while Popular cleanup now cancels only Popular-owned observers and never disconnects a newer creator-page layout observer.
- Native period-control hiding now refuses to hide any container that contains the PMF Popular root or another PMF-owned node.
- Added focused v0.12.5 regression coverage; 60 executable tests now pass.

## 0.12.3

- Fixed the current bare `/posts/popular` route by resolving **The Past 24 Hours** to the current UTC day and by deriving canonical dates from Pawchive's period links before falling back to today.
- Replaced Popular Posts' class-only card discovery with post-link-driven DOM detection, common-grid inference, broader content-root and paginator discovery, and generic native-card normalization so the controller can mount and scan Pawchive's live card markup even when `post-card` classes or `data-id` attributes are absent.
- Made fetched Popular period pages use the same generic post-link parser as the visible page, preventing scans from returning zero entries on the current markup.
- Fixed the PowerShell metadata runner under `Set-StrictMode` by always materializing maintenance-process results as an array before reading `.Count`, added Chromium’s start-minimized flag, and clarified that the maintenance window opening briefly is expected.
- Added focused v0.12.3 live-markup and runner regression coverage; 59 executable tests now pass.

## 0.12.2

- Fixed Popular Posts bootstrap on Pawchive layouts whose content uses a plain `<main>` element or post cards without `data-id` attributes; Native/Local UI detection now also recognizes generic `.post-card` elements that contain real `/post/` links.
- Increased the Popular DOM readiness window and improved its failure diagnostic so route retries do not silently look like an inactive userscript.
- Fixed the PowerShell runner startup crash by constructing the `0x80000000` execution-state flag as an unsigned value instead of converting a negative signed literal.
- Added Brave browser support, including automatic executable/profile discovery and the explicit `-Browser Brave` option.
- Added focused v0.12.2 bootstrap and runner regression coverage; 58 executable tests now pass.

## 0.12.1

- Repaired Popular Posts native ownership so PMF never hides an ancestor containing Pawchive's post grid; Native cards remain visible and only safe period controls/native paginators are replaced.
- Added an explicit startup mode, locked Native **All posts** / **Sort: Popular** styling, left-aligned queue state, **Scan / Resume / Update** action labels, and the standard First / Previous / pages / Next / Last Popular paginator.
- Rebuilt the custom Popular period header from Pawchive's real Previous / Day / Week / Month / Next URLs, including period links located beside the native paginator.
- Added abort-linked Popular mounts, stale-load guards after every asynchronous cache read, debounced native rebinding, and refresh revisions to prevent rapid page, Back/Forward, and period navigation from installing an obsolete grid or flashing duplicate PMF generations.
- Added a settings-schema-6 migration that appends `iframely.net` only to the untouched prior default known-host list while preserving genuinely customized host lists.
- Added `tools/Start-PawchiveMetadataRunner.ps1` and userscript `pmf_maintenance` commands. The runner launches the user's existing Chrome/Edge profile in a minimized app window, disables background throttling, keeps Windows awake, resumes/retries checkpoints, and periodically discovers newly added unknown metadata.
- Hardened Popular queue reorder persistence and queue removal pumping.
- Added focused v0.12.1 lifecycle/runner coverage; 57 executable tests now pass.

## 0.12.0

- Added a dedicated `/posts/popular` controller with polished **Native** and **Local** modes for dated Day, Week, and Month Popular Posts periods.
- Native mode preserves Pawchive period navigation and popularity order, mirrors native pagination, and queues resumable Scan / Update jobs without enabling local filters or alternate sorting.
- Popular scans store complete reusable post metadata plus period-specific rank and displayed favorite counts, mark observed posts as known-no-missing, reuse complete global posts, and keep each period in its own local snapshot.
- Local mode reuses the creator-page post filter, preset, status-filter, card, and paginator systems while keeping **Sort: Popular** locked to period favorite count and native rank.
- Added a durable multi-period Popular queue, per-period UI state, IndexedDB schema 6 stores, clear-current / clear-all controls, and `.pmfbackup` Merge / Replace portability for Popular periods and observations.
- Added `iframely.net` to the fresh default **Known media and download hosts** list.
- Added focused v0.12.0 Popular Posts regression coverage; 56 executable tests now pass.

## 0.11.6

- Removed both redundant Back controls from the Import backup view; the dialog now keeps only Cancel, Import backup, and the header close button.
- Added focused v0.11.6 import-dialog regression coverage; 55 executable tests now pass.

## 0.11.5

- Replaced whole-backup `JSON.stringify` with bounded JSON-Lines serialization so very large catalogues no longer fail export with `Invalid string length`.
- New exports download as `.pmfbackup` and are assembled from approximately 1 MiB Blob parts rather than one browser-sized string.
- Added incremental file-stream parsing for `.pmfbackup` imports while preserving compatibility with existing `.json` backups.
- Added focused v0.11.5 large-backup regression coverage; 54 executable tests now pass.

## 0.11.4

- Audited v0.11.3 backup/restore and changed IndexedDB export to one read-only transaction spanning every catalogue store, preventing scans or status writes from producing a cross-store half-snapshot.
- Added complete preflight validation for selected Catalogue, Settings, and Presets groups before any import write; malformed stores, missing keys, duplicate records, and duplicate preset IDs are rejected before Replace can clear data.
- Added automatic `pawchive.pw` ↔ `www.pawchive.pw` identity remapping during import so creator/post keys, statuses, UI state, Favorite snapshots, and Pawchive URLs remain visible on either supported hostname; pre-existing two-host duplicates are consolidated using the newer or more complete record.
- Made Replace clear every catalogue store even when restoring empty arrays, and completed memory-only fallback backup/restore for creator UI state and native-Favorite snapshot membership.
- Kept Favorite-sync auxiliary metadata consistent with the same IndexedDB snapshot and hardened imported post-preset normalization.
- Added focused v0.11.4 portability audit coverage; 53 executable tests now pass.

## 0.11.3

- Compacted Native directory pagination on phones to First, Previous, current page, Next, and Last so the creator list no longer gains an oversized multi-row page strip.
- Bounded mobile Bulk Scan, Update, and Resume previews inside a short scrolling region while keeping Cancel and Queue actions permanently reachable in the dialog footer.
- Moved **Reset all settings** out of the main modal footer and into **Data & performance → Backup and reset**.
- Added portable JSON Export / Import for the complete local IndexedDB catalogue, creator and post statuses, creator-directory snapshots, UI state, settings, saved filter state, post presets, and creator presets.
- Import supports file picking and drag-and-drop, selectable Catalogue / Settings / Presets groups, and Catalogue **Merge** or **Replace** conflict handling; active creator queues must finish or stop before importing.
- Confirmed settings and both preset systems continue using their stable persisted storage keys across userscript updates, with focused import/persistence regression coverage.
- Added focused v0.11.3 portability and mobile-correction coverage; 52 executable tests now pass.

## 0.11.2

- Added a dedicated responsive mobile layout for post and creator Settings: setting names stack above controls, toggle/chevron rows remain compact, textareas/selects use the available width, and labels no longer collapse into vertical letter columns.
- Converted Settings tabs into a horizontally scrollable, non-wrapping tab strip that keeps the active section centered, and switched modal sizing to dynamic viewport units with safe-area-aware padding and reachable mobile footers.
- Reflowed post Custom search rules and creator Advanced rules into mobile card layouts without horizontal dragging, while keeping fields, text, conditions, values, and remove actions usable on narrow screens.
- Repaired mobile toolbar geometry, including the Local catalogue Update split button, and made floating/anchored menus wider, viewport-clamped, internally scrollable, and able to open above low triggers.
- Added responsive queue, bulk-dialog, filter-popover, date/aggregate-editor, and maintenance-action layouts for phones and small tablets.
- Added focused v0.11.2 mobile responsive UI coverage; 51 executable tests now pass.

## 0.11.1

- Corrected saved Published date off-state and separated the Advanced-rules group switch from each rule row, so disabling a group no longer erases or silently re-enables its configuration.
- Corrected Advanced-rule **No match** semantics to count eligible posts that do not match the text expression, including mathematically safe partial lower-bound Amount checks.
- Corrected Custom-extension Amount evaluation and attachment/link Percentage denominators; creator summary schema 5 now records every real attachment plus scoped external links, including uncategorized attachments.
- Added local summary backfill for complete and partial Catalogues, stronger Local record signatures, and bounded fingerprint caches so newly hydrated Custom-extension and text-rule aggregates appear without network rescans or stale cached filtering.
- Hardened creator-filter popup lifecycle and geometry: same-trigger close removes the unused replacement node, narrow layouts keep the trigger width, near-bottom triggers may open upward, and unconfigured Date/Custom-extension checkboxes open their child editor instead of enabling an invalid filter.
- Repaired creator-preset validation and legacy corruption handling, preserved visible validation messages, and retained Default plus unique IDs/names without losing creator filter state.
- Corrected Advanced attachment sorting to use the specified Images-first default, preserve Amount/Percentage choices through Discard, and keep missing metrics unknown-last in either direction.
- Added focused v0.11.1 second-pass audit coverage; 50 executable tests now pass.

## 0.11.0

- Renamed the visible creator-directory mode to **Local catalogue** and aligned its search, status, count, and empty-state wording while preserving internal Catalogue identifiers and stored data.
- Replaced the legacy Local sort list with Popularity, Alphabetical, Catalogue post count, Post publish date, and an Advanced attachment amounts child dialog.
- Made the existing global Count method authoritative for creator media Amount and Percentage sorting/filtering, including attachment/link percentages against the complete counted attachment/link universe.
- Replaced the oversized Creator Filters modal with a compact anchored popover, independent Service filtering, All/Any group matching, Published date and media child dialogs, and safe partial-Catalogue handling.
- Added advanced creator text rules with IF/AND/OR, Match/No match, multi-field selection, Amount/Percentage conditions, expression previews, and lower-bound safety.
- Redesigned creator filter presets while preserving Custom extensions, advanced rules, service, date, All/Any, and partial-data settings through normalization and migration.
- Unified Local catalogue typography and selected-state styling, added the requested quick Hidden status color, and removed the duplicate native service dropdown arrow.
- Added focused v0.11.0 coverage; 49 executable tests now pass.

## 0.10.12

- Fixed the creator-page early-takeover regression that concealed native post geometry before the compact grid could measure it, which could leave a scanned creator with toolbar and paginators but no visible post cards.
- Early takeover now hides native pixels with `visibility` while preserving layout measurements until PMF rendering owns the page, and restores native content safely for unscanned creators or failed takeover.
- Added a defensive non-zero compact-layout fallback when Pawchive native card geometry is temporarily unavailable.
- Added focused v0.10.12 regression coverage; 47 executable tests now pass.

## 0.10.11

- Enforced a strict one-grid visibility contract between Native directory and Local catalogue, including an authoritative hidden override for the PMF grid.
- Added stable-parent native DOM observation and rebind logic so replaced Pawchive grids, search controls, and paginators do not leave stale references or duplicate card generations.
- Coordinated top and bottom Native paginator mirrors through one immediate pending state with duplicate-navigation protection and post-navigation reconciliation.
- Added responsive 2560×1440 Local catalogue width/card scaling while preserving the existing 1920×1080 layout.
- Added an early creator-page PMF restoration shell for known Catalogues to reduce the native-post-layout flash during retained navigation, with native restoration on failure.
- Added bounded bulk-preview overflow text, readable operation labels, and operation-specific First-N limits: Scan remains capped at 1000 while Update and Retry/Resume are not artificially capped.
- Added focused v0.10.11 regression coverage; 46 executable tests now pass.

## 0.10.10

- Unified external-link creator summaries and badges with the same scope and known-host rules used by post filtering and post badges.
- Added local stored-post reclassification fingerprints so detection-setting changes refresh existing Catalogue records without destructive rescans.
- Updated default known hosts and added focused English, Japanese, Simplified Chinese, and Traditional Chinese project-file keywords with schema-5 migration.
- Preserved Pawchive's current native sort direction when changing sort fields.
- Added synchronized bottom paginators and reliable Left/Right Arrow paging for creator directories and creator post results.
- Added a local missing-attachment inventory to Data & performance.
- Increased adaptive missing-metadata capacity to five structured workers and two HTML workers, with structured-capability bypass and existing scheduler/rate-limit protection.
- Merged creator API profile/artwork fields into directory snapshots used by bulk scanning.
- Made creator/all Catalogue clearing stop and await active writers, reset stale missing-metadata checkpoints, clear retained sessions, and refresh the mounted creator directory without exposing a creator-only action on `/artists`.
- Added v0.10.10 regression coverage; 45 executable tests now pass.

## 0.10.9

- Kept compatible creator attachment totals visible while aggregate-affecting settings trigger background summary recomputation.
- Added session-level suppression for broken creator avatar and banner URLs to prevent repeated 404 requests during Local rerenders.
- Bounded terminal metadata checkpoint history to 50 recent IDs while preserving a cumulative terminal count.
- Reconciled already-committed pending tasks into completion counters after interrupted checkpoint saves.
- Preserved explicit failure-limit pause messages through worker finalization.
- Added live-finding regression coverage for stale-summary rendering, artwork failures, bounded terminal history, and recovery accounting.

## 0.10.8

- Replaced whole-library missing-metadata planning with resumable IndexedDB cursor streaming in bounded 500-row chunks.
- Added schema-3 checkpoints that persist cursor position, the current bounded pending set, failures, counters, rates, and affected creators without storing every planned post ID.
- Changed All-scope confirmation to use one cheap stored-row upper-bound count and one streaming work pass instead of materializing the unknown-post plan twice.
- Added separate current and average rates, discovery-aware upper-bound ETA/remaining reporting, and failure circuit breakers.
- Batched affected creator summary patches into one Local cache invalidation and render.
- Released the shared maintenance slot when metadata or creator-repair setup fails.
- Removed the unused legacy creator-index implementation and integrated the Creator-card exclusion control directly into the authoritative child Settings UI.
- Added bounded-cursor, setup-failure, batch-render, and source-cleanup regression tests; 43 executable tests now pass.

## 0.10.7

- Retained Local catalogue records and view state across creator navigation, with immediate cached restoration and non-blocking background refresh.
- Cached filtered/sorted creator results so ordinary pagination only slices and renders the next 50 records through one `DocumentFragment`.
- Removed creator-profile repair from normal Local rendering and separated essential identity failures from optional enrichment gaps.
- Added durable creator-repair Stop, Resume, and Retry-failed behavior plus distinct avatar/banner profile parsing.
- Exposed the requested Count method and missing-attachment exclusion controls directly in both Settings contexts.
- Added scoped missing-attachment maintenance for Current creator, Current Local catalogue page, First N, and All, with warning/ETA for large runs.
- Added adaptive structured/detail concurrency, separately bounded HTML fallback, batched writes, creator-level recomputation, live rate/ETA, and durable retry semantics.
- Added runtime regression coverage for Local pagination caching, 20-cycle restoration, visible Settings, profile image separation, and failed-task retries.

## 0.10.6

- Wired the shared stable paginator directly into the Local Catalogue renderer.
- Corrected aggregate percentage denominators while preserving stored coverage counts.
- Replaced Queue wrappers, timed deletion interception, and v3/v4 rewriting with direct session-v4 persistence and migration.
- Made creator directory snapshots durable across enqueue, start, completion, failure, stop, restoration, and retry.
- Added weak creator-profile repair with bounded requests, cooldown, persistence, and incremental refresh.
- Added structured-first missing-attachment maintenance with persistent Stop/Resume checkpoints and progress in both Settings contexts.
- Removed shadow Settings, paginator, Queue, and bulk-dialog implementations and expanded runtime/source-quality regression coverage.
