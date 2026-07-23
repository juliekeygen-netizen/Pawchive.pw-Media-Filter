# Pawchive.pw Media Filter v0.13.0 specification

## v0.13.0 Native Popular paginator contract

- Pawchive's Day / Week / Month period links remain native and visible.
- Pawchive's original page-number paginator nodes and original `Showing …` count nodes are hidden whenever the Popular controller is mounted.
- Native mode renders two PMF-owned paginator mirrors: one immediately below the PMF toolbar and one immediately below the post grid.
- Each mirror displays `Showing start–end of total` and the same First / Previous / numbered pages / Next / Last controls derived from Pawchive's hidden paginator.
- Clicking a PMF Native paginator button activates the corresponding real Pawchive paginator item; PMF does not invent page URLs.
- Local mode uses the same two hosts for its filtered paginator, so changing Native / Local swaps controls without changing their page positions.

## v0.12.9 Popular performance and completeness contract

- Popular DOM discovery must prefer direct post-link and nearby paginator/count selectors. It must not recursively classify every count-like node as a possible post card.
- Popular status hydration reads only the post-status keys referenced by the selected period. It must not load the complete status store merely to render one period.
- Popular post-detail fetching is capped at two concurrent requests. An active Popular job interrupted by navigation or reload is restored as an **Interrupted** issue and requires an explicit retry; it is not silently resumed in the background.
- Native mode places Pawchive's top result count and paginator immediately after the PMF root. Their original parent/sibling positions and visibility are restored during cleanup.
- A period is complete only when its stored-entry count reaches the known Pawchive total and it has no retryable metadata work. An incomplete stored period exposes **Retry scans**; a complete or active period exposes disabled **Scanned**.
- Local unscanned copy is exactly `This Popular Posts period has not been scanned.`
- Local card platform icons are derived from the post service. `fanbox` and `pixiv_fanbox` use `/static/small_icons/fanbox.png`; `patreon` uses `/static/small_icons/patreon.png`.

## v0.12.8 Popular native-navigation and action-state contract

- PMF does not create a Popular date/period card or a second Native paginator. Pawchive's original Previous / Day / Week / Month / Next destinations, result count, and page controls remain authoritative and visible in Native mode.
- Local mode may hide Pawchive's page paginator while rendering the saved filtered snapshot, but the native period selector remains visible and usable. A period-link navigation saves the global Native/Local mode before full-document navigation, and the destination restores that mode rather than an older per-period mode.
- Native primary action is **Scan** only for an unscanned, idle period. A stored period or a queued/running job displays disabled **Scanned** with muted, struck-through styling. Local always labels the action **Update**; it is enabled only for a stored, idle period.
- Scan and Update confirmation dialogs contain only the action title, `Period: …`, and `Posts: up to …`.
- `QueuePanelView` is the shared queue renderer for both creator and Popular jobs. Tabs, overall progress, section headings, progress rows, issue handling, completed details, and action placement use the same markup; only the job identity and progress message differ.
- The left status area contains only the queue control. Local post totals are not duplicated there; the right status displays the one stored-period total.
- Local Popular footers and their timestamp descendants are left-aligned.

The v0.12.8 contract supersedes earlier Popular bullets that required a PMF period panel, mirrored Native pagination, Local scanning from an unscanned period, or a duplicated left-side Local count.

## v0.12.7 Popular dated-mount, queue, and card contract

- An explicitly dated Popular route remains authoritative when Pawchive renders the generic **Popular Posts For The Past 24 Hours** heading. That generic heading is not date evidence and may not cause the requested route to be rejected. Explicit same-period links or an explicit dated heading may still reject a stale replacement DOM.
- Popular readiness requires a stable connected post grid and real post cards, but not a heading node. The prior PMF root remains until the requested route is ready.
- Native Popular pagination discovery includes unclassed `<menu>`, `<ul>`, and `<ol>` groups containing multiple `/posts/popular?...&o=...` links. Those groups are hidden after PMF mirrors pagination, without hiding the grid or a PMF-owned ancestor.
- Popular Queue is an expandable shared-style Queue/Issues panel using the creator catalogue's queue tabs, progress summary, job rows, and Stop / Move to top / Remove / Retry / Dismiss actions. A newly accepted Scan, Resume, or Update opens it. Queue counts may not overlap Local result or storage summaries.
- Local Popular cards rebuild the native footer. The visible footer contains the published date, not Pawchive's native favorite-count line. The period-specific **#rank · N favorites** metric is an overlay immediately above the footer. Patreon/Fanbox service artwork is a top-left overlay. Media badges and Favorite / Like / Seen badges are reapplied after insertion into the connected Local grid.
- Every post observed while scanning a Popular page is stored with `missingStatsKnown=true`, `hasMissingStats=false`, `missingStatsSource='popular-page'`, and the observation timestamp. A later direct post check may supersede this evidence.

## v0.12.6 Popular control and navigation contract

- `.pmf-popular-toolbar` also uses `.pmf-creator-index-toolbar`; desktop width and the Filter / Sort / primary action / Settings grid must match the creator directory.
- The period surface is content-sized. Previous, Day, Week, Month, and Next always render in that order. Missing Previous/Next destinations are disabled rather than removed.
- A Previous or Next destination is valid only when its URL `period` matches the currently selected period. Links from another period row may not overwrite it.
- PMF-owned Popular navigation and mirrored native pagination use a full document navigation rather than Turbo. The current root remains until the requested native heading, date, grid, and cards are stable.
- Explicit dated routes may not bind a stale grid whose observed heading/link date differs from the URL date.
- Lifecycle startup may not restore/remove native content while the matching Popular route has an active mount promise.
- Scan / Resume / Update and Settings have direct event handlers. Local mode uses the same action resolver as Native and may queue an unscanned period directly.
- Native status text is **Native Popular Posts · Pawchive controls**. Local status contains **N Local Popular posts** and **Local Popular Posts · N stored**.
- Settings card-size/aspect previews on Popular pages use the Popular-owned layout calculation and must not connect creator-only observers.

## v0.12.5 Popular injection and layout contract

- The Popular root is inserted directly before the connected native Popular grid. It must not be inserted inside or relative to a native period-navigation group that PMF may hide.
- Popular mounting publishes its page AbortController for shared settings/overlay actions, but it does not connect the creator-only compact-layout observer.
- Popular Local mode measures the visible native Popular grid and uses the pure `CompactGridScale.calculateLayout` / `setOwnedGridStyles` helpers without requiring creator `App.context` state.
- Popular cleanup cancels only Popular-owned resize/native observers and clears `App.pageController` only when it still points to that same controller.
- Native period/paginator hiding must skip any container that contains the mounted Popular root or another PMF-owned node.

## v0.12.2 Popular lifecycle and maintenance-runner contracts

- Popular native-control discovery must reject any candidate that is the native grid, contains the native grid, contains native post cards, or contains a paginator subtree. Period links may still be read from beside/inside a native paginator before that paginator is hidden.
- A Popular mount is tied to both the Lifecycle route generation and an inner AbortController. Cache reads for period metadata, observations, posts, statuses, Favorites, and UI state must verify the current `pageKey` after every await. An obsolete mount may not append roots, hide native content, or overwrite the active period.
- Native and Local mode buttons expose one explicit selected state immediately on mount. Native keeps Pawchive cards visible; Local hides only the captured native grid and renders the saved period snapshot.
- The custom period panel uses Pawchive's discovered Previous/Next URLs whenever available. PMF must not infer calendar boundaries when a real native link exists.
- Popular native pagination exposes First, Previous, numbered pages, Next, and Last and navigates through full period URLs preserving `date` and `period`.
- Native `All posts` and `Sort: Popular` controls are disabled, muted, and struck through. Queue state is left-aligned. The primary action is Scan for no stored entries, Resume for a partial/working snapshot, and Update for a completed snapshot.
- `?pmf_maintenance=watch-missing|resume-missing|retry-missing|start-missing` starts the corresponding missing-attachment operation after Settings and queue state are loaded.
- `watch-missing` resumes outstanding work, retries retryable failures, and performs a bounded inventory check no more than once every five minutes after completion so newly added unknown posts can start another all-unknown pass.
- The PowerShell runner must use the existing browser profile, launch a real minimized Chromium app window, disable background throttling/background mode, keep Windows awake unless disabled, and explain that a fully browser-free process cannot directly share Tampermonkey/IndexedDB state.
- The untouched schema-5 known-host default migrates to include `iframely.net`; customized host lists are not modified.


## Scope

The project is one Tampermonkey userscript, `pawchive-pw-media-filter.user.js`. It augments Pawchive creator pages, post pages, `/artists`, and `/posts/popular`. It stores normalized post metadata and user-controlled status locally and never downloads media files.

## Persistent identifiers

- Userscript and `Config.version`: `0.13.0`
- Settings: `pmf-settings-v5`
- Settings schema: 6; raw upgrade backup: `pmf-settings-backup-pre-schema-4`
- Presets: existing key, schema 1
- Post schema: 2
- Creator-card summary schema: 5
- IndexedDB: `pawchive-media-filter`, version 6
- Creator directory store: `creatorDirectory`, keyed by `creatorKey`
- Creator state store: `creatorStates`, keyed by `creatorKey`
- Post-status store: `postStatuses`, keyed by domain/service/creator/post with a `creatorKey` index
- Native Favorites sync state: `pmf-favorite-sync-v1`
- Global quick-status filters: `pmf-post-status-filters-v1`
- Queue session: authoritative schema 4 with explicit migration from schemas 1-3
- Missing-attachment checkpoint key: `pmf-missing-attachment-maintenance-v1`; payload schema 3
- Creator-profile repair checkpoint key: `pmf-creator-profile-repair-v1`; payload schema 2
- Favorite snapshots: `favoriteSnapshotEntries` and `favoriteSyncMeta`
- Popular period stores: `popularPeriods` keyed by `periodKey`, `popularEntries` keyed by period plus post key, and `popularUiStates` keyed by `periodKey`
- Popular queue session: `pmf-popular-queue-v1`

## v0.12.0 Popular Posts contracts

- `/posts/popular` and its dated `period=day|week|month` URLs are first-class routes. A period key is hostname + `popular` + period + canonical date; page offsets do not create separate local periods.
- Native mode owns scanning and updating. Its filter and sort controls are visible but disabled as **All posts** and **Sort: Popular**. Pawchive's actual Day / Week / Month and previous / next URLs remain authoritative, and native page controls are mirrored through PMF's compact paginator.
- Each scan walks every native result page for the selected period, captures rank and the displayed favorite count, and stores one period-entry observation per post. Shared post metadata remains in the normal `posts` store and is not duplicated per period.
- Complete existing posts are reused. New or incomplete posts receive normal detail metadata through the shared request scheduler. Every successfully observed Popular card is marked known-no-missing at that observation time; later direct checks may supersede that evidence.
- Update replaces the selected period's membership with the newly observed run, refreshes rank/favorite values, and removes stale period entries. Interrupted runs remain resumable through stored offsets and run IDs.
- Popular jobs are keyed by period rather than creator, support multiple queued periods, persist through reload, and share the creator queue's maintenance slot/rate-limit scheduler.
- Local mode uses the shared post filter/preset/status/card engines and a period-specific saved filter/page/mode state. Search and alternate sort modes are unavailable; ordering is displayed favorite count descending, then native rank.
- Popular period stores participate in `.pmfbackup` streaming export/import, cross-host remapping, Merge/Replace, memory fallback, and clear-current/clear-all maintenance.
- `iframely.net` is part of the fresh default known-host list. User-customized host lists are migrated without being overwritten.

## v0.11.6 import-dialog action contract

- The Import backup view has one dismissal action in its footer: **Cancel**. It has no Back control above the form or in the footer. The header close button remains available.

## v0.11.4 backup-integrity contracts

- IndexedDB catalogue export uses one read-only transaction containing every catalogue store. The exported store set is therefore one consistent snapshot even when normal scan/status work is active.
- Import preflights every selected group before writes. Format, selected groups, all catalogue stores, record key paths, duplicate store keys, and duplicate post/creator preset IDs must be valid before Merge or Replace starts.
- A backup whose `sourceHost` is the other supported Pawchive hostname is remapped to the current hostname. The remap covers creator/post keys, directory/meta records, per-creator UI state, post/creator statuses, Favorite snapshot entries/meta, auxiliary Favorite-sync metadata, and Pawchive-owned URLs. Any collisions created by remapping a profile that already contains both host variants are consolidated using the newer record, with creator-directory field merging and post completeness as tie-breakers.
- Replace clears every catalogue object store before writing the validated backup, including stores represented by empty arrays.
- When IndexedDB is unavailable, the in-memory fallback exports/imports creator UI state and Favorite snapshot membership in addition to posts, creator metadata, statuses, directory records, and creator state.

## v0.11.5 large-backup stream contract

- New backups use the `.pmfbackup` extension and JSON-Lines container `pawchive-media-filter-backup-jsonl`, stream version 1.
- Export must serialize the header, catalogue metadata, each store record, Settings, and Presets as independent JSON entries grouped into bounded Blob parts. The complete backup must never be passed to one `JSON.stringify` call.
- Import detects the streamed header from the file prefix and parses the file incrementally through `File.stream()` and `TextDecoder`. Older v0.11.3/v0.11.4 single-document `.json` backups remain importable.
- The reconstructed payload must pass the same format, selected-group, duplicate-key, hostname-remapping, Merge, and Replace validation used by legacy backups.

## v0.11.3 portability and compact-mobile contracts

- At phone widths the Native directory mirror renders only First, Previous, the current numbered page, Next, and Last.
- Bulk creator dialogs keep their footer visible and constrain the preview to an internal scrolling region.
- Reset all settings is a Data & performance action, not a primary modal-footer action.
- Backups use format `pawchive-media-filter-backup`, format version 1, and include all IndexedDB stores used by the local catalogue plus persisted settings/filter state and both post/creator preset records.
- Catalogue import offers merge (retain existing keys and upsert imported records) and replace (clear included catalogue stores before import). Settings and presets are independently selectable.
- Import is rejected while creator jobs are active or waiting, then reloads the page after a successful restore so every controller reads the imported state cleanly.

## v0.11.2 mobile UI contracts

- At CSS viewport widths of 760 px or less, Settings field rows must stack the setting title above the control. Labels must wrap by words rather than collapsing into one-character columns.
- Toggle rows must remain a compact checkbox/label row, with an optional child-settings chevron in a separate fixed-width column.
- Settings tabs must be horizontally scrollable, non-wrapping, and keep the active tab visible. Dialog height must use the dynamic viewport and account for device safe areas.
- Post Custom search rules and creator Advanced rules must not require horizontal page or editor scrolling. Controls must stack into readable mobile cards while preserving every desktop field and action.
- Creator/post toolbars must retain a full-width filter row and a stable Sort + primary action + Settings row. Split primary buttons must keep the main button and chevron side by side.
- Floating and anchored menus must remain inside the mobile viewport, use a practical readable width, scroll internally when tall, and open above the trigger when necessary.
- Mobile changes must not alter desktop geometry, Catalogue data, settings schemas, filter semantics, or request behavior.

## v0.11.1 second-pass audit contracts

- An explicit `enabled: false` Published-date group remains disabled even when its saved dates remain populated. Enabling an unconfigured date or Custom-extension group opens its child editor rather than committing an empty filter.
- Advanced rules have an independent parent group switch. Turning the group off and on preserves every row's own enabled state, query, fields, logic join, outcome, method, and thresholds.
- A text-rule **No match** aggregate is the number of aggregate-eligible posts minus the number matching the text query. It is not the Boolean negation of the aggregate threshold. Partial Catalogues may use only safe lower-bound Amount conditions.
- Creator summary schema 5 persists `totalAttachmentCount`, `totalExternalLinkCount`, and `totalAttachmentLinkCount`. Attachment-mode Percentage uses every real attachment plus scoped external links as its denominator, including attachments outside the five displayed media categories.
- Invalid schema-4 summaries are recomputed locally for both complete and partial scanned Catalogues. Dynamic Custom-extension and text-rule aggregates are fingerprinted, bounded, written locally, and represented in record signatures so filtered/sorted caches cannot retain stale values.
- Creator-filter popovers remain exactly trigger-width at desktop and narrow layouts, remove abandoned same-trigger nodes, clear inherited transforms, stay within the viewport, and may open above the trigger when the lower viewport cannot contain them.
- Creator preset normalization always retains one canonical Default, repairs duplicate/missing IDs and duplicate names deterministically, and rejects blank/duplicate new names without closing the naming dialog or losing state.
- Advanced attachment Type order begins with Images, then Videos, Archives, Project files, and External links. Discard preserves the prior active sort but remembers the latest Type and Method configuration for reopening.

## v0.11.0 Local catalogue contracts

- Visible `/artists` terminology is **Local catalogue**. Internal identifiers, IndexedDB stores, creator summary fields, settings keys, and Catalogue coverage semantics remain unchanged.
- Local sort modes are exactly Popularity, Alphabetical, Catalogue post count, Post publish date, and Advanced attachment amounts. Legacy latest/earliest and media sort values normalize into the new modes. Unknown sort values always follow known values.
- Post publish date is the newest real stored `published` value for a creator. Reversing direction orders those latest-published values oldest first; it does not substitute an earliest-post field.
- Advanced attachment sorting chooses one of Videos, Images, Archives, Project files, or External links, one Method (Amount or Percentage), and an explicit direction. The global creator-card Count method controls all creator media Amount and Percentage semantics.
- In post-count mode, Amount is matching posts and Percentage is matching posts divided by aggregate-eligible posts. In attachment/link mode, Amount is matching files/links and Percentage is matching files/links divided by all counted media attachments/links.
- Creator filters use one compact anchored parent popover. Service is evaluated independently with AND. Date published, media types, Custom extensions, and Advanced rules are filter groups combined by the saved All/Any mode.
- Date published matches when at least one stored creator post satisfies On or after, On or before, or inclusive Between. Unknown dates match only when explicitly included.
- Media and Custom-extension children support Amount or Percentage with ≥, ≤, or inclusive Between. Partial summaries may satisfy only safe lower-bound Amount conditions when the user enables partial lower bounds; unsafe upper bounds, Between, and percentages are indeterminate and excluded. A No-match Amount is the known complement inside aggregate-eligible stored posts, so only its at-least lower bound may safely include a partial Catalogue.
- Advanced rules support ordered IF/AND/OR evaluation, Match/No match, one or more fields, contains/equals/starts-with/ends-with, and Amount/Percentage conditions. Rule aggregate fingerprints remain compatible for legacy single-field rules.
- Creator presets preserve and round-trip service, All/Any, Date published, media rules, Custom extensions, Advanced rules, and partial policy. Legacy filter fields are normalized away without invalidating stored Catalogue data.
- Native directory, Local catalogue, and creator pages share PMF typography and selected-state tokens. Favorite is yellow, Like is pink, and Hidden is dark blue. Native service proxy controls render only the shared PMF dropdown arrow.

## v0.10.12 creator-page visibility contracts

- Early PMF takeover for a known Catalogue must not remove the native post grid from layout before compact geometry is captured. Temporary concealment uses visibility/pointer-event ownership rather than `display: none` or `hidden`.
- An actually unscanned creator must not enter early takeover. Its Pawchive native post cards remain visible and usable.
- After PMF rendering decides between compact and native modes, cleanup removes temporary takeover styles without undoing that final visibility decision.
- If native card geometry is unavailable during a known-Catalogue rebind, compact layout uses a bounded non-zero fallback so toolbar and paginators can never appear above an empty zero-sized card grid.

## v0.10.11 artists navigation and display contracts

- `/artists` has exactly one visible creator grid. Native mode shows Pawchive's connected native grid and hides the PMF Local grid with an authoritative hidden/display contract; Local catalogue mode does the inverse. A disconnected or replaced native grid must be reacquired before rendering or navigation continues.
- The artists observer attaches to a stable native result container rather than only the replaceable grid node. PMF-owned mutations are ignored, native replacements trigger one debounced rebind, and stale asynchronous refreshes cannot overwrite newer DOM references.
- Top and bottom Native paginator mirrors share one pending navigation state. A click updates both mirrors immediately, starts exactly one native action, blocks duplicate clicks while pending, and reconciles from Pawchive's new current-page control after DOM replacement.
- Local catalogue retains the current 1080p dimensions. At desktop widths of at least 2200 CSS pixels, the root may expand to approximately 1980 pixels and reconstructed creator cards use at least a 108-pixel height so 2560×1440 does not render the catalogue as a narrow, undersized island.
- When a creator route already has a retained or loaded Catalogue, PMF may hide the native post grid early and show a contained restoration shell until PMF card/template binding completes. If takeover fails, native visibility is restored. A creator with no known Catalogue remains native.
- Bulk Scan First N remains clamped to 1–1000. Update and Retry/Resume First N have no artificial 1000 maximum. Preview rendering is bounded to 100 rows, followed by a visible `…and N more` summary, and action labels are user-facing rather than internal runner names.

## v0.10.10 consistency and navigation contracts

- External-link post matching, post-card badges, creator-summary counts, creator-card badges, creator filters, and creator sorts must all derive from the same selected external-link scope. `media-download` uses `mediaDownloadLinkCount`; `any` uses `externalLinkCount`.
- Classification-affecting settings include file extensions, project keywords/evidence, known hosts, and the classification logic version. Existing complete Catalogue posts with an old fingerprint are reclassified locally before authoritative creator-summary recomputation.
- Settings schema 5 changes only untouched prior default hosts/keywords. User-customized lists remain unchanged. Keyword parsing accepts comma- or line-separated values and CJK phrases do not depend on Latin word boundaries.
- Native sort-field changes preserve Pawchive's current native direction. Selecting the same sort field again reverses it.
- `/artists` Native and Catalogue modes and creator post pages expose functional top and bottom pagination. Left/Right Arrow paging is ignored inside form controls, editable content, or overlays.
- The missing-attachment inventory is a local IndexedDB cursor count and reports known complete, known missing, unknown, and total stored Catalogue posts without network requests.
- Missing-attachment maintenance has at most five structured workers and two HTML workers. The shared scheduler still spaces request starts and applies global 429 cooldown. After repeated zero-hit samples for a host/service, structured lookup is bypassed for the remainder of the page session.
- Native all-creator API records merge any supplied profile identity/artwork into existing directory records. Creator profile repair remains the explicit operation for optional identity/artwork gaps.
- Creator/all Catalogue clearing cancels pending maintenance, stops and awaits active Catalogue and repair writers, resets the missing-attachment checkpoint, removes retained creator-session data, and refreshes a mounted `/artists` view. Clear-all preserves creator-directory records, creator/post status, presets, and global settings. The creator-only clear action is unavailable outside an active creator page.

## v0.10.9 live-test contracts

- Aggregate-setting changes must not blank creator attachment badges. A structurally compatible prior summary may remain visible while its fingerprint is stale, but a background refresh must recompute and replace it.
- Broken creator avatar or banner URLs are suppressed for the current page session after the first load failure so Local rerenders do not generate repeated 404 requests.
- Missing-attachment checkpoints retain at most 50 recent terminal task IDs and a separate cumulative terminal count.
- Resume reconciliation counts pending IDs whose metadata was already committed before an interrupted checkpoint save.
- Failure-limit pause messages remain visible after the worker finalizes.

## v0.10.8 contracts

### Bounded stored-post traversal

- Missing-attachment maintenance must traverse the `posts` object store through `openCursor` in bounded raw-record chunks of at most 500. The All and First-N scopes must not call `getAll()` or build an array containing the complete library.
- A cursor checkpoint stores scope, selected creator keys when applicable, cursor position, scan-complete state, a bounded current pending set, retryable failures, terminal failures, counters, and affected creators. Cursor advancement and the newly discovered pending IDs are persisted before requests begin, so a crash cannot skip the current chunk.
- Current creator and Current Local catalogue page use creator-key-bounded cursor ranges. First N stops discovery after N unknown posts. All uses a cheap stored-row upper bound only for warning/ETA; it does not perform a separate exact unknown-post planning pass.
- Schema-2 checkpoints migrate as already-planned work with `scanDone=true`; their remaining and failed IDs remain resumable.

### Maintenance execution and reporting

- Structured post detail requests use adaptive concurrency up to three. HTML fallback has a separate single-request slot. Successful records remain pending until their batched IndexedDB write commits.
- Progress exposes current and average completion rates separately. Before discovery finishes, remaining work and ETA are explicitly upper-bound estimates derived from unscanned stored rows; after discovery, they become exact for known pending and failed work.
- The worker pauses after 25 consecutive retryable failures or 250 collected retryable failures. Stop, reload, Resume, and Retry failed preserve the bounded checkpoint.
- Acquiring the shared maintenance slot and all planning/setup work are enclosed by release-on-error handling for both missing-attachment maintenance and creator-profile repair.

### Batched Local updates and authoritative UI

- Creator summaries are recomputed once per affected creator, accumulated, and applied through one `CreatorIndexUI.patchRecords()` call. One maintenance completion causes at most one Local filter-cache invalidation and one Local render for those summary patches.
- `LegacyCreatorIndexUI` does not exist. Creator-card Count method and missing-attachment exclusion controls are integrated directly into the authoritative Settings builders and Creator Settings child implementation; no post-definition wrapper mutates the child dialog.

## v0.10.7 contracts

### Retained Local catalogue

- `/artists` retains Local catalogue data and UI state in memory across creator navigation: records, data revision, cached filtered order, search, filters, sort, page, page size, Queue-panel state, scroll position, and last-ready state.
- A Local return paints retained records before asynchronous storage validation. Background refresh uses a non-blocking `Refreshing local catalogue…` status and must not replace an available grid with a blank document.
- A Local paginator click only changes the page, reuses the cached filtered/sorted array, slices at most 50 records, and reconstructs those cards through one `DocumentFragment`. It does not read all creator records, call the creator API, fetch profile HTML, or invoke full `/artists` refresh.
- The filtered/sorted cache is invalidated only by record revisions, search, creator filters, quick-status filters, sorting, or aggregate-affecting settings.

### Creator metadata repair

- Essential identity weakness is separate from optional enrichment weakness. A valid creator name/ID/service/URL is not an urgent repair candidate merely because avatar, banner, service label, or favorite count is unavailable.
- Normal Local rendering never starts profile repair. Manual repair persists planned, remaining, retryable-failed, completed, stopped, and timestamp state. Resume and Retry failed operate on the union of remaining and retryable failures.
- Avatar and banner extraction use distinct selectors. `og:image` may be a banner fallback only when it differs from the selected avatar; it is never assigned to both fields automatically.
- Repair results patch the retained creator record and visible card without a per-creator full `/artists` reload.

### Settings

- Both Settings contexts directly expose **Count method**, **Posts containing media**, **Total attachments/links from every post**, and **Hide and don’t count posts with missing attachments** in the main Creator cards section.
- Data & performance exposes Update/Stop/Resume/Retry-failed controls for missing-attachment metadata and Repair/Stop/Resume/Retry-failed controls for creator profiles.

### Missing-attachment maintenance

- Supported scopes are Current creator, Current Local catalogue page, First N unknown posts (1–10000), and All unknown posts. v0.10.8 supersedes the prior exact-count requirement with a cheap stored-row upper-bound warning and one cursor-streaming work pass.
- Stored structured metadata is checked before the detail API; HTML is a separately limited fallback. Detail concurrency starts at up to three, decreases after rate limiting, and cautiously recovers after sustained success.
- Post updates are written in batches. A task remains in `remainingIds` until its IndexedDB write commits. Retryable failures remain in both the retryable set and future work; HTTP 404/410 terminal records are reported separately.
- Progress includes scope, completed/total, complete/missing results, retryable and terminal failures, remaining count, current creator, rate, and ETA. Closing Settings does not stop or duplicate a worker.
- Creator summaries are recomputed once per affected creator after the operation rather than after every post.

## v0.10.6 contracts

- `sourcePostCount` is the authoritative stored Catalogue count. `aggregateEligiblePostCount` is the denominator for media, status, Favorite, custom-extension, and custom-rule percentages. `excludedMissingAttachmentPostCount` reports only checked-missing posts excluded from aggregates; unknown posts remain eligible.
- Local Catalogue pagination renders First, Previous, a stable numbered window, Next, and Last. It displays 50 creators per page, clamps after every result change, and does not alter the Native Pawchive paginator.
- Queue session v4 writes pending, active, recent, issue-derived terminal rows, batches, terminal job contributions, concurrency, and normalized `directorySnapshot` values in one pass. Completed success history is user-cleared or idle-batch-cleared, never timer-expired.
- Creator snapshots are merged without replacing strong names, URLs, images, service labels, or finite favorite counts with weak data. Repair uses local/native evidence, the creator API, and profile HTML in that order.
- Missing-attachment maintenance prefers stored and detail-API structured fields, falls back to post HTML, and persists resumable progress. Closing Settings does not stop maintenance.
- Catalogue-only migration marker: `pmf-catalogue-only-migration-v1`
- Card-scale migration marker: `pmf-card-scale-v083-migrated`
- Creator filter state: `pmf-creator-filter-state-v1`
- Creator presets: `pmf-creator-presets-v1`
- Creator quick filters: `pmf-creator-status-filters-v1`
- Creator directory mode: `pmf-creator-directory-mode-v1` (`native` or `catalogue`, default `native`)
- Creator queue restoration: `pmf-creator-queue-session-v1`, payload version 3, in `sessionStorage`

## v0.10.5 corrective behavior

- Missing attachment metadata is three-state: unknown, checked-complete, or checked-missing. Only checked-missing posts are excluded when the preference is enabled.
- `storedPostCount` and summary `sourcePostCount` remain all stored Catalogue posts. `aggregateEligiblePostCount` and `excludedMissingAttachmentPostCount` describe the separately filtered aggregate set.
- Summary fingerprints include the exclusion preference and metadata parser version, so changing either invalidates old aggregate summaries without changing coverage.

## v0.10.4 corrective behavior

Native directory owns neither Pawchive's data nor card rendering. Its PMF controls are proxy buttons and anchored menus that activate Pawchive's real Service, Sort, direction, and paginator controls. A sort choice toggles direction when reselected and otherwise uses the native default direction for that field. Mirrored paginator items are deduplicated by first/previous/page/next/last role and activate the exact surviving native element.

The mode selector is a two-segment control measured from Pawchive's search field. Native directory exposes **Scan**; Catalogue exposes **Update**. The split chevron exposes only **Retry/resume incomplete**. Bulk scope is either the currently visible records or the first 1–150 matching creators. Native First matching creators is resolved from `/api/v1/creators` using Pawchive's current service, query, sort, and direction state, then skips ineligible, active, and queued creators until the requested actionable count or result set is exhausted.

Bulk Scan accepts unscanned creators and resumes partial catalogues. Bulk Update accepts complete catalogues only. Retry/resume accepts partial catalogues only. Confirmation freezes the previewed order and enqueues the action displayed for each row.

Queue batches keep immutable totals and a terminal job-id ledger. Completed, failed, stopped/interrupted, and removed counts are recorded idempotently before recent entries can expire. Session restoration migrates older payloads and retains terminal accounting, batch order, waiting work, and interrupted active work. Overall progress aggregates fixed batches without double-counting live or recent jobs. A Queue with retained history but no active/waiting work is idle, not empty.

## Creator directory modes

Every supported `/artists` route exposes one selector directly below Pawchive's search area.

**Native directory** preserves Pawchive as the data and DOM authority. The native search input and submission remain native; service, sort, direction, result count, paginator offsets, cards, and grid geometry come from the current Pawchive page. PMF proxies activate the exact native controls and paginator elements and are shown before the corresponding native visuals are hidden. PMF decorates native cards in place and may apply only the negative Scanned filter to the current native page. It does not reconstruct cards, synthesize a local page count, or fetch later pages to fill filtered gaps.

**Catalogue** is a local view containing only creators whose metadata has stored posts or creator-page coverage. It searches, filters, sorts, and paginates locally at 50 creators per page. Its quick filters are Favorite, Like, and Hidden. Cards are generated from a sanitized clone of the current native card template when possible, otherwise from a safe fallback. All creator-specific links, labels, artwork, IDs, inline event handlers, data attributes, and framework attributes are replaced or removed. The local grid uses the measured native column count, gaps, card width, and card height.

Mode-specific search listeners are abortable. Native navigation, Turbo replacement, BFCache restoration, mode switching, failed mounts, and shutdown restore the complete native UI and remove PMF card decoration. Queue state is independent from visual mode; bulk scope uses the current native page in Native mode and the current local result set in Catalogue mode.

Creator status badges and settings contain Favorited, Liked, and Hidden only. Legacy stored `scanned` toggles normalize away without changing the Settings schema.

The existing Pawchive creator search field remains the only creator search input. In Native directory it keeps Pawchive’s original submission behavior; in Catalogue mode an abortable listener filters only the local Catalogue set and is removed when leaving that mode. Creator filter, preset, quick-status, sort, and pagination state remain separate from post filtering and post presets.

Favorite is Pawchive-native tri-state evidence. Like and Hidden are local creator state. Unknown Favorite matches neither positive nor negative Favorite filters. Hiding does not alter the current filter or immediately remove a card.

## Creator aggregates and sorting

`CreatorCatalogueSummary` version 3 stores source count, the full classification fingerprint, media post counts, physical attachment/link totals, all known publication timestamps, last update, metadata health, completeness, authoritative Like/Seen/Favorite aggregates, and dynamic custom-extension/custom-rule aggregate caches. Project-file post counts include project evidence even when the physical attachment total is zero. Old complete Catalogues receive bounded idle backfills without changing stored posts or forcing a scan.

Historical v0.10 aggregate percentages used matching posts divided by Catalogue posts. v0.11.0 supersedes that contract: the global Count method chooses post-based or attachment/link-based Amount and Percentage semantics. Creator condition dialogs expose ≥, ≤, and inclusive Between; legacy Exactly values remain readable but are not offered by the redesigned UI. Complete Catalogues are authoritative, and partial results are accepted only as explicit mathematically safe lower bounds.

Creator sorting keeps stable ties and always places unknown values after known values in both directions. The authoritative Local catalogue list is Popularity, Alphabetical, Catalogue post count, Post publish date, and Advanced attachment amounts; older indexed/service/status/media-list modes normalize into supported v0.11.0 values.

## Creator queue and batches

`CatalogueJobManager` remains the only scheduler. Jobs may carry `batchId`, `batchLabel`, `batchSequence`, `requestedAction`, and `creatorKey`. Confirmed batches freeze selected order, deduplicate creators, respect concurrency 1 or 2, and share the existing request spacing, retries, and 429 cooldown.

Each confirmed batch receives an immutable identity and fixed original total. Per-batch waiting, active, complete, failed, stopped, and removed counters are derived without shrinking that total. Waiting descriptors, batches, queue order, and recent outcomes persist for the tab session. A hard reload restores waiting work and records formerly active work as interrupted. Queue controls include Stop, Move to top, Remove, Retry, Dismiss, Clear completed, and Cancel remaining batch. Failed/stopped/interrupted issues remain until dismissed.

## Settings schema 4

Schema 4 preserves the stable Settings key, backs up raw pre-schema-4 data, and adds `creatorCardBadgeCountMode`. The default is `posts`; `attachments` selects physical attachment/link totals. Existing false values, empty arrays, nested attachment-badge toggles, creator status-badge size/visibility, and hidden-card dim settings are preserved. Visual settings preview without a write; Cancel, close, Escape, and outside dismissal restore the opening snapshot; Save performs the final write.

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

Settings remain under `pmf-settings-v5` with `settingsSchemaVersion: 5`. The current migration chain preserves explicit values and keeps the raw pre-schema-4 backup at `pmf-settings-backup-pre-schema-4`; legacy shared attachment size remains migration input only.

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
