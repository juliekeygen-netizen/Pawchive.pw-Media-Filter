# Pawchive.pw Media Filter v0.12.5 testing

## v0.12.5 Popular injection and layout matrix

Automated validation:

```text
node --check pawchive-pw-media-filter.user.js
60 executable .cjs tests
```

1. Open `/posts/popular` and explicit Day, Week, and Month URLs. The period panel, Native/Local selector, toolbar, and custom paginator must appear directly above the native post grid.
2. Confirm the console contains neither `reading 'signal'` nor a new mount exception. The root must remain connected instead of being inserted and immediately removed.
3. Inspect the DOM: `#pmf-popular-root` and the top `.pmf-popular-paginator` are siblings immediately before `.card-list__items`; neither may be inside a native period-navigation container.
4. Switch to Local after scanning a disposable period. Card size and aspect-ratio settings must use the measured Popular grid geometry without a creator `App.context`.
5. Navigate Popular → creator → Popular and use Back/Forward. Popular cleanup must not disconnect the creator page's compact-layout observer, and native period hiding must not conceal the PMF root.

## v0.12.2 Popular lifecycle and metadata-runner matrix

Automated validation:

```text
node --check pawchive-pw-media-filter.user.js
57 executable .cjs tests
```

1. Open `/posts/popular` directly and hard-refresh. Exactly one of **Native** or **Local** must be selected immediately; there must be no unselected intermediate PMF mode left on screen.
2. In Native mode, Pawchive's post cards must remain visible. The custom panel must show Previous / Day / Week / Month / Next when Pawchive provides those links. Native duplicate period/paginator controls may be hidden, but no ancestor containing the card grid may be hidden.
3. Confirm Native controls read **All posts**, **Sort: Popular**, and **Scan** for an unscanned period. Filter and sort are gray, struck through, and non-interactive. Queue state is aligned on the left.
4. Confirm both Popular paginators show First, Previous, numbered pages, Next, and Last. Test top and bottom controls on pages 1, 2, a middle page, and the last page.
5. Rapidly click Next/Previous, change Day/Week/Month, use period Previous/Next, and spam browser Back/Forward. The final URL must own the only PMF root; no stale cards, duplicate grids, empty Native grid, or repeated full-page flashes may remain.
6. Queue Scan, navigate to another period, queue another Scan, and use Back/Forward. Each period remains independently queued and the prior job is not replaced.
7. Complete one disposable period scan and switch to Local. Saved cards appear, filters/presets/statuses work, and **Sort: Popular** remains locked. Switching Native ↔ Local never leaves both grids visible or neither grid visible.
8. Open Default detection after upgrading an untouched host list. `iframely.net` appears. Repeat with a deliberately customized host list and confirm PMF does not append it automatically.
9. Close Chrome/Edge completely, then run `powershell -ExecutionPolicy Bypass -File ".\tools\Start-PawchiveMetadataRunner.ps1"`. Confirm a minimized app window starts with the same catalogue/profile, Windows remains awake, and the missing-metadata checkpoint starts or resumes.
10. Stop the checkpoint, close the maintenance app, and leave the watchdog running. Confirm it restarts after a full browser exit. Add new unknown Catalogue posts after a completed pass and confirm watch mode discovers them during its later inventory check.
11. Test `-Mode resume-missing -Once`, `retry-missing -Once`, and `start-missing -Once`. Confirm the userscript accepts only the documented `pmf_maintenance` values.
12. Browser-only limitations must be reported honestly: Node tests cannot prove real Pawchive DOM timing, actual Chrome/Edge profile behavior, HTTP 429 timing, or long-duration Android/desktop background execution.


## v0.12.0 Popular Posts matrix

Run `node tests/v0120-popular-posts.cjs`, `node --check pawchive-pw-media-filter.user.js`, every executable `tests/*.cjs`, and `git diff --check` with CR-at-EOL enabled for the repository's CRLF files. The complete suite contains 56 executable tests.

Live checks:

1. Open `/posts/popular` in Day, Week, and Month views. Confirm the custom period box follows Pawchive's actual previous/next links and only **Native / Local** mode buttons are added.
2. In Native mode, confirm **All posts** and **Sort: Popular** are disabled, native cards remain visible, mirrored pagination works at top and bottom, and no search/status-filter row appears.
3. Queue two or more different periods. Confirm they remain distinct and execute sequentially; reload during a scan and verify Resume restores the interrupted period without replacing the other queued periods.
4. Scan a full period. Confirm all native pages are visited, complete existing posts are reused, new/incomplete posts receive metadata, and the Local snapshot contains the expected rank and displayed favorite count.
5. Open Local mode and test Videos, Images, Archives, Project files, External links, Custom extensions, Custom search rules, Published date, presets, and Favorite/Like/Seen filters. Sorting must stay locked to Popular.
6. Update a previously scanned period after native ranks or favorite counts change. Confirm stale membership is removed and the local result refreshes without duplicating posts.
7. Export a `.pmfbackup`, clear a disposable Popular period, and test Merge and Replace imports. Confirm period observations, normal post metadata, settings, and presets restore on both supported hostnames.
8. Test desktop 1080p/1440p, Android portrait/landscape, Back/Forward, period changes, and BFCache navigation for stale native/local grids or refresh flashes.
9. On a fresh settings profile, confirm `iframely.net` appears in Known media and download hosts; confirm an existing customized list is not reset.

## v0.11.6 import-dialog cleanup matrix

Run `node tests/v0116-import-dialog-actions.cjs`, `node --check pawchive-pw-media-filter.user.js`, every executable `tests/*.cjs`, and `git diff --check`. The complete suite contains 55 executable tests.

1. Open **Export / Import catalogue**, choose **Import backup**, and confirm neither a top Back control nor a footer Back button appears.
2. Confirm **Cancel**, **Import backup**, and the header close button remain usable.

## v0.11.4 backup-integrity audit matrix

Run `node tests/v0114-portability-audit.cjs`, `node --check pawchive-pw-media-filter.user.js`, every executable `tests/*.cjs`, and `git diff --check`. The complete suite contains 53 executable tests.

1. Export while a catalogue scan or status refresh is active. Confirm the backup completes and can be imported without mismatched creator/post/Favorite state.
2. Export on `www.pawchive.pw`, import on `pawchive.pw` (and the reverse), reload, and confirm the same creators, posts, statuses, presets, and Favorite snapshot are visible without duplicate host-prefixed records.
3. Attempt to import a deliberately incomplete backup in Replace mode. Confirm PMF rejects it before any existing catalogue data is removed.
4. Import a valid backup whose empty stores should replace non-empty local stores. Confirm Replace clears those old records; confirm Merge keeps unmatched local records.
5. With IndexedDB unavailable, verify creator-page UI state and Favorite snapshot membership are included in the exported JSON and restored into the memory fallback.

## v0.11.5 large-backup streaming matrix

Run `node tests/v0115-large-streaming-backup.cjs`, `node --check pawchive-pw-media-filter.user.js`, every executable `tests/*.cjs`, and `git diff --check`. The complete suite contains 54 executable tests.

Live checks:

1. Export the same large catalogue that previously displayed `Export failed: Invalid string length`; a `.pmfbackup` download must begin successfully.
2. Confirm the export status reports the expected creator and post totals after the download starts.
3. Reopen Import, select or drag the `.pmfbackup`, and confirm the summary appears without loading the whole file as one text string.
4. Import Settings or Presets only, then test Catalogue Merge on normal data and Replace only after retaining a safe backup.
5. Select an older `.json` backup and confirm backward-compatible import remains available.

## v0.11.3 portability and compact-mobile matrix

Run `node tests/v0113-portability-and-mobile-corrections.cjs`, `node --check pawchive-pw-media-filter.user.js`, every executable `tests/*.cjs`, and `git diff --check`. The complete suite contains 52 executable tests.

Live checks:

1. On a phone, Native directory pagination shows only five controls and still changes pages from both paginator positions.
2. Open Bulk Scan, Update, and Resume with 50+ selected creators; scroll the preview while Cancel and Queue remain visible.
3. Verify Reset all settings appears only inside Data & performance and updates the visible draft values.
4. Export a backup, inspect that a `.json` file downloads, then import it by file picker and by drag-and-drop.
5. Test merge against an existing catalogue and replace against disposable data. Confirm creator cards, posts, statuses, settings, post presets, and creator presets survive the reload.
6. Start or queue a creator scan and verify import refuses to run until the queue is stopped or completed.

## v0.11.2 mobile responsive matrix

Run `node tests/v0112-mobile-responsive-ui.cjs`, `node --check pawchive-pw-media-filter.user.js`, every executable `tests/*.cjs`, and `git diff --check`. The complete v0.11.2 suite contains 51 executable tests. Static source/DOM fixtures do not replace the following live phone-browser checks.

1. At approximately 360, 390, 412, and 760 CSS pixels, open Settings from both a creator page and Local catalogue. In every tab, field labels must sit above controls, ordinary words must not break one letter per line, and selects/textareas must stay inside the modal.
2. Swipe the Settings tab strip from General through Data & performance. Tabs must remain one line tall, scroll horizontally, and center the selected tab. Save & apply, Cancel, and Reset must remain reachable above Android browser controls in portrait and landscape.
3. Open Post Custom search rules with at least three rows. IF/AND/OR, Match/No match, text, Fields, and delete controls must all be visible without horizontal dragging. Add, edit, delete, Discard, and Apply must still work.
4. Open Local catalogue Advanced rules. Verify condition, enabled state, join, outcome, search value, Fields, text operator, Amount/Percentage, threshold(s), and remove action all reflow without horizontal overflow.
5. On a creator page, verify Filter is full width and Sort, Update, and Settings remain usable on the next row. On Local catalogue, verify Update and its chevron remain side by side rather than stacking vertically.
6. Open long sort/service menus near the left, right, top, and bottom edges. Menus must stay inside the viewport, wrap by words, scroll internally when tall, and open above low triggers when required.
7. Exercise Published date, Custom extensions, Advanced attachment sorting, Bulk Scan/Update, Queue, metadata maintenance, and preset dialogs. No dialog may force page-level horizontal scrolling, and primary actions must remain reachable.
8. Recheck 1920×1080 and 2560×1440 desktop layouts to confirm the mobile overrides do not change desktop toolbar, settings, card, paginator, or menu geometry.

## v0.11.1 second-pass audit matrix

Run `node tests/v0111-second-pass-audit.cjs`, the two v0.11.0 suites, `node --check pawchive-pw-media-filter.user.js`, every executable `tests/*.cjs`, and `git diff --check`. The complete suite contains 50 executable tests. Browser behavior still requires authenticated Tampermonkey verification.

1. Configure a Published date range, disable the parent row, close/reopen the popover, and reload. It must remain disabled while retaining its dates. On a fresh profile, checking Date published must open the date child instead of silently enabling an unbounded known-date filter.
2. Create multiple Advanced rules with different row-enabled states. Toggle the parent Advanced rules group off and on; row state and IF/AND/OR configuration must survive. Verify **No match** counts posts that do not match the text query rather than inverting the threshold result.
3. Use attachment-mode Percentage on a creator containing audio/unknown attachments plus external links. The denominator must include every real attachment and scoped link, not only Images/Videos/Archives/Project files. Recheck project keyword-only evidence: it may increment project posts but not attachment count.
4. Open a partial and a complete Local Catalogue after upgrading. Summary badges/filter values should repopulate from local IndexedDB without a list-page rescan. Change a Custom-extension or Advanced text query and confirm newly hydrated aggregates appear without stale cached results or Pawchive requests.
5. Open and close Creator filters repeatedly with the same trigger. There must be one popup and no hidden abandoned node. At 1920×1080, 2560×1440, and a narrow viewport, its width must equal the trigger; near the viewport bottom it must remain on-screen.
6. On a fresh state, checking Custom extensions must open its child editor. Apply a valid extension list, then disable/re-enable it and confirm the list is preserved.
7. In Advanced attachment amounts, the first/default Type is Images. Select Amount, then Discard and reopen: Amount remains selected while the previous active sort remains unchanged. Apply and confirm the trigger reads `Sort: Images · Amount` with the correct direction.
8. Try blank and duplicate creator preset names. The name dialog must stay open with a visible error. Load malformed legacy presets with duplicate IDs/names or a missing active ID and confirm one canonical Default and unique stable entries remain.

## v0.11.0 Local catalogue redesign matrix

Run `node tests/v011-local-catalogue-redesign.cjs`, `node tests/v011-creator-filter-presets-and-migration.cjs`, `node --check pawchive-pw-media-filter.user.js`, every executable `tests/*.cjs`, and `git diff --check`. The v0.11.0 release suite contained 49 executable tests; the v0.11.1 complete suite contains 50. Static fixtures do not replace authenticated Tampermonkey checks.

1. Open `/artists` at 1920×1080 and 2560×1440. Confirm the mode says **Local catalogue**, the search placeholder says **Search Local catalogue creators…**, stored/match/empty text uses the same wording, cards retain the corrected responsive size, and exactly one Native or Local grid is visible.
2. Open the Local sort menu. It must contain only Popularity, Alphabetical, Catalogue post count, Post publish date, and Advanced attachment amounts. Re-select a mode to reverse it. Unknown values must remain after known values in both directions.
3. Select Post publish date and verify newest creator latest-post dates first, then reverse and verify oldest latest-post dates first. Creators without a known published date remain at the end.
4. Open Advanced attachment amounts. Test every Type with Amount and Percentage under both global Count methods, then verify Highest first and Lowest first. In post mode, percentages use matching posts / aggregate-eligible posts. In attachment mode, percentages use selected attachments or links / all counted attachments and links.
5. Open Creator filters. It must be an anchored compact popover rather than the old full-screen/giant modal. Test Service independently, then combine two or more enabled groups with All and Any. Service must remain AND in both cases.
6. Configure Published date using On or after, On or before, and inclusive Between. Verify at least one creator post must satisfy it and that unknown dates appear only when Include unknown is enabled.
7. Configure Videos, Images, Archives, Project files, External links, and Custom extensions. Test ≥, ≤, and Between under Amount and Percentage with both Count methods. Confirm labels/help describe the active units and no Catalogue API scan starts merely because a display filter changes.
8. Create Advanced rules with IF, AND, and OR; Match and No match; multiple Fields; every text operator; Amount and Percentage. Verify the expression preview, field child, invalid-rule validation, and left-to-right result.
9. On a partial creator summary, verify safe ≥ Amount lower bounds can participate only when Include safe partial lower bounds is enabled. Verify ≤, Between, and Percentage do not claim exact results from partial data. A No-match Amount may pass only as an explicitly enabled safe ≥ lower bound.
10. Create, apply, update, rename, delete, and reset creator presets. Confirm Custom extensions, Advanced rules, date, service, All/Any, and partial policy survive round trips and a hard refresh. Existing pre-v0.11 presets must normalize without clearing stored posts.
11. Check creator quick statuses: Favorite yellow, Like pink, Hidden dark blue, and the negative state remains visibly crossed/desaturated. Test mouse and keyboard operation.
12. In Native directory, open Any service and confirm only one downward triangle is visible. Recheck the same shared dropdown styling on Local catalogue and creator pages at both target resolutions.
13. Repeat v0.10.12 creator native-card visibility, creator → Back, Native top/bottom paginator, Local pagination, queue, metadata Stop/Resume, 429 cooldown, missing inventory, and clear-one/clear-all checks. Report these live browser results separately from Node tests.

## v0.10.12 creator native-card visibility matrix

Run `node tests/v01012-creator-native-visibility.cjs`, `node --check pawchive-pw-media-filter.user.js`, and the complete suite; 47 executable tests must pass.

1. Open a genuinely unscanned creator. Pawchive's native post cards must remain visible; PMF must not show a Local-catalogue loading shell or hide the native grid.
2. Open a scanned creator with a retained Catalogue. A short `Loading local catalogue…` shell is acceptable, but the final compact grid must contain visible cards rather than only toolbar and paginators.
3. Hard-refresh the same scanned creator and repeat creator → Back → creator navigation. Compact cards must keep non-zero width/height on every mount.
4. Temporarily disable or clear the creator Catalogue, then reload. Native cards must return immediately and no stale `visibility:hidden`, `display:none`, or `aria-hidden` ownership may remain.
5. Confirm 1080p and 1440p compact card sizing still matches v0.10.11 after the visibility repair.

## v0.10.11 artists navigation and layout matrix

Run `node tests/v01011-artists-navigation-layout.cjs`, `node --check pawchive-pw-media-filter.user.js`, and the complete suite; 46 executable tests must pass. Automated DOM fixtures do not replace the following authenticated browser checks.

1. At 1920×1080, compare Local catalogue against v0.10.10 and confirm its useful width/card size has not been enlarged unnecessarily. At 2560×1440, confirm the Local catalogue expands substantially, cards are visibly larger, text remains readable, no card overlaps its right rail, and the grid does not remain capped as a narrow 1540-pixel island.
2. In Native directory, click page numbers and First/Previous/Next/Last from the top and bottom mirrors. Both mirrors must show the same pending/current page immediately; rapid repeated clicks must produce one native navigation, not two competing generations.
3. During Native page changes, service changes, sorting, search, Back/Forward, and hard refresh, confirm Native mode never displays PMF reconstructed Local cards beneath Pawchive's native cards. Switch repeatedly to Local catalogue and confirm the native grid is hidden there. Exactly one creator grid may be visible.
4. While a Native page is loading, inspect the DOM and Console. The controller must reacquire the newly connected native grid, search field, and paginator; top and bottom mirrors must settle on Pawchive's current page, and no stale mirror/root/grid may remain.
5. Open a creator with a retained scanned Catalogue, return to `/artists`, then repeat creator → Back and creator → another creator. The native creator-post layout should not visibly flash before the PMF filtered/sorted view; a contained “Loading local catalogue…” shell is acceptable. Confirm failures restore Pawchive's native grid instead of leaving a blank page.
6. Open an unscanned creator. Its native post grid must remain available and PMF must not conceal it merely because the userscript is installed.
7. Open Bulk Scan, Update, and Retry/Resume. Scan First N must enforce a 1000 maximum. Update and Retry/Resume must accept values above 1000. A preview with more than 100 selected creators must render 100 rows plus `…and N more`, and rows must say Scan, Resume scan, or Update rather than internal `build`/`resume` names.
8. Recheck multilingual Native alphabetical sorting after the paginator/rebind changes. Japanese, Chinese, numeric, emoji-prefixed, and Latin names must remain Pawchive-authoritative and the selected direction must not change unexpectedly.

## v0.10.10 consistency and navigation matrix

Run `tests/v01010-consistency-navigation-defaults.cjs` and the complete suite; 45 executable tests must pass.

1. In External-link scope, switch between **Media and download links** and **Any external link**. For one scanned creator, compare creator-card External links totals, the creator-page External links filter, post-card badges, creator filters, and sort values. Every surface must use the same scope.
2. Confirm the defaults omit `redgifs.com`; save comma-separated project keywords and verify English, Japanese, Simplified Chinese, and Traditional Chinese project-file phrases match after reload. Customized lists must survive the schema-5 migration.
3. On Native directory, keep the native direction descending, change the sort field to Alphabetical Order, and compare against Pawchive with the userscript disabled. The direction and ordering must remain native-authoritative. Choosing Alphabetical Order again must reverse it.
4. Exercise first/previous/page/next/last at both top and bottom of Native creators, Local Catalogue, creator native posts, and creator filtered posts. Both controls must stay synchronized. Left/Right Arrow must page except while focus is in an input, textarea, select, button, editable node, or modal.
5. Open Data & performance and verify the missing-attachment inventory satisfies `known = no-missing + missing` and `total = known + unknown`. Run First N maintenance and confirm the inventory refreshes after completion.
6. During maintenance, confirm at most five structured workers and two HTML fallbacks are active, request starts remain scheduler-spaced, 429 triggers cooldown/concurrency reduction, and a repeatedly unhelpful structured endpoint is bypassed.
7. Change known hosts or project keywords after a completed scan. Existing records and creator badges must refresh without clearing the Catalogue or refetching all list pages.
8. Start bulk scans from Native all-results selection and verify API-supplied name, favorite count, avatar, and banner survive into Local cards. Run Creator profile repair for remaining weak/optional records.
9. Start a creator scan and a missing-attachment update, then use the relevant clear action. Confirm all writers settle before deletion, the maintenance checkpoint disappears, cleared rows do not reappear, retained creator pages do not restore stale posts, `/artists` refreshes, and the creator-only clear action is absent from `/artists` Settings.

## v0.10.9 live-test regression matrix

1. Enable **Hide and don’t count posts with missing attachments** while creator attachment badges are visible. Existing badges must remain visible while their totals update in the background.
2. On a creator with a missing banner, keep DevTools Network open and change Local catalogue pages repeatedly. The same failed banner URL must not be requested repeatedly after its first failure in the page session.
3. Stop and reload a metadata run immediately after a write batch, then Resume. Already committed posts must be reconciled into complete/missing totals instead of leaving `completed < total` with zero remaining.
4. Simulate or observe many terminal post failures. The checkpoint must retain no more than 50 recent terminal IDs while the displayed terminal total remains cumulative.
5. Confirm a pause caused by either 25 consecutive retryable failures or 250 collected retryable failures keeps its specific explanation after the worker settles.

## v0.10.8 streaming maintenance matrix

1. Run `node tests/v0108-streaming-maintenance.cjs`, `node tests/v0107-local-performance-and-maintenance.cjs`, the complete executable suite, and `node --check pawchive-pw-media-filter.user.js`.
2. With at least 100,000 stored posts, open **All unknown posts**. Confirmation must appear after a quick stored-row count; it must not freeze while constructing an exact unknown-post array. After confirmation, watch memory and IndexedDB: work must advance in bounded cursor chunks and the checkpoint must contain only the current pending chunk plus failures.
3. Stop during a chunk, reload, and Resume. Confirm the pending IDs from the advanced cursor chunk run before the next cursor read, then discovery continues without gaps or duplicate committed writes.
4. Run First N with 1, 100, and 10,000. It must stop discovery at the requested number of unknown posts even when known posts are interspersed. Current creator and Current Local catalogue page must stay within their captured creator-key scope.
5. Confirm progress separately shows a current rate and an average rate. While discovery is incomplete, remaining work and ETA must be described as an upper bound; after discovery, known pending/failure counts must be exact.
6. Force repeated API failures. The worker must reduce concurrency after 429 responses and pause after 25 consecutive retryable failures or 250 collected retryable failures. Resume and Retry failed must retain those IDs without creating an unbounded checkpoint.
7. Force IndexedDB count/cursor setup failure and creator-repair planning failure. Confirm the shared maintenance slot is released and a later Queue or maintenance operation can start normally.
8. Update metadata across many creators while Local catalogue is visible. At completion, creator summaries may recompute once each, but the Local record set must be patched with one cache invalidation and one render rather than one render per creator.
9. Search the source for `LegacyCreatorIndexUI` and `creatorOpenChildBase`; neither may exist. Open the Creator-card child Settings dialog and verify Count method plus the missing-attachment exclusion are present and save correctly without a wrapper-created duplicate.
10. Repeat the authenticated v0.10.7 navigation, paginator, avatar/banner, settings, Stop/Resume, and Network-panel matrix. Automated cursor fixtures do not replace live Pawchive verification.

## v0.10.7 Local performance and maintenance matrix

1. Run `node tests/v0107-local-performance-and-maintenance.cjs`, then the complete executable suite and `node --check pawchive-pw-media-filter.user.js`.
2. Load Local catalogue with at least 100 creators. Click pages 1 → 2 → 3 → 2 → Last while watching DevTools Network. Page changes must be immediate after initial load and must not request `/api/v1/creators`, creator profile HTML, or reread the whole directory.
3. Repeat Local catalogue → creator → Back → Forward → Back at least 20 times. Confirm the cached grid appears immediately, the previous search/filter/sort/page/Queue/scroll state returns, one PMF root exists, and no white page or blocking “Loading creators” view appears.
4. While Local catalogue is visible, start creator-profile repair. Continue paging and confirm navigation remains responsive. Stop it, close/reopen Settings, Resume it, induce one retryable failure, and use Retry failed. A missing banner or favorite count alone must not trigger urgent automatic repair.
5. Inspect repaired Patreon/Fanbox-style cards. Confirm avatar and backdrop remain distinct, known-good artwork is preserved, and a post preview or one `og:image` is not copied into both fields.
6. Open Settings from a creator page and `/artists`. In both, confirm the main Creator cards section visibly contains **Count method**, **Posts containing media**, **Total attachments/links from every post**, and **Hide and don’t count posts with missing attachments**.
7. Open **Update missing-attachment metadata** and test Current creator, Current Local catalogue page, First 100, and All. All must show a stored-row upper-bound warning before starting. Confirm structured requests precede HTML fallback, HTML concurrency is separately bounded, and current/average rate, ETA, and current creator update live.
8. Stop maintenance with buffered work, reload, and Resume. Induce an API/write failure and confirm the task remains retryable. Retry failed must clear it only after a successful committed write. Confirm affected creator summaries refresh once per creator and Local paging stays responsive throughout.
9. For a library near 100,000 posts, confirm the UI presents a stored-row upper bound and clearly labels discovery-time remaining/ETA as estimated rather than implying an exact quick plan. Monitor 429 handling: global cooldown and lower detail concurrency must occur without losing the task.
10. Live authenticated Pawchive checks must be reported separately from automated tests; do not treat helper/source assertions as proof of browser performance.

## v0.10.6 corrective matrix

1. Run `node tests/v0106-authoritative-runtime.cjs`, then the complete executable suite.
2. On Local Catalogue pages 1, 2, middle, penultimate, and final, verify `« ‹ [stable window] › »`, 50 cards per page, correct disabled boundaries, and no empty page after filter/search changes.
3. With 500 stored posts and 20 checked-missing exclusions, verify stored coverage remains 500, aggregate eligibility is 480, and 240 eligible matches display/filter/sort as 50%.
4. Complete Queue work, wait at least 15 seconds, reload, retry an issue, clear completed, start a new idle batch, and append to an active batch. Verify success history, issue retention, snapshot fields, and terminal totals.
5. Open both Settings contexts. Start/Stop/Resume missing-attachment maintenance, close/reopen Settings, reload, and confirm structured-data preference, live counts, failure retention, and checkpoint continuation.
6. Repair a numeric creator name with missing imagery. Confirm name/avatar/banner/favorite persistence and card refresh without rescanning Catalogue posts.
7. Repeat Native directory → creator → Back at least 20 times and confirm one mode selector, root, toolbar, paginator, Queue panel, overlay owner, and listener/observer set.

## v0.10.5 corrective follow-up matrix

1. In Data & performance, run **Update missing-attachment metadata**, stop it, then resume. Confirm known results are retained and only remaining/old-parser posts are revisited.
2. With the exclusion preference on, confirm Details still reports every stored post while creator attachment badges and filtered media counts omit only checked-missing posts.
3. Exercise Local catalogue First/Previous/Next/Last with 1, 3, 5, 6, and many pages. The numbered window remains fixed at five where possible.
4. Confirm successful queue rows persist until Clear completed; failed/stopped rows remain after clearing successes.

## v0.10.4 artists lifecycle, bulk metadata, and Queue matrix

Run `tests/native-ui-bulk-queue-v0103.cjs` and the complete suite. Then verify both modes on live `/artists`:

1. Confirm the Native directory/Catalogue selector matches the Pawchive search width, has one shared border, and persists. Confirm Service and Sort are Pawchive-style buttons with anchored menus; the Sort arrow is integrated and reverses when the same sort is chosen again.
2. Exercise first, previous, numbered, next, and last pagination. Confirm exactly one control per semantic role, the correct current page, centered status text, no duplicate page number, and no encoding-corrupted symbols.
3. Confirm Native directory shows Queue at far left and Catalogue shows its expected local match summary. Queue empty/idle/recent/active states must be accurate.
4. Open post-filter and Catalogue-sort popups at desktop and narrow widths. Their left edge and width must match the trigger. On a creator page, confirm Hide has visibly balanced space above and below.
5. Confirm the primary action is Scan in Native directory and Update in Catalogue. The chevron menu must contain only Retry/resume incomplete.
6. Preview Current visible result page and First matching creators at 1, 50, and 150. Confirm Scan includes unscanned and partial creators, Update includes complete creators only, Retry/resume includes partial creators only, and queued/active creators are skipped without consuming the First-N quota.
7. Start two eligible creators with concurrency 2. Confirm two jobs become active, per-batch and overall finished counts remain monotonic and never exceed total, and completion survives the recent-job expiry window, navigation, and reload.
8. With retained completed batches and no work, confirm Queue idle. Keep Details open, switch to Issues, scroll the panel, and allow live updates; the tab, disclosure, and scroll position must remain stable.
9. Exercise Stop, Remove, Cancel remaining batch, Retry, Dismiss, and Clear completed. Confirm each terminal job is counted once and an interrupted restored job is never reported as completed.
10. Search the rendered controls and source for broken glyphs. All close, arrow, status, and paging symbols must render correctly.

## v0.10.2 `/artists` mode matrix

Run the automated suite first. It covers version/mode persistence, native proxy activation, current-page negative Scanned filtering, Catalogue membership, sanitized templates, exact measured columns and height, 50-result pagination, repeated switching, cleanup/restoration, legacy Scanned-setting normalization, Queue/bulk preservation, and retained post-page behavior.

In Tampermonkey, verify Native directory is the first-run default. Search for a creator not stored locally; change Service, Sort, direction, and every paginator control; confirm Pawchive's real cards, count, URL/state, and native column geometry remain authoritative. Toggle the negative Scanned filter and confirm it only hides scanned cards already on the current page without filling from later pages.

Switch to Catalogue and confirm only partial/complete local Catalogues appear, search is local, advanced filters and sorts work, quick filters are Favorite/Like/Hidden only, pages contain at most 50 creators, and the grid has the same measured column count/card height as Native mode. Inspect cloned cards for correct creator links, names, service, popularity, avatar/banner, and no stale IDs or framework/event attributes.

Repeat Native ↔ Catalogue switching, search submission, native pagination, browser Back/Forward, Turbo navigation, BFCache return, Settings changes, Queue operations, and cleanup. Force a Catalogue load failure and disable the userscript; native search, controls, count, paginator, cards, grid, placeholder, and card styling must be fully restored with no duplicate roots or listeners.

## v0.10.1 corrective completion live matrix

1. Upgrade a profile with Settings schema 3. Confirm schema 4 is written once, `pmf-settings-backup-pre-schema-4` preserves the raw prior object, explicit false/empty/nested values survive, and creator badge Count method defaults to Matching posts.
2. Exercise `/artists` search, Back/Forward, refresh, Turbo, BFCache, native grid replacement, and rapid native mutations. Confirm one PMF root, no flicker loop, no PMF-card rediscovery, native search remains, duplicate native selectors/paginators stay hidden, and native UI restores after cleanup or failed mount.
3. Compare the reconstructed grid with native card geometry at desktop and narrow widths. Confirm PMF uses measured native card width/gaps, cards contain only safe stored identity, and no live native card subtree or handler leaks into PMF.
4. Test empty directory, zero matches, loading, and forced IndexedDB failure. Confirm explicit states and no blank page.
5. Test every creator filter/operator, all sort directions, custom extensions, multiple custom Catalogue rules, published-date boundaries, percentages, and partial lower-bound opt-in. Confirm invalid/blank/reversed values are rejected; custom aggregates are computed locally without requests; partial results are allowed only for At least count rules without percentages.
6. Change a post’s Like, Seen, and native Favorite evidence, then return to `/artists`. Confirm version-3 summary/status counts refresh and unknown Favorite stays excluded from both active Favorite modes.
7. Confirm project evidence can increment Project-file posts while physical project attachments remain zero. Toggle creator-card Count method between Matching posts and Attachments / links and verify badge values change accordingly.
8. Exercise creator Favorite replacement, Like/Unlike, and Hide/Unhide across navigation and native rerenders. Confirm one control per action, local actions make no Pawchive request, and visual classes remain safe.
9. Queue multiple manual and bulk batches at concurrency 1 and 2. Test Move to top, Remove, Stop, Cancel remaining, Retry, Dismiss, Clear completed, reload, and navigation. Confirm fixed batch totals, preserved order/session state, per-batch progress, and interrupted active jobs in Issues.
10. Recheck centered Field Availability rows and the full v0.10.0 regression matrix below.

## v0.10.0 unified creator index live matrix

Test at approximately 1920×1080 and 2560×1440.

1. Open `/artists` with many creators and a short result set. Exercise native search, pagination, Back/Forward, refresh, Turbo, and BFCache. Confirm one PMF toolbar/grid/paginator, no blank page, stable card geometry, and native restoration if mounting is interrupted.
2. In Catalogue mode, cycle Favorite, Like, and Hidden through Off → Match → No match. Confirm unknown Favorite matches neither active Favorite state. Separately verify Native directory's negative Catalogue-availability filter only hides current-page cards that have local Catalogue data.
3. Test creator directory, Catalogue, every media child dialog, posts versus attachments/links, all four operators, 0/50/100/decimal/Between percentages, complete-only behavior, partial lower-bound opt-in, post-status aggregates, combined AND rules, and creator presets.
4. Test every creator sort in both directions. Confirm stable ties, unknown-last behavior, and a stable visible anchor where practical.
5. On creator profiles test Favorite, Like/Unlike, and Hide/Unhide. Confirm action order/alignment, reload persistence, deduplication after navigation, and no Pawchive request for Like/Hide.
6. Test creator status badges Small/Medium/Big, every visibility toggle, attachment/status combinations, and the top/middle/bottom right rail. Confirm no empty reservation, content collision, or geometry movement.
7. Test hidden-card dim Off/Low/Medium/High and Hidden quick-filter Off/Match/No match. Confirm status badges remain readable and disabling removes treatment immediately.
8. Test empty Queue, manual work, Bulk Update, Bulk Scan, Resume incomplete, concurrency 1/2, Stop, Remove, Move to top, Cancel remaining batch, Clear completed, failure/Retry/Dismiss, reload restoration, and navigation while work continues.
9. Open Settings, creator filters, every media child, sort, bulk dialog, Queue, and Issues. `document.documentElement.clientWidth` must remain stable within about 1 px and native/PMF content must remain horizontally stationary.
10. Recheck creator-page Details Field Availability: each centered line contains label, colon, and value; the Main file note is centered.

Automated release command:

```powershell
node --check .\pawchive-pw-media-filter.user.js

Get-ChildItem .\tests\*.cjs |
  Where-Object Name -ne 'test-helper.cjs' |
  Sort-Object Name |
  ForEach-Object {
    node $_.FullName
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
  }
```

## v0.8.4 native stylesheet and settings live matrix (A–O)

### A. Healthy stylesheet baseline
Open creator, post, and `/artists` routes with native styling intact. Confirm PMF captures native stylesheet descriptors only after links and native structure exist. At document start, zero links must remain bootstrapping rather than being treated as loss.

### B. Confirmed stylesheet loss and restoration
After a healthy baseline, remove all native stylesheet links while the page is visible. Confirm PMF waits for stabilization, cancels takeover, restores native content visibility, recreates links from descriptors once with `data-pmf-restored-native-stylesheet`, and does not duplicate existing URLs.

### C. Failed recovery reload guard
Force restored links to fail. Confirm one controlled hard reload is attempted for the normalized URL, the session guard stores timestamp/attempt count, and a second failure in the short guard window is logged and suppressed.

### D. Document/head replacement
Replace `head` or perform Pawchive/Turbo navigation that produces a new document generation. Confirm the narrow head observer rebinds, generation increments, stale descriptors/nodes are not cloned, and PMF does not claim the replacement was caused by PMF without evidence.

### E. PMF-owned mutation filtering
Insert and remove PMF roots, badges, post actions, search UI, and compact cards under native parents. Confirm those mutations do not start route reconciliation, while a genuine native card/grid/head replacement does.

### F. Coalesced lifecycle
Generate click, popstate, Turbo, mutation, and polling signals for one route. Confirm desired/mounting/mounted keys remain coherent, same-key requests reuse one mount promise, and broken stylesheet state blocks normal mounting.

### G. BFCache and Turbo
Use Back/Forward, persisted `pageshow`, `turbo:before-cache`, `turbo:before-render`, `turbo:render`, and `turbo:load`. Confirm stylesheet health is validated before healthy reuse, soft snapshots retain valid UI, and no duplicate roots or post actions appear.

### H. Early shell safety
Delay or break mounting. Confirm the bounded shell timeout restores Pawchive’s native grid, count/menu nodes, paginator, and search placement; the page must never remain blank.

### I. Paginator vertical rhythm
Confirm Favorite/Like/Seen quick filters, `Showing …`, and page buttons are centered. Measure quick-filter row → summary and summary → buttons: both must use `--pmf-status-summary-gap` and be equal.

### J. Settings tabs and arrows
Confirm the exact tabs General, Default detection, Scanning, and Data & performance, each with a restrained orange title. Every Settings select must show one right-aligned `▾`; disabled selects keep the arrow but mute it.

### K. Settings child structure
Confirm Post-card attachment badges, Creator-card attachment badges, and Post status badges each show Appearance first and their visible-type/status section second. Confirm Seen post-card appearance contains Appearance → Dim strength. Size controls must not remain on General.

### L. Settings migration and preservation
Upgrade a v0.8.3 profile with custom filters, false toggles, empty arrays, nested badge types, and a shared attachment size. Confirm `pmf-settings-v5`, post schema 2, and IndexedDB 4 remain; the raw backup is written; both split sizes inherit the shared value unless already split; reload is idempotent; all unrelated media-filter settings survive.

### M. Scoped badge and status geometry
Change post attachment, creator attachment, and post status sizes independently. Confirm each updates live without affecting the other scopes. Cycle quick filters and card statuses through inactive/active/no-match and confirm icon boxes and corner X geometry never move.

### N. Native post actions
On several post layouts confirm the final order is Flag, Favorite/Unfavorite, Like/Unlike, Seen/Unsee. Verify sanitized native templating, native action gap/line height, separate icon width/height, optical heart/eye scaling, and one clamped whole-action vertical correction. Toggling must not change geometry.

### O. Regression, data integrity, and shutdown
Repeat Catalogue Scan/Resume/Update, optional retries, Favorite sync, filtering, sorting, presets, queue concurrency, `/artists` badges, Back/Forward, and clearing. Confirm no media downloads, no data loss, and final shutdown disconnects stylesheet/document observers, coordinators, jobs, controls, retained sessions, and owned roots once.

## v0.8.3 corrective release live matrix (A–O)

### A. Upgrade preservation
Install v0.8.3 over v0.8.2 with complete/partial Catalogues and statuses. Confirm schema 2, IndexedDB 4, posts, coverage, presets, snapshots, queue state, Like, and Seen remain.

### B. Card-scale migration
On first load confirm every old/missing size maps to new Big and `pmf-card-scale-v083-migrated` is written. Choose Small, reload, and confirm it persists. Confirm Big > Medium > Small.

### C. Aspect and row capacity
At 16:9, 4:3, and 1:1 confirm selected height stays fixed while whole card width changes. Confirm 3/4/5/6/7/8/9/10 columns yield 48/48/50/48/49/48/45/50 posts.

### D. Quick-filter polish
Cycle Favorite/Like/Seen through Off, Match, and No match. Confirm the No-match X is a small white corner mark, the underlying colored icon stays visible, and toolbar/quick/Showing/paginator gaps remain distinct.

### E. Native post actions
On several post layouts confirm Flag, Favorite, Like, Seen are direct siblings; typography, icon box, baseline, and spacing match; no wrapper margin inflates the gap; and toggles remain aligned.

### F. Persistent status propagation
Open creator A, creator B, then a post from A. Toggle Like/Seen/Favorite and return with Back. Confirm A updates immediately without a creator-status IndexedDB reread and B remains correct.

### G. Five-session LRU
Visit six creators. Confirm no retained session owns native DOM, the active session is never evicted, and the least-recent inactive creator is evicted after UI state persistence.

### H. Navigation coalescing
Generate click, popstate, Turbo, mutation, and polling signals for one route. Confirm one mount is in flight, same-key calls reuse it, no abort/remount loop occurs, and at most one fallback health check runs.

### I. BFCache and Turbo
Use Back/Forward and Turbo cache restores. Confirm healthy roots, grids, post controls, session data, and the persistent host are reused; route observers resume; and no duplicates appear.

### J. Settings structure
Confirm the exact tabs General, Default detection, Scanning, and Data & performance. Confirm no Display mode or Remember section appears and scanned creators are compact-only.

### K. Settings draft
Change size, ratio, badge size, and Seen dim strength. Confirm live preview. Cancel, X, Escape, and outside click must restore the opening snapshot; Save writes all fields once.

### L. Seen child view
Open Dim seen post cards. Confirm strength exists only in its child view, Back returns to General, disabling the parent disables strength, and Reset produces disabled + Medium.

### M. Detection/scanning/data
Verify file types, project evidence, keywords, external-link scope/hosts, scan confirmation, sync-on-Scan/Update, concurrent scans, optional-detail concurrency/retry, manual Favorite sync/stop, and clear-one/all Catalogue actions.

### N. Queue and data integrity
Repeat Catalogue Scan/Resume/Update, optional retry, Favorite sync, Stop, 429 cooldown, and clearing. Confirm the existing scheduler/concurrency rules and data ownership are unchanged.

### O. Shutdown
Trigger final userscript shutdown. Confirm persistent status coordination, session cache, jobs, observers, post controls, layout ownership, and global host are cleaned exactly once.

## v0.8.2 navigation, layout, and UI polish live matrix

1. Install v0.8.2 over v0.8.1 without clearing Tampermonkey storage or IndexedDB. Confirm saved `native` aspect-ratio settings migrate to `1:1 (original)`, no `native` option remains, and saved Catalogues/statuses still load.
2. On a creator with many matching posts, test 16:9, 4:3, and 1:1. Confirm Big/Medium/Small change fixed height; ratio changes card width; page size is complete rows at or below 50; Back from a post returns to the page containing the opened post after resize or ratio changes.
3. Confirm the filtered paginator and quick status filter row are compact: Favorite/Like/Seen icons sit centered above `Showing ...`, page buttons fit between them, and the no-match X overlay is visible and centered.
4. Open Settings > Full catalogue scan. Confirm the order is: confirm scans, post attachment badges, post status badges, Dim seen post cards, Seen dim strength, creator attachment badges, native Favorite sync.
5. Enable Dim seen post cards at Low/Medium/High. Confirm only Seen cards are dimmed, status badges remain readable, and disabling the setting removes the treatment.
6. Open several post pages with native Flag/Favorite actions. Confirm PMF inserts Like and Seen directly after Favorite, with matching icon/text size and spacing, and the controls remain aligned after toggling active states.
7. Navigate creator -> post -> creator, use browser Back/Forward, refresh, and BFCache returns. Confirm no duplicate PMF roots, no duplicate post controls, no blank compact grid, and queued/background work resumes.
8. Confirm Scan/Resume/Update queue behavior, `/artists` badges, post-card attachment badges, Favorite sync, and Catalogue deletion behavior still match the v0.8.1 matrix below.

## v0.8.1 corrective release live matrix (A–P)

### A. Upgrade preservation
Upgrade v0.8.0 with complete and partial Catalogues. Confirm posts, coverage, presets, Like, Seen, and Catalogue summaries remain.

### B. Legacy status migration
Inspect migrated records: direct post-page Favorite false remains false; sync/unknown false becomes unknown; positive sync evidence remains positive; Like/Seen timestamps remain.

### C. Post-header targeting
On several post layouts, confirm exactly Flag, Favorite, Like, Seen in the actual header action group and no controls in navigation, sidebar, comments, hidden, or detached DOM.

### D. Like and Seen controls
Verify outline/filled heart and eye states, pink/blue colors, Like/Unlike and Seen/Unsee labels, persistence, independent clicks, disabled-during-write behavior, and concise recovery after a forced IndexedDB failure.

### E. Direct Favorite observation
Verify clear Favorite and Unfavorite labels/ARIA become direct false/true, indeterminate markup stays unknown, a click alone is not inferred, and the bounded observer disconnects.

### F. Resolver precedence
Exercise newer direct versus snapshot, newer partial-positive versus snapshot, snapshot membership and absence, direct fallback, partial fallback, and unknown fallback on both Pawchive hosts.

### G. Global quick filters
Confirm star/heart/eye order and Off → Match → No match cycles. Reload and change creators to confirm global persistence and no preset/per-creator coupling.

### H. Filter semantics
Confirm all active status filters AND with media, rules, date, and search. Unknown Favorite matches neither Match nor No match; missing Like/Seen records behave false.

### I. Status badges
Verify only resolved true statuses render, in star/heart/eye order, directly below short and wrapped title overlays without moving card geometry.

### J. Badge settings
Test Small/Medium/Big, parent enable, Favorited/Liked/Seen child toggles, live preview, Save, Cancel, Escape, outside click, and Reset.

### K. Complete Favorite synchronization
From a signed-in page, run **Synchronize native favorites now**. Verify Account-nav discovery, real paginator traversal, progress, atomic activation, timestamp/count, one UI refresh, and no media download.

### L. Partial, failed, and stopped synchronization
Force HTTP failure, Stop, repeated URL, repeated signature, login redirect, permission page, and unrelated HTML. Verify the active snapshot remains, positives may be added, and missing posts never become false.

### M. Automatic freshness
With synchronization enabled, complete Scan, Resume, and Update. Verify a fresh snapshot skips work, a stale snapshot requests one sync, and sync failure leaves the Catalogue operation successful.

### N. Queue and scheduler
At whole-operation concurrency 1, verify Catalogue and Favorite sync never overlap. At 2, verify bounded overlap is allowed. Confirm request spacing, retry reacquisition, global 429 cooldown, in-flight dedupe, and no second scheduler.

### O. Catalogue clearing
Clear one and all Catalogues. Confirm post statuses, active Favorite snapshots, global status filters, presets, and settings remain.

### P. Navigation and regression
Exercise creator/post navigation, Back/Forward, refresh, and BFCache. Confirm the existing dynamic layout, retained-page paginator, queue behavior, `/artists` badges, and attachment badges are unchanged.

## Automated verification

From the project directory:

```powershell
node --check .\pawchive-pw-media-filter.user.js

Get-ChildItem .\tests\*.cjs |
  Where-Object Name -ne 'test-helper.cjs' |
  Sort-Object Name |
  ForEach-Object {
    node $_.FullName
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
  }
```

This runs the dependency-free retained regression suite plus `native-stylesheet-settings-v084.cjs`, covering the v0.8.4 settings migration, split size scopes, stylesheet-health ownership, mutation filtering, Settings structure, paginator rhythm, native post-action metrics, and all retained v0.8.3 layout/lifecycle contracts.

Node/static tests do **not** prove browser history behavior, real Pawchive DOM replacement timing, IndexedDB migration in an existing browser profile, or visual layout. Record the browser, Tampermonkey version, Pawchive creator URLs, date, and results for the following live matrix.

## A. Existing Catalogue migration

1. Install v0.8.1 over v0.8.0 without clearing IndexedDB.
2. Open a creator with a complete Catalogue.
3. Confirm:
   - Update appears.
   - All stored posts remain.
   - Filters and search work.
   - Details still reports complete coverage.
   - `/artists` aggregate badges remain.
   - No rescan is required.
4. Open a partially scanned creator and confirm Resume scan appears with prior page coverage intact.
5. Reload each page and confirm the migration is idempotent.

## A2. v0.8.1 status-store upgrade

1. Upgrade with at least one complete and one partial Catalogue.
2. Confirm IndexedDB opens at version 4 with `postStatuses`, `favoriteSnapshotEntries`, and `favoriteSyncMeta`.
3. Confirm schema-2 posts, creator metadata, UI states, coverage, queue settings, and summaries are unchanged.
4. Toggle Like and Seen on several posts, reload, and confirm the state persists.
5. Confirm merely opening another post does not mark it Seen.

## A3. Post-page controls and native Favorite

1. Open a Pawchive post with native Flag and Favorite controls.
2. Confirm PMF inserts Like and Seen beside Favorite using the same visual scale.
3. Confirm inactive heart/eye icons are outlines and active icons are filled.
4. Toggle Like and Seen independently and confirm no Pawchive network request is made.
5. Toggle the native Favorite action and confirm the local star badge/filter state follows Favorite and Unfavorite.
6. Use Back, Forward, refresh, and a BFCache return; confirm one PMF control pair remains and status is correct.
7. Navigate rapidly between two posts and a creator; confirm stale controls never mount over the current route.

## A4. Native Favorites synchronization

1. Sign in to Pawchive and note the native Favorites total.
2. Open Settings > Data & performance and choose **Synchronize native favorites now**.
3. Confirm all native Favorites pages are traversed and the reported total matches.
4. Confirm Like and Seen values are unchanged.
5. Remove one native Favorite, complete a verified sync, and confirm the complete snapshot resolves it false.
6. Stop a later sync, force a failed page, and simulate repeated pagination. Confirm the prior active snapshot remains and missing entries are never cleared.
6. While a Catalogue scan runs, synchronize and verify both use shared request-start spacing and a shared HTTP 429 cooldown.
7. Confirm queue progress for unrelated creators does not rerender the open grid.

## A5. Sliding paginator and dynamic cards

1. Use at least 16 filtered pages.
2. Verify pages 1–3 show `1 2 3 4 5`; page 4 shows `2 3 4 5 6`; pages 14–16 show `12 13 14 15 16`.
3. Confirm no ellipses and no permanently pinned numerical first/last pages.
4. Confirm First, Previous, Next, and Last remain present but disabled at boundaries.
5. Narrow the PMF container below 430 px and confirm a centered three-number window.
6. Test Original, 16:9, 4:3, and 1:1. Confirm the whole card window changes width while the selected row height remains stable; the change must not be only an image crop.
7. Test Big, Medium, and Small. Confirm they select distinct fixed heights and dynamically recalculate columns and filtered page totals.
8. Open a post from a later filtered page, go Back, then resize or change ratio. Confirm the returned page still contains the opened post.
9. Confirm Favorite/Like/Seen controls appear in their own centered row above `Showing …`, and each cycles Off → Match → No match.

## B. Main scan

Use an unscanned creator.

1. Confirm the native page remains visible and the button says Scan.
2. Click Scan.
3. Confirm no dialog opens.
4. Confirm every creator-list page is scanned.
5. Confirm the button becomes Stop scan while active.
6. Finish and confirm it becomes Update.
7. Confirm media files were not downloaded.

## C. Stop and resume

1. Start a large scan.
2. Stop it.
3. Confirm the button becomes Resume scan.
4. Open Details and record committed offsets.
5. Resume.
6. Confirm committed pages are preserved and only missing/failed pages are requested.
7. Stop and resume once more.
8. Finish and confirm Update.

## D. Sort control

With a complete Catalogue:

1. Confirm the default is `Sort: Publish date ▼` and results are newest-first.
2. Open the menu and select Publish date again.
3. Confirm `Sort: Publish date ▲` and oldest-first.
4. Select Publish date again and confirm ▼.
5. Select Post title and confirm `Sort: Post title ▼`, A–Z.
6. Include titles such as `Post 2` and `Post 10`; confirm numeric order.
7. Select Post title again and confirm ▲, Z–A.
8. Confirm unknown publication dates remain after valid dates in both date directions.
9. Confirm changing or toggling sort resets filtered results to page 1.
10. Refresh and confirm selection/direction persist for this creator.
11. Confirm another creator keeps its own sort state.
12. Confirm filters, match counts, Catalogue totals, and creator summaries do not change.
13. Confirm the label is left-aligned and the arrow stays at the far right.
14. Test Enter/Space, Arrow Down/Up, Escape, and focus return.

## E. Badge size

Use posts with one through five enabled badge categories.

1. Select Small and confirm it matches v0.6.0.
2. Select Medium and confirm both post and `/artists` badges enlarge.
3. Select Big and confirm it is visibly larger than Medium.
4. For every size confirm:
   - counts and categories are unchanged
   - dates remain readable
   - badges do not overlap
   - one to three badges remain compact
   - four/five badges remain contained in the second-row layout
   - the post footer grows enough
   - thumbnail/card aspect ratios remain correct
   - card width does not change
5. On `/artists`, enable all creator badge types and confirm:
   - creator text is not covered
   - card height does not change
   - reserved width follows the rendered rail
   - resizing the window recalculates reservation
   - replacing the creator list through native pagination keeps correct spacing

## F. Settings preview

1. Begin with Small and open Settings.
2. Change to Medium and confirm immediate preview.
3. Cancel and confirm Small returns.
4. Reopen, choose Medium, Save, and refresh; confirm Medium persists.
5. Change to Big and Cancel; confirm Medium returns.
6. Reset all settings and confirm Small returns while Catalogue scans remain.

## G. Creator dialog names

1. Right-click `Nagoonimation` on Patreon.
2. Confirm the title is `Scan Nagoonimation (Patreon)?`.
3. Confirm it does not contain favorites, favorite count, creator ID, duplicated Patreon, or Full Catalogue terminology.
4. Confirm exactly one description paragraph:
   `This will scan every post for this creator and store the available post metadata locally.`
5. Repeat with Patreon and Pixiv Fanbox creators, including names containing digits.
6. Confirm busy/progress labels use the same clean display name.

## H. Creator-card confirmation preference

With **Confirm initial and resumed scans from creator cards** enabled:

- Initial right-click Scan shows the short dialog.
- Resume shows the short partial-scan dialog.
- Stop uses only a concise preservation message.

With it disabled:

- Initial Scan starts immediately.
- Resume starts immediately.

In both states:

- Update starts immediately with no dialog.
- The card shows `Checking for new posts…`.
- Completion reports `Catalogue already up to date` or the number of new posts.
- Context Menu and Shift+F10 invoke the same action.

## I. Back/Forward empty-grid reproduction

Use a creator with a complete Catalogue. Repeat at least five times:

1. Open `/artists`.
2. Left-click the creator.
3. Confirm posts are visible.
4. Browser Back or mouse-side Back.
5. Confirm `/artists` is visible and creator badges are correct.
6. Browser Forward or mouse-side Forward.
7. Confirm posts appear immediately.

Expected every time:

- no blank grid
- no footer immediately after an empty paginator
- no reload required
- no duplicate toolbar/root/filtered grid
- correct creator and result page
- filters, sort, search, and badge size preserved

Run with Chrome’s Back/Forward buttons and mouse side buttons. Also repeat after switching Compact, Dim, and Hide.

## J. PMF filtered paginator arrows

Use at least 150 matching posts.

1. At page 1 confirm Previous/First are disabled.
2. Next → page 2.
3. Next → page 3.
4. Previous → page 2.
5. Previous → page 1.
6. Last → page 3.
7. First → page 1.
8. Use each numbered page.
9. Rapidly alternate Next/Previous.

Expected:

- correct 50-post slice each time
- correct `Showing X–Y of Z`
- disabled boundaries do nothing
- no blank page or duplicate cards
- match count, filter, sort, and search remain correct
- browser URL does not change
- one page-change event per click

## K. Native Pawchive paginator arrows

Switch to Dim or Hide and use a creator with multiple native pages.

1. Start at offset 0.
2. Click Pawchive Next and confirm the URL changes to offset 50.
3. Confirm the offset-50 native cards appear with filters/badges reapplied.
4. Click Pawchive Previous and confirm offset 0 returns.
5. Repeat rapidly.
6. Use browser Back/Forward between offsets 0 and 50.

Expected:

- native clicks are not blocked
- correct native page cards are used
- the prior page’s connected grid/signature is not accepted as the new page
- no cached compact cards from the wrong native page
- no stale hidden native grid
- no blank grid or reload

## L. Data and settings cleanup

Confirm Settings contains:

- tab: Full catalogue scan
- heading/legend: Full catalogue scan
- `Show attachment badges on post cards`
- creator-card scan confirmation preference
- attachment badge size directly below thumbnail aspect ratio
- only full catalogue scan clearing controls

Confirm Settings does not contain:

- Scan mode section
- Fast or Verify options
- page ranges or Custom range
- reuse previous scans
- disabled range selector
- scan-cache clearing
- return-to-Scan controls

Right- and middle-click the main Scan/Resume/Update button and confirm PMF performs no alternate mode-switch action.

## M. Optional metadata and Update regression

1. Open a complete Catalogue with explicit retryable records.
2. Confirm Details shows Retry incomplete centered in the summary.
3. Run it and confirm coverage/match counts remain valid.
4. Stop a retry and confirm the Catalogue remains usable.
5. Run Update:
   - it starts at offset 0
   - crosses multiple pages if all early pages contain unseen IDs
   - stops at a page with no unseen IDs
   - preserves known posts and page manifests
   - updates the creator summary and `lastUpdateCheckAt`
   - refreshes `/artists` badges

## Debug evidence

Set Tampermonkey storage key `pmf-debug-v1` to true. During navigation and pagination confirm concise logs for:

- `route-transition`
- `creator-dom-bound`
- `compact-render`
- `filtered-page-change`
- `attachment-badge-size`

Confirm logs contain no post content or media URLs.

## Live result record

Do not mark Back/Forward, native arrows, or geometry fixed from Node tests alone.

## v0.7.1 queue and badge acceptance matrix

1. On `/artists`, test 1 through 5 enabled badge categories, including a three-category combination. Confirm no empty slots, no more than two badges per column, and logical column 0 on the right.
2. Use unequal labels/counts in one column and a differently sized neighboring column. Confirm equal width only within each column and no creator-name overlap at Small, Medium, and Big.
3. Save badge category and size changes while cards are mounted. Confirm immediate rendering without metadata requests, backfill, summary invalidation, or a mutation loop.
4. With concurrency 1, queue at least four mixed Scan, Resume, Update, and Retry incomplete operations from both supported pages. Confirm FIFO positions and duplicate rejection.
5. Change 1 to 2 and confirm the second job starts. Change 2 to 1 and confirm both active jobs continue while no replacement starts early.
6. Remove a queued job, stop either of two active jobs, and force one job to fail. Confirm unrelated jobs continue and the next pending job starts.
7. Confirm each creator page shows only that creator's queued or active state.
8. Trigger or simulate HTTP 429 with `Retry-After`. Confirm all workers pause new starts, in-flight work may finish, and later starts remain at least 250 ms apart.
9. Exercise BFCache and ordinary SPA routes. Confirm BFCache descriptors resume once without duplicates and ordinary route cleanup does not stop the queue.

Automated tests additionally cover all enabled badge combinations, per-column equalization, measured reservation, settings events, PMF mutation filtering, unlimited queuing, live concurrency, removal, cancellation, start-time re-evaluation, global spacing, shared cooldown, and aborted waiters.

Record:

- Browser/version:
- Tampermonkey/version:
- OS:
- Date:
- Existing v0.6 Catalogue used:
- Unscanned creator used:
- Multi-page creator used:
- Back/Forward iterations:
- Mouse side-button result:
- PMF paginator result:
- Native paginator result:
- Small/Medium/Big visual result:
- Remaining failures:

## v0.12.3 Popular live-markup and runner regression

- Open `/posts/popular` with no query string and confirm PMF mounts in Native mode while the heading says **Popular Posts For The Past 24 Hours**.
- Open explicit Day, Week, and Month URLs and confirm Native/Local modes mount without requiring `post-card` classes or `data-id` attributes on Pawchive cards.
- Confirm Scan parses all visible entries and subsequent fetched pages from their real `/service/user/id/post/id` links.
- Run `Start-PawchiveMetadataRunner.ps1` under Windows PowerShell with a single matching maintenance process and confirm StrictMode does not throw a missing `.Count` property error.
