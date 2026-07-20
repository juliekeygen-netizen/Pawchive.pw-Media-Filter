# Changelog

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
