# Changelog

## 0.10.6

- Wired the shared stable paginator directly into the Local Catalogue renderer.
- Corrected aggregate percentage denominators while preserving stored coverage counts.
- Replaced Queue wrappers, timed deletion interception, and v3/v4 rewriting with direct session-v4 persistence and migration.
- Made creator directory snapshots durable across enqueue, start, completion, failure, stop, restoration, and retry.
- Added weak creator-profile repair with bounded requests, cooldown, persistence, and incremental refresh.
- Added structured-first missing-attachment maintenance with persistent Stop/Resume checkpoints and progress in both Settings contexts.
- Removed shadow Settings, paginator, Queue, and bulk-dialog implementations and expanded runtime/source-quality regression coverage.
