# Changelog

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
