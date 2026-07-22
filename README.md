# Pawchive.pw Media Filter

## v0.13.0 mirrored Native Popular pagination

- Replaced Pawchive's visible Native Popular page selectors and `Showing …` counters with PMF-styled mirrors, matching the Native creator-directory paginator instead of moving the original controls around the page.
- Native Popular now has one PMF paginator immediately below the toolbar and one immediately below the post grid. Both show the same `Showing start–end of total` summary and activate Pawchive's real hidden paginator controls.
- Pawchive's original top/bottom paginator nodes and original result-count nodes remain hidden while PMF is mounted, eliminating duplicated selectors and duplicated `Showing 1–50 of 500` text.
- Local mode continues to use its filtered PMF paginator in the exact same top/bottom positions, and switching Native/Local swaps paginator contents without moving the period controls.

## v0.12.9 Popular performance, incomplete-scan retry, and platform fixes

- Reduced Popular-page DOM work by narrowing post-link and count discovery and by loading only the status records used by the current Popular snapshot. Interrupted Popular scans are no longer silently resumed after navigation or reload.
- Capped Popular post-detail work at two concurrent requests to reduce background pressure on Pawchive while browsing. Host-side Cloudflare 502 responses can still occur, but PMF no longer restarts interrupted work automatically.
- Pawchive's native top result count and paginator are moved beneath the PMF toolbar in Native mode and restored to their original DOM positions when PMF unmounts.
- Native periods with fewer stored entries than Pawchive's expected total show an enabled **Retry scans** action. Only complete snapshots show disabled **Scanned**.
- Shortened the unscanned Local message and fixed Local card platform artwork so Pixiv Fanbox and Patreon use their own canonical Pawchive icons.

## v0.12.8 Native Popular navigation and action-state cleanup

- Removed PMF's custom Popular date/period card and its mirrored Native paginator. Pawchive's original Previous / Day / Week / Month / Next links, count, and page controls are now the only Native navigation shown.
- The selected **Native / Local** mode persists when Pawchive's period links navigate to another day, week, or month. Local mode continues to use its filtered 50-post paginator only for the saved Local snapshot.
- Native periods that are stored or currently scanning show a disabled, muted, struck-through **Scanned** button. Local always says **Update**; it is disabled in the same style until that period has a stored snapshot or while a job is active.
- Popular and creator-directory jobs now render through the same Queue/Issues shell, overall batch-progress block, section layout, progress rows, and action controls. Popular rows keep only period-specific labels and progress text.
- Removed the redundant left-side Local post count, kept the single stored total on the right, left-aligned Local-card dates, and reduced Scan/Update confirmations to Period and Posts only.

## v0.12.7 Popular dated mounts, shared queue, and Local cards

- Explicit older Day/Week/Month URLs now mount from the requested route even when Pawchive keeps the generic **Popular Posts For The Past 24 Hours** heading. PMF waits for a stable real grid/card set and uses explicit period-link evidence when it exists.
- Bare native `<menu>` pagination groups are detected and hidden, removing the leftover Pawchive page selector above the PMF controls.
- Popular jobs now use the same expandable Queue/Issues panel structure and row actions as the creator catalogue instead of an overlapping inline status summary. Queuing a Scan, Resume, or Update opens the panel.
- Local Popular cards rebuild the footer to show the date without Pawchive's duplicated favorite-count text. Rank/favorite metrics sit above the footer, platform icons move to the upper-left overlay, and attachment/status badges are reapplied after the card is connected.
- Popular scans continue to record every observed post as **known to have no missing attachments** at that observation time.

## v0.12.6 Popular controls, navigation, and UI consistency

- The Popular toolbar now uses the same 920 px shared toolbar contract, control grid, typography, and control dimensions as `/artists` and creator pages.
- The period panel sizes to its content. Previous and Next are always present; unavailable destinations remain visible as disabled controls.
- Day, Week, and Month navigation now selects Previous/Next from the matching period row and performs a full document navigation. PMF keeps the existing UI until the requested page has a stable, matching heading and card grid.
- Scan, Resume, Update, Settings, and Local filters use explicit handlers. Local mode uses the same action state as Native, and completed snapshots show Update.
- Status summaries follow the shared directory wording: **Native Popular Posts · Pawchive controls** and **Local Popular Posts · N stored**.

## v0.12.5 Popular injection and layout repair

- Popular Posts now mounts its UI as a stable sibling immediately before Pawchive's native post grid, the same structural pattern used by the working `/artists` controller.
- The Popular controller no longer connects the creator-page `CompactLayoutEngine`, whose lifecycle depends on a creator `App.context`. Local Popular cards instead measure the native Popular grid and reuse only the pure card-size/aspect-ratio calculation.
- Native period controls cannot hide a container that owns the PMF root, and Popular cleanup cannot disconnect another route's layout observer.

## v0.12.2 Popular lifecycle repair and external metadata runner

The Popular Posts controller now starts in an explicit **Native** or **Local** mode and owns only the intended Pawchive elements. Native cards are never hidden through a broad navigation ancestor. The custom period panel follows Pawchive's real Previous / Day / Week / Month / Next destinations, while the Native paginator uses the same First / Previous / numbered pages / Next / Last contract as the rest of PMF. Native filter and sort controls remain visible but disabled as **All posts** and **Sort: Popular**.

Popular mounting is abort-linked to the current route generation. Every asynchronous cache phase checks that the same period/page is still current before it can install UI. Native rebind work is debounced and revision-guarded, so rapid paginator use, Previous/Next period changes, and browser Back/Forward discard obsolete generations rather than leaving an empty or duplicate grid.

### Run missing-attachment metadata outside your normal browser window

`tools/Start-PawchiveMetadataRunner.ps1` launches Chrome or Edge with the same existing browser profile in a dedicated minimized app window. The browser engine must still run because Tampermonkey values and Pawchive's IndexedDB catalogue are browser-profile data, but your ordinary browser window can remain closed. The runner disables Chromium background throttling, keeps Windows awake, restarts after a full browser exit, resumes stopped checkpoints, retries retryable failures, and periodically checks for newly added unknown metadata.

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\Start-PawchiveMetadataRunner.ps1"
```

Close the selected browser before starting the default runner so it can safely use that profile. See [`tools/README.md`](tools/README.md) for browser/profile selection and one-shot modes.

Tampermonkey userscript for scanning a Pawchive creator’s complete post catalogue, filtering the locally stored metadata, and showing attachment badges on creator and post cards.

Current version: **0.13.0**

## Installation

[Install Pawchive.pw Media Filter](https://raw.githubusercontent.com/juliekeygen-netizen/Pawchive.pw-Media-Filter/master/pawchive-pw-media-filter.user.js)

## v0.12.0 Popular Posts catalogue

`/posts/popular` now has compact **Native** and **Local** modes for every dated Day, Week, and Month period. Native mode keeps Pawchive's own popularity order and period navigation, provides mirrored pagination, and queues Scan / Resume / Update work for the selected period. Multiple periods may wait in the Popular queue without replacing one another.

A Popular scan stores metadata only—never media files. Existing complete posts are reused, new or incomplete posts receive their normal detail metadata, and every observed card is marked known-no-missing for that observation time. Period membership keeps its own rank and displayed favorite count, so one post can retain different popularity values in different day, week, or month snapshots.

Local mode reuses the existing post-filter UI, saved presets, Favorite / Like / Seen filters, compact card settings, and 50-post paginator. Sorting remains locked to **Popular**, using the selected period's displayed favorite count and native rank. Popular period data, observations, and UI state are included in `.pmfbackup` Merge / Replace imports and have dedicated clear-current and clear-all actions under Data & performance.

Fresh installs now include `iframely.net` in **Known media and download hosts**. Existing customized host lists are preserved.

## v0.11.6 import-dialog cleanup

- The Import backup view now contains only **Cancel**, **Import backup**, and the header close button. Both duplicated Back controls were removed.

## v0.11.5 large-backup streaming repair

- Export no longer converts the complete catalogue into one giant JavaScript string. It writes a chunked JSON-Lines `.pmfbackup` file, preventing `Invalid string length` on large local catalogues.
- Import reads `.pmfbackup` files incrementally from the browser file stream, while retaining compatibility with older single-file `.json` backups.
- Each store record remains ordinary JSON inside the portable backup; Catalogue, Settings, Presets, Merge/Replace, hostname remapping, and validation behavior are unchanged.

## v0.11.4 backup integrity audit

- Catalogue export now reads every IndexedDB store in one consistent transaction instead of taking separate store snapshots while scans or status writes may continue.
- Import validates every selected data group before writing anything. Replace cannot clear local data when a backup is incomplete or malformed.
- Backups move safely between `pawchive.pw` and `www.pawchive.pw`; imported creator/post identities, statuses, UI state, Favorite snapshots, and Pawchive URLs are remapped to the current hostname. Profiles that already contain both hostname variants are consolidated using the newer or more complete matching record.
- Replace clears all catalogue stores, including empty stores from the backup. The memory-only fallback also carries creator UI state and native-Favorite snapshot membership.

## v0.11.3 backup and mobile corrections

- Native directory pagination uses a compact five-button mobile layout.
- Bulk creator previews are scroll-bounded so Queue and Cancel remain reachable.
- Reset all settings lives under **Data & performance → Backup and reset**.
- **Export / Import catalogue** creates or restores a portable backup containing local catalogue records, statuses, settings, and both preset systems. Imports may merge with the current catalogue or replace it.

## v0.11.2 mobile-responsive interface

The PMF interface now has a dedicated phone and small-tablet layout. Settings rows stack the setting name above its select, input, or textarea instead of squeezing labels into a narrow desktop column. Checkbox rows retain a compact checkbox-and-chevron layout. Settings tabs scroll horizontally without wrapping, automatically center the selected tab, and the modal uses the dynamic viewport plus safe-area padding so its content and Save/Cancel actions remain reachable above mobile browser controls.

Post **Custom search rules** and creator **Advanced rules** are rendered as stacked mobile cards rather than wide desktop tables. Rule text, field selection, conditions, Amount/Percentage inputs, and delete controls no longer require horizontal dragging. Creator/post toolbars use safe mobile columns; the Local catalogue Update split button keeps its primary action and chevron on one row. Floating sort, service, field, and choice menus use a useful mobile width, remain inside the viewport, and can open above a trigger when space below is limited.

Bulk selection, queue rows, filter popovers, date and aggregate editors, maintenance buttons, dialog footers, and long help/status text also reflow at 760 px and narrower. Desktop 1080p/1440p layouts and stored data are unchanged.

## v0.11.1 second-pass audit corrections

A full source-level re-audit of the v0.11.0 Local catalogue redesign corrected several state and aggregate edge cases before further feature work. Published-date filters now stay disabled when their saved dates are retained, and the Advanced-rules parent switch no longer overwrites individual rule-row choices. **No match** text rules count eligible posts that do not satisfy the text query rather than negating the final threshold.

Creator summary schema 5 records the authoritative attachment/link universe used by attachment-mode percentages: every real stored attachment, including uncategorized/audio files, plus external links under the active scope. Complete and partial Local Catalogues can rebuild that summary entirely from IndexedDB. Dynamic Custom-extension and text-rule aggregates use bounded fingerprint caches and stronger record signatures so locally hydrated results replace stale rendered records without a Pawchive network scan.

The creator-filter popup now retains the trigger width at narrow layouts, cleans up same-trigger reopen attempts, may open upward when there is insufficient room below, and sends first-time Date or Custom-extension activation to the required child editor instead of enabling an empty condition. Creator presets reject blank/duplicate names without closing the editor, repair malformed legacy IDs/names while preserving Default, and keep validation messages visible. Advanced attachment sorting now defaults to the specified Images-first order and remembers its Type/Method configuration even when Discard leaves the active sort unchanged.

## v0.11.0 Local catalogue redesign

The visible creator-directory mode is now **Local catalogue**. Its compact toolbar, search placeholder, stored-count text, typography, selected colors, and status language are aligned with the creator-page PMF interface without changing Pawchive’s native directory or the internal Catalogue storage model. The Native directory service proxy also renders one dropdown arrow instead of stacking a native-looking marker and PMF’s shared marker.

Local sorting is reduced to **Popularity**, **Alphabetical**, **Catalogue post count**, **Post publish date**, and **Advanced attachment amounts**. The Advanced child dialog selects Images, Videos, Archives, Project files, or External links, chooses Amount or Percentage, and exposes Highest-first or Lowest-first direction. Amount and Percentage use the same global **Count method** as creator-card attachment badges: post mode counts matching posts; attachment mode counts files/links and calculates percentages against all counted attachments/links. Unknown values remain after known values in both directions.

The former giant Creator Filters modal is replaced with a compact anchored popover. Service is always an independent AND condition; enabled groups can match **All** or **Any**. Published date and every media type open focused child dialogs. Custom extensions remain available, and Advanced rules support IF/AND/OR, Match/No match, multiple searchable fields, Amount/Percentage conditions, and an expression preview. Partial Catalogues are included only for mathematically safe lower-bound Amount conditions.

Creator filter presets use a compact manager and preserve service, All/Any, date rules, media conditions, Custom extensions, Advanced rules, and partial-data policy. Legacy creator-filter and sort values are normalized into the new model without clearing Local Catalogue posts, creator identities, statuses, presets, or settings.

## v0.10.12 creator native-card visibility repair

The v0.10.11 early creator-page handoff hid Pawchive's native post grid with `display: none` before compact-card geometry was captured. On affected creators, PMF could load the Catalogue, toolbar, and paginators while the compact cards had no usable sizing geometry and appeared blank.

Early handoff now conceals native pixels with `visibility: hidden` while retaining measurable layout. PMF then captures native geometry, renders the compact grid, and removes only the temporary concealment. Unscanned creators never enter early takeover, and failed takeover restores Pawchive's native cards. A bounded fallback geometry keeps compact posts visible if native measurements are temporarily unavailable.

## v0.10.11 artists navigation, responsive layout, and creator-page handoff

Native directory and Local catalogue now have an explicit one-grid visibility contract, including a `display: none !important` override for the PMF Local grid while Native mode is active. The artists controller observes a stable native result container, reacquires replaced Pawchive grid/search/paginator nodes, and discards stale references instead of allowing Native and PMF grids from different generations to remain visible together.

Top and bottom Native paginator mirrors now share one navigation coordinator. Clicking either mirror immediately gives both controls the same pending target, suppresses duplicate navigation while Pawchive is replacing the native DOM, and reconciles both mirrors after the new native page becomes authoritative.

Local catalogue keeps its existing 1080p geometry but uses a wider desktop canvas and a larger minimum reconstructed-card height at 2560-pixel-wide layouts. Creator pages with a known retained or loaded Catalogue conceal the transient native post grid behind a contained PMF restoration shell until the filtered/sorted PMF view takes ownership. Unscanned creator pages continue to use Pawchive's native posts normally.

Bulk creator previews now show `…and N more` after the first 100 rows, use readable Scan/Resume scan/Update labels, retain the 1,000-creator First-N maximum only for Scan, and leave Update/Retry-Resume First-N unrestricted by that artificial UI maximum.

## v0.10.10 filter consistency, navigation, defaults, and maintenance visibility

Creator-card External links totals now use the same **External-link scope** and **Known media and download hosts** rules as creator-page post filtering and post-card badges. Stored posts carry a classification fingerprint; changing extensions, project keywords, project evidence, or known hosts reclassifies existing Catalogue records in place and refreshes creator summaries without clearing and rescanning the Catalogue.

The default media/download host list no longer includes `redgifs.com`. Project-file keyword defaults are reduced to the requested English terms and add explicit Japanese, Simplified Chinese, and Traditional Chinese PSD/PSB/CLIP, project/source, editable, and layered-file phrases. Settings schema 5 migrates only untouched prior defaults and preserves customized lists.

Native alphabetical selection preserves Pawchive's current direction instead of silently forcing ascending order. Creator-directory and creator-post results now have synchronized bottom paginators, and unmodified Left/Right Arrow keys page Local Catalogue and creator post results without invoking Pawchive's hidden native refresh handler.

Data & performance now reports stored missing-attachment metadata inventory: known/no-missing, known/missing, unknown, and total posts. Missing-metadata maintenance can use up to five structured workers and two adaptive HTML workers, remembers when a service's structured endpoint cannot provide the field, and bypasses repeated unhelpful detail requests. The global request scheduler and 429 cooldown remain authoritative.

Native creator API snapshots now merge any supplied names, favorite counts, avatars, banners, and service labels into existing directory records before bulk jobs are queued. Missing optional profile artwork that the API does not provide remains repairable through **Repair creator profile metadata**.

Catalogue clearing now stops and awaits active Catalogue/maintenance writers before deleting local rows, resets the missing-attachment checkpoint, clears retained creator sessions, and refreshes `/artists`. **Clear this creator’s full catalogue scan** appears only on an actual creator page. Clearing all Catalogue scans preserves creator-directory identity records, local Favorite/Like/Hidden/Seen state, presets, and global settings.

## v0.10.9 live-test fixes

Creator attachment badges now remain visible while aggregate totals are being recomputed after changing **Hide and don’t count posts with missing attachments** or another aggregate-affecting setting. Compatible prior totals stay visible until each current summary is committed, and the creator directory starts a controlled background refresh instead of temporarily removing every badge.

Missing creator artwork that returns 404 is remembered for the current page session, preventing repeated requests for the same broken banner or avatar whenever Local creator cards rerender. Missing-attachment checkpoints now retain only the 50 most recent terminal task IDs plus a total terminal count, reconcile already-committed pending tasks after reload, and preserve failure-limit pause messages.

## v0.10.8 bounded streaming maintenance and cleanup

The missing-attachment updater now streams stored posts through resumable IndexedDB cursor chunks instead of loading every unknown post into one task array. Its schema-3 checkpoint stores only the current bounded chunk, retryable failures, the cursor position, scope, and progress. **All unknown posts** uses a cheap stored-post upper bound for confirmation and then makes one streaming pass; it no longer constructs the entire plan twice before work begins.

Progress now reports current and average completion rates, an upper-bound ETA while the cursor is still discovering unknown records, stored rows streamed, and known retryable or terminal work. Structured requests remain adaptive, HTML fallback remains limited to one request at a time, writes remain batched, and the worker pauses after 25 consecutive retryable failures or 250 collected retryable failures instead of growing an unbounded checkpoint.

Affected creator summaries are recomputed after maintenance and patched into the retained Local catalogue in one batch with one cache invalidation and one render. Setup failures for both metadata maintenance and creator-profile repair now release the shared maintenance slot. The obsolete `LegacyCreatorIndexUI` implementation and the post-definition Creator Settings wrapper were removed; the missing-attachment exclusion is integrated directly into the authoritative Creator-card settings child.

## v0.10.7 Local catalogue performance and scalable maintenance

Local catalogue state is now retained across creator navigation and restored before the background IndexedDB refresh. The retained view preserves search, filters, sort, page, Queue-panel state, and scroll position. After records are loaded, ordinary Local pagination reuses a cached filtered/sorted array, slices the next 50 records, and renders the cards through one `DocumentFragment`; it does not start creator-profile requests or reload all creator records.

Creator metadata repair is no longer coupled to Local rendering. Essential identity problems—such as missing or numeric names and invalid creator identity—are separated from optional enrichment such as missing banners or favorite counts. Manual repair has durable Stop, Resume, and Retry-failed state, and profile HTML uses distinct avatar and banner selectors instead of assigning one `og:image` to both.

The main **Creator cards** Settings section now directly exposes **Count method** with **Posts containing media** and **Total attachments/links from every post**, followed by **Hide and don’t count posts with missing attachments**. The same controls and Data & performance maintenance actions are available from creator pages and `/artists`.

**Update missing-attachment metadata** now offers Current creator, Current Local catalogue page, First N unknown posts, and All unknown posts. It uses structured details first, a separately bounded HTML fallback, adaptive request concurrency, batched IndexedDB writes, creator-level summary recomputation, rate/ETA reporting, and durable Stop/Resume/Retry-failed checkpoints. Failed work remains retryable, and buffered successes are not removed from the checkpoint until their batch write commits.

## v0.10.6 authoritative Queue, paginator, and metadata repair

The Local Catalogue renderer now directly owns a stable five-button desktop (three-button narrow) page window with persistent First, Previous, Next, and Last controls. Aggregate media, status, Favorite, custom-extension, custom-rule, tooltip, and sorting percentages use the aggregate-eligible post count; stored Catalogue coverage remains unchanged.

Queue session v4 is serialized and restored directly, including directory snapshots, batches, terminal accounting, issues, recent history, and concurrency. Successful history has no expiry timer: it remains until **Clear completed** or the next idle batch. Retries preserve snapshots and reverse exactly one prior terminal contribution.

Weak creator records can be repaired lazily or through **Repair creator profile metadata**. **Update missing-attachment metadata** now uses structured data first and persists Stop/Resume progress, failures, remaining IDs, and affected creators. Both actions and live progress are available from creator-page and `/artists` Settings. Existing v1-v3 Queue sessions migrate in place; IndexedDB, post schema, settings, presets, and Catalogue data remain compatible.

## v0.10.5 corrective follow-up

v0.10.5 keeps Local Catalogue storage and coverage based on every stored post while the optional missing-attachment exclusion affects only visible results and creator aggregates. The Data & performance action **Update missing-attachment metadata** checks unknown posts on demand, using Pawchive post pages with shared request spacing; normal scans do not blindly request every post HTML page.

Queue completion history is retained until **Clear completed** or a new batch starts from an idle Queue. Bulk Scan remains bounded to 1–1000 matching actionable creators; Resume and Update also offer All creators within the active filtered result.

## v0.10.4 artists lifecycle, bulk metadata, and Queue corrective release

Native directory mode now uses compact segmented mode controls and Pawchive-style anchored menus for Service and Sort. Sort direction is part of the Sort control, the mirrored paginator deduplicates controls by semantic role, its status line is centered, and the Queue state sits at the far left of the native status row. Creator-page post filters and sort menus use the exact width and left edge of their triggers, and the trailing Hide action receives balanced native-header spacing.

The primary creator-directory action is mode-specific: **Scan** in Native directory and **Update** in Catalogue. Its split menu contains only **Retry/resume incomplete**. Bulk operations now offer Current visible result page or First matching creators (1–150), preview only actionable creators, skip active/queued work, and keep scanning the background native result order until the requested eligible count is reached.

Queue session payloads are version 3. Batch terminal counts and job identities remain durable after recent-job expiry, reload, and navigation, so overall and per-batch progress no longer resets or exceeds its fixed total. Retained completed batches show **Queue idle** instead of **Queue empty**, while the Queue/Issues panel preserves its selected tab, open details, and scroll position during live updates.

## v0.10.2 Native directory and Catalogue modes

`/artists` now has two explicit, persisted modes. **Native directory** is the default and keeps Pawchive's real search, current service/sort/direction state, paginator state, native cards, and native grid geometry authoritative. PMF mirrors the native controls only after the proxy is ready, decorates the current native cards in place, and offers one negative Scanned filter for the current Pawchive page. It never fills native results from the local creator directory.

**Catalogue** is the local index. It contains only creators with actual partial or complete local Catalogue coverage, filters and searches locally, provides the advanced PMF filter/sort controls and Favorite/Like/Hidden quick filters, and paginates 50 results at a time. Catalogue cards use a sanitized native card template when one is available, with creator-specific links, text, images, IDs, event attributes, and framework attributes replaced or removed. The Catalogue grid copies the measured native column count, gaps, card width, and card height.

Switching modes removes the prior mode's search listeners and overlays without reloading. Cleanup restores Pawchive's grid, service/sort/direction controls, count, paginator, search placeholder, and card decorations. Existing Queue/bulk work continues independently of the selected visual mode.

The former creator-card **Scanned** status badge, Catalogue quick filter, and setting have been removed. Old stored Scanned badge/filter values are ignored during normalization. Settings schema 4, `pmf-settings-v5`, post schema 2, and IndexedDB version 5 remain unchanged; the selected directory mode is stored separately in `pmf-creator-directory-mode-v1`.

## v0.10.1 creator-index corrective completion

v0.10.1 stabilizes the unified `/artists` experience around an explicit ownership boundary. Native creator links are used only for discovery, creator cards are reconstructed from safe stored identity data, native search remains available, and duplicate native grids, selectors, and paginators are reversibly hidden after PMF is ready. Refresh requests are coalesced against one saved native grid reference, while empty, loading, and error states remain visible.

Creator summaries are now version 3 and are derived from authoritative local Catalogue posts and persistent post status. Project-file post counts include title/tag/content evidence even when no physical project attachment exists. Date filters use stored publication timestamps, custom-extension and custom-rule aggregates are hydrated from IndexedDB without network requests, and partial Catalogues are accepted only for safe non-percentage lower-bound conditions.

The Settings schema is now 4. Migration keeps `pmf-settings-v5`, writes `pmf-settings-backup-pre-schema-4`, preserves explicit values, and adds a creator-card attachment **Count method** with **Matching posts** as the default. Creator-index Settings uses the same General, Default detection, Scanning, and Data & performance builders as creator pages.

Bulk work now has durable fixed-total batches. Queue session version 2 preserves batch identity, order, waiting work, interrupted active work, recent results, and per-batch progress. The Queue/Issues panel exposes per-batch progress and cancellation without changing a batch’s original total.

Post schema 2 and IndexedDB version 5 are unchanged.

## v0.10.0 unified creator index and queue

`/artists` is now one PMF-owned creator index. Pawchive’s native creator cards are captured as templates and directory evidence, then reconstructed in a stable grid that combines current directory results, locally known creators, creator state, and Catalogue summaries. The native creator search field is reused; PMF does not add a duplicate search input.

Historical note for v0.10.0: that release exposed Favorite, Like, Hidden, and Scanned creator quick filters. v0.10.2 supersedes that combined index: Catalogue mode now exposes only Favorite, Like, and Hidden, while Native directory has the single negative current-page Catalogue-availability filter described above.

Historical note for v0.10.0: Creator filters originally exposed directory, Catalogue-state, media, percentage, and post-status aggregate fields in one large modal. v0.11.0 supersedes that interface with the compact Local catalogue popover, global Count-method semantics, Published date/media child dialogs, All/Any groups, Custom extensions, and Advanced rules.

Individual creator pages add local **Like/Unlike** and **Hide/Unhide** actions beside Pawchive’s real Favorite action. Like and Hidden are stored locally and never make a Pawchive request. Creator cards use one coordinated right rail for Favorite/Like, attachment totals, and Hidden status. Hidden cards can use the shared Low/Medium/High dim treatment.

The `/artists` toolbar exposes a split bulk action for Update, Scan, and Resume. Confirmed batches freeze creator order, deduplicate queued/active creators, respect whole-operation concurrency 1 or 2, and persist waiting descriptors in `sessionStorage`. The expandable Queue/Issues panel supports Stop, Move to top, Remove, Retry, Dismiss, Clear completed, and Cancel remaining batch. Interrupted active work is reported as interrupted after reload rather than completed.

This release keeps post schema 2 and `pmf-settings-v5`, upgrades IndexedDB in place to version 5 with `creatorDirectory` and `creatorStates`, upgrades creator summaries to version 2 asynchronously, and upgrades Settings to schema 3 with a raw pre-migration backup. Clearing Catalogue data does not clear creator Like/Hidden state.

## v0.8.4 native stylesheet and settings patch

v0.8.4 keeps post schema 2, IndexedDB version 4, and the stable `pmf-settings-v5` key. It adds guarded native-stylesheet health monitoring and one-shot recovery, document/head generation tracking, PMF-owned mutation filtering, stylesheet-aware BFCache/Turbo resume, and a bounded native-content fallback if mounting cannot complete.

When PMF debug logging is enabled, `globalThis.__PMF_DEBUG__.stylesheetHealth()` returns the current state, captured descriptor baseline, live snapshot, and deduplicated health history. If descriptor restoration cannot recover styling, a session-scoped normalized-URL guard permits one controlled hard reload and suppresses a reload loop.

Settings now use an explicit schema-2 migration. The former shared attachment badge size is migrated once into independent post-card and creator-card sizes, with a raw pre-migration backup. Select controls use a consistent arrow shell, main tabs have restrained titles, and badge/status/Seen appearance controls live in their related child pages.

Post-page Like/Unlike and Seen/Unsee actions continue to sit beside native Flag and Favorite. Their action spacing, line height, and separate icon width/height are measured from the native group; inner icons use optical scaling and receive at most one clamped vertical alignment correction.

Creator quick-filter icons and post-card status icons use separate, stable outer boxes. Active, inactive, and no-match states change color/fill/overlay only, so state changes do not resize either scope. The quick-filter row, `Showing …` summary, and paginator buttons use one equal vertical-gap variable.

## v0.8.3 corrective architecture

v0.8.3 keeps post schema 2 and IndexedDB version 4. It adds a one-time card-scale migration, one compact-layout authority, persistent post-status coordination, a five-creator LRU session cache, coalesced navigation reconciliation, soft BFCache/Turbo reuse, direct-sibling post actions, and a reusable draft-based Settings UI.

In the v0.10.2 split, Native directory always retains Pawchive's native grid and Catalogue mode always uses the compact local Catalogue grid. Filter, preset, search, sort, page/anchor, layout, and scroll state are persisted automatically.



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
