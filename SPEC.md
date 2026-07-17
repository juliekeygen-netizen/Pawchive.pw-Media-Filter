# Pawchive.pw Media Filter v0.8.4 specification

## Scope

The project is one Tampermonkey userscript, `pawchive-pw-media-filter.user.js`. It augments Pawchive creator pages, post pages, and `/artists`. It stores normalized post metadata and user-controlled status locally and never downloads media files.

## Persistent identifiers

- Userscript and `Config.version`: `0.8.4`
- Settings: `pmf-settings-v5`
- Presets: existing key, schema 1
- Post schema: 2
- IndexedDB: `pawchive-media-filter`, version 4
- Post-status store: `postStatuses`, keyed by domain/service/creator/post with a `creatorKey` index
- Native Favorites sync state: `pmf-favorite-sync-v1`
- Global quick-status filters: `pmf-post-status-filters-v1`
- Favorite snapshots: `favoriteSnapshotEntries` and `favoriteSyncMeta`
- Catalogue-only migration marker: `pmf-catalogue-only-migration-v1`
- Card-scale migration marker: `pmf-card-scale-v083-migrated`

## v0.8.4 ownership contracts

- `NativeStylesheetHealth` captures native link descriptors only after a structurally healthy page has stylesheet links. Later confirmed loss gates mounts, restores native visibility, attempts descriptor-based link recreation once, and permits at most one guarded hard reload per normalized URL in the recovery window.
- `PmfDomMutationGuard` and `isPmfOwnedNode` are the shared PMF DOM ownership boundary. PMF children inserted under native parents do not trigger route reconciliation.

- `CompactLayoutEngine` is the single entry point for native measurement, selected size and ratio, card width/height, column count, full-row page size, preview/restore, resize, verification, and cleanup. The older scale/ratio objects are compatibility facades.
- `PostStatusStateCoordinator` owns the one persistent `PostStatusEvents` subscription. Route-page controllers do not subscribe.
- `CreatorSessionCache` retains up to five DOM-free creator sessions and evicts the least-recent inactive entry. A session owns Catalogue/status maps, filter/search/sort/preset state, anchor/page/layout/render state, scroll, revisions, and dirty status keys.
- `Lifecycle` coalesces signals around desired, mounting, and mounted page keys. A request for the same mounting key reuses its promise. At most one bounded fallback health check is queued.
- BFCache and Turbo snapshots suspend observers/work and retain healthy UI. Persistent coordinators stop only during final shutdown.
- Like and Seen are direct siblings of native Favorite when the native group is safe. Their font, line height, icon box, and spacing are measured from native actions.
- Settings is built from reusable row/toggle/select/action/section/child constructors and one draft. Its tabs are General, Default detection, Scanning, and Data & performance.

`globalThis.__PMF_DEBUG__.stylesheetHealth()` exposes the current state, descriptor baseline, live snapshot, and bounded deduplicated history. The stylesheet subsystem records document/head generations and validates persisted BFCache pages before controller health can authorize reuse.

All Settings selects are rendered through `.pmf-select-shell` with one non-interactive right-side arrow. Size and strength controls live on their corresponding child pages. Paginator vertical rhythm is owned by `--pmf-status-summary-gap`.

Quick-filter and post-card status icons have independent stable outer boxes. Active/no-match changes do not alter geometry. Post-page actions use a sanitized clone of the native Favorite element as the visual-template source, copy only safe visual classes, measure native icon width and height separately, and apply one clamped whole-action Y correction on the next animation frame.

## Compact geometry

`legacySmall = max(110, round(nativeHeight × 1.26))`. New heights are `round(legacySmall / 1.25)`, `round(newBig / 1.5)`, and `round(newBig / 2)` for Big, Medium, and Small. Ratio changes width only: 16:9, 4:3, or 1:1. Page capacity is the largest complete-row multiple not exceeding 50.

## Catalogue model

The active application has one Catalogue model. `CatalogueModel.empty()` contains `catalogue.status = "none"`. Active behavior does not switch between scan and catalogue storage modes.

Valid Catalogue statuses are:

- `none`
- `building`
- `partial`
- `complete`
- `updating`

The main action is derived from status and coverage:

- none → Scan
- building/resuming → Stop scan
- partial → Resume scan
- complete → Update
- updating → Stop update

Scan begins immediately and requests all missing creator-list pages. Resume preserves and skips committed page manifests. Update begins at offset 0, adds unseen IDs, continues while pages contain unseen IDs, preserves known records and coverage, recomputes the creator summary, and records `lastUpdateCheckAt`.

## Legacy migration

`Cache.migrateCatalogueOnly()` runs once before creator or artist data is used.

In a single IndexedDB read/write transaction it:

1. Reads posts, creator metadata, and UI states.
2. Preserves records with `cacheSources.catalogue === true`.
3. Deletes records with scan ownership but no Catalogue ownership.
4. Preserves legacy unowned records when their creator metadata proves a Catalogue exists.
5. Normalizes kept posts to `{scan:false, catalogue:true}`.
6. Normalizes Catalogue metadata without clearing page coverage, completion, summaries, retry state, build/update timestamps, or endpoint information.
7. Removes old scan-only creator metadata.
8. Removes obsolete scan fields from creator UI state and normalizes new sort fields.
9. Writes the GM migration marker only after transaction completion.

The operation is idempotent. It does not bump the database or post schema.

Explicit deletion APIs are `Cache.clearCreatorCatalogue(creatorKey)` and `Cache.clearAllCatalogues()`.

## Optional metadata

Creator-list records remain authoritative for Catalogue coverage. Missing optional fields alone do not make a record retryable.

`MetadataDetailPool.fetch()` owns bounded individual-detail concurrency and cancellation. `OperationIssues` owns displayable current-operation errors. Retry incomplete is a `metadata-retry` queue job, so it consumes one whole-job slot and cannot overlap another operation for the same creator.

## Sorting

`PostSorter.sort(posts, {mode, direction})` returns a new array.

Accepted values:

- mode: `published`, `title`
- direction: `default`, `reverse`

Invalid state normalizes to `published/default`.

Semantics:

- published/default: newest first
- published/reverse: oldest first
- title/default: A to Z
- title/reverse: Z to A

Title comparison is locale-aware, case-insensitive, and numeric-aware. Unknown publication dates remain last in both directions. Stable fallbacks use publication timestamp, numeric-aware ID, then original index.

The custom toolbar button uses `aria-haspopup="menu"`, reports its expanded state, contains a left-aligned label and far-right direction arrow, and exposes radio-style menu items. Re-selecting the active mode toggles direction. A changed mode resets to default direction. Every selection resets the filtered page to 1 and persists per creator. Presets do not contain sort state.

## Badge sizing

`postAttachmentBadgeSize` and `creatorAttachmentBadgeSize` are independent, default to `small`, and accept `small`, `medium`, or `big`. `postStatusBadgeSize` also defaults to `small`. The legacy `attachmentBadgeSize` key is migration input only and is removed from normalized active settings.

Settings remain under `pmf-settings-v5` with `settingsSchemaVersion: 2`. Migration backs up raw pre-schema-2 data to `pmf-settings-backup-pre-schema-2`, maps a legacy shared size into both split fields unless a valid split value already exists, and is idempotent.

`AttachmentBadgeSizing` owns normalization, preview, restore, commit, root classes, metrics, geometry refresh, and creator-rail estimates.

| Size | Post h/min/icon/font/pad/gap | Creator h/min/icon/font/pad/gap |
|---|---|---|
| Small | 20/21/13/10/3/2 | 21/34/13/10/4/3 |
| Medium | 25/26/16/12/4/3 | 26/42/16/12/5/4 |
| Big | 30/31/19/14/5/4 | 31/50/19/14/6/5 |

All values are pixels. Small is the v0.6.0 geometry. CSS variables drive PMF post and creator badges only. Footer heights, many-badge wrapping, tight-card thresholds, badge spacing, and creator-card rail reservation scale with the selected size.

After rendering a creator badge rail, PMF measures its width, adds a safety gap, and writes `--pmf-creator-badge-width`. It refreshes after badge-size changes, category changes, rerender, creator-list replacement, and window resize.

## Creator identity and actions

`CreatorDisplayName` separates:

- `creatorName`
- `serviceLabel`
- formatted `displayName`

Dedicated heading/name candidates are preferred. Candidates containing favorites or only a service label are rejected. Fallback text is cleaned of service labels, favorite counts, the creator ID, and trailing numeric card text. Final formatting is `Creator name (Platform)`.

Creator-card actions:

- none → Scan
- partial → Resume scan
- complete → Update
- active job → Stop

Initial and resumed scans respect `confirmCreatorCardScan`, default `true`. Each enabled confirmation has one short description paragraph. Update always starts directly. Context Menu and Shift+F10 remain supported.

## Rendering, dynamic capacity, and pagination

The toolbar order is media filter, sort, main action, settings. PMF reuses Pawchive’s search input.

Before a Catalogue exists, native posts and search behavior remain active. With Catalogue records, Compact mode renders filtered local records, while Dim and Hide apply matching to Pawchive’s current native page.

Compact geometry is a unified fixed-height calculation. The selected Big/Medium/Small scale chooses a target height derived from measured native card geometry. `16:9`, `4:3`, and `1:1 (original)` choose the width-to-height ratio for the entire card. Legacy saved `native` values normalize to `1-1`. The layout derives card width, column count, and the largest complete-row page capacity at or below `Config.filteredPageSize` from the live container. Ratio changes therefore resize the card window and may change both columns and total filtered pages.

`Paginator.pageButtons()` returns a centered sliding numerical window. Desktop uses five numbers and narrow containers use three. Near a boundary the complete window shifts; page 1 and the numerical last page are not pinned. No ellipses are rendered.

First, Previous, Page, Next, and Last use `data-pmf-page-action`. `Paginator.activate()` resolves the destination against current state at click time, and `Paginator.goToPage()` clamps, persists, renders once, and logs the action. Boundary controls stay present, disabled, muted, and noninteractive.

PMF does not prevent Pawchive native paginator clicks. A changed offset produces a different `nativePageKey`, waits for stable new native content, then rebinds filters and badges.

## Navigation lifecycle

`Lifecycle.routeGeneration`, `mountController`, and `mountPromise` cover creator, post, and artists routes.

Every remount:

- increments the route generation
- aborts the previous mount
- captures the latest route/page key
- verifies generation and route after asynchronous work
- rejects a prior grid whose signature has not changed

Creator identity includes creator key, native offset, and native search query. Post identity includes the creator key and post ID. DOM signatures include the grid element, card count, first/last IDs, and current native paginator page.

BFCache `pageshow` resumes suspended work and preserves a healthy mounted page instead of forcing teardown. If the health check fails, `pageshow` performs a clean route-aware remount after restoring native visibility and removing stale PMF nodes and badges. Health requires one current PMF root, current creator and native page identity, connected native DOM, and, when Compact Catalogue results exist, a connected visible paginator/grid whose direct card count matches the expected slice.

After compact rendering, a count mismatch logs a warning and rerenders once through the fallback renderer.

Per-creator UI state stores `filteredAnchorId` in addition to `filteredPage`. Before opening a post, PMF records that post as the anchor. When Back/Forward, BFCache, refresh, a resize, or a size/ratio change produces a different page capacity, PMF finds the anchor in the current sorted/filtered result set and derives the correct page again.

## Post status and native Favorites

`PostStatus` normalizes one independent record per post with:

- `liked` and `likedAt`
- `seen` and `seenAt`
- `favoriteDirectValue` (`true`, `false`, or `null`) and `favoriteDirectObservedAt`
- `favoritePartialPositiveAt`
- creator/post identity, source, and update time

Like and Seen are local manual toggles. Loading a post never marks it Seen. They are never submitted to Pawchive.

`PostPageController` identifies a connected post-header action group containing native Flag and Favorite controls, measures native spacing/icon/text metrics, then inserts exactly one Like and Seen pair directly after Favorite. Native classes are not copied wholesale. Like uses pink and Seen uses blue, labels switch to Unlike/Unsee while active, and native Favorite observation is narrow and bounded. The inserted controls use measured CSS variables so the row aligns as Flag, Favorite, Like, Seen.

`FavoriteStateResolver` is the sole Favorite authority. Newer direct evidence wins over an older snapshot, newer partial-positive evidence wins over an older snapshot, an active complete snapshot resolves membership and absence, and otherwise direct or partial evidence is used before returning unknown.

`FavoriteSyncCoordinator` discovers the connected Account → Favorites link, rejects login, permission, and unrelated pages, follows real Next pagination, guards repeats, and uses `CatalogueRequestScheduler` for every request. A verified complete crawl is committed in one short IndexedDB transaction under a new snapshot ID. Failure, cancellation, ambiguity, or repetition preserves the previous active snapshot; discovered posts receive positive evidence only. It never mass-clears missing records. Manual work is stoppable and consumes the existing whole-operation concurrency budget. There is no startup sync.

Status filters are globally stored outside `DefaultFilterState`, presets, and per-creator UI. Favorite, Like, and Seen independently cycle `off`, `match`, and `no-match`, and are ANDed with all other filters. Unknown Favorite is excluded from both active Favorite modes. Card badges render only true resolved states in star/heart/eye order and sit below the measured title overlay.

Seen-card dimming is a separate optional display treatment. It defaults off, accepts Low/Medium/High strengths, applies only to cards whose local Seen state is true, and affects the image container without changing card geometry or status-filter semantics.

## Settings

General display order:

1. Post thumbnail size
2. Post thumbnail aspect ratio
3. Attachment badge size
4. Post status badge size

The scan tab, heading, and legend are **Full catalogue scan**. It includes the creator-card confirmation preference and badge controls. Data & performance contains request behavior and only full catalogue scan clearing.

Obsolete settings are ignored and omitted on save:

- `scanMode`
- `range`
- `customFrom`
- `customTo`
- `reuseCache`

Obsolete UI-state fields are removed:

- `storageMode`
- `previousNormalScanRange`
- `scanRange`
- `scannedOffsetsOrRanges`

Per-creator UI state preserves filters, active preset, search, dynamic page anchor/page, sort state, and display mode.

## Shared queue and request scheduler

`CatalogueJobManager` owns unlimited `pendingJobs`, per-creator `activeJobs`, transient `recentJobs`, and `queuedByCreator`. It enforces one queued or active operation per creator, FIFO order, and whole-job concurrency of 1 or 2. Scan, Resume, Update, and optional `metadata-retry` operations use the same slots and are visible from either supported page.

On slot acquisition, creator metadata is reloaded and the operation is derived again. Completion, failure, or cancellation releases only that job's slot and pumps the next FIFO item. Route cleanup removes UI subscriptions without stopping jobs. Full unload shuts down; BFCache suspension records active and pending descriptors, aborts active fetches, and restores descriptors at the front once on `pageshow`.

`catalogueConcurrentJobs` normalizes to 1 or 2 and defaults to 1. Increasing it pumps immediately. Decreasing it never aborts existing work.

`CatalogueRequestScheduler` gates every creator-list endpoint attempt, post-detail attempt, and retry. `nextAllowedAt` enforces `Config.pageRequestSpacingMs = 250`. `cooldownUntil` keeps the longest HTTP 429 `Retry-After` cooldown. Aborting one waiting signal rejects only that waiter and cannot poison the shared promise chain.

## Creator-card badge layout

The enabled subset of `videos`, `images`, `archives`, `projectFiles`, and `externalLinks` is grouped dynamically in canonical order, with at most two items per column and no empty fixed slots. Reversed DOM insertion plus normal left-to-right flex places logical column 0 on the right.

Rails, columns, badges, and job/queue status elements are PMF-owned. Columns expose `data-pmf-column-index` and `data-pmf-badge-types`. After connection, each column clears old sizing, measures its own widest badge, and sets `--pmf-creator-column-badge-width`. The card reservation uses the rendered rail width plus 12 px; estimates are not used.

The `/artists` observer ignores PMF-owned changes. Async refreshes carry route generation and refresh revision, logging `artists-refresh-discarded` for stale results. Settings initialize once before mounting and emit changes that rerender current badges from current metadata.

## Debug events

With `pmf-debug-v1` enabled, structured logs include:

- `route-transition`
- `creator-dom-bound`
- `compact-render`
- `filtered-page-change`
- `attachment-badge-size`

They contain identifiers and geometry/state only, never post content or media URLs.

## Verification boundary

Automated tests cover normalization and static contracts, Catalogue pipeline behavior, migration fixtures, sorting, badge metrics, identity parsing, page clamping, native page identity, and stale-generation cancellation. They do not prove real Tampermonkey BFCache behavior, Pawchive DOM timing, browser side-button navigation, IndexedDB migration in an existing profile, or rendered visual overlap. Those require [TESTING.md](TESTING.md).
