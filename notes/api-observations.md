# Pawchive API and evidence boundaries

v0.6.0 review date: 2026-07-16 (Europe/Helsinki).

## Previously observed behavior

Earlier project work observed:

- creator pages use 50-card pagination and expose the expected creator/search/grid DOM;
- a sampled `GET /api/v1/fanbox/user/37736420/posts?o=0` returned HTTP 200;
- that sampled creator response was a top-level array of 50 list posts;
- sampled list records contained useful IDs, service/user, title, timestamps, content, file, attachments, and tags;
- a sampled main file duplicated an attachment path, supporting normalized deduplication.

No new Pawchive network request or Tampermonkey session was performed for v0.6.0.

v0.6.0 adds local `/artists` metadata summaries and invokes the existing creator-list endpoint compatibility layer through a context-isolated runner. It adds no new endpoint or response-shape claims.

No new live Pawchive request or authenticated Favorites session was performed for v0.8.0. Native Favorites synchronization therefore does not hard-code an undocumented JSON API or fallback path. It requires the signed-in Favorites anchor discovered from Pawchive HTML, follows same-origin/same-path pagination links, and extracts only canonical creator-post URLs.

Post-page Favorite mirroring is DOM compatibility behavior based on the native control's Favorite/Unfavorite text or `aria-pressed` state. Like and Seen are local IndexedDB fields and are never sent to Pawchive.

## Compatibility policy, not universal API claims

Creator-list fields may differ by service, endpoint fallback, creator, or server version. The script therefore accepts multiple response wrappers and normalizes absent optional fields safely.

An absent optional field is not evidence that an individual post is broken. In particular:

- omitted tags do not prove missing post metadata;
- omitted content does not prove truncation;
- omitted attachments do not prove missing files;
- omitted file does not prove a malformed main file.

The implemented policy retries individual details only when the payload contains positive evidence such as an explicit partial marker, substring-only content, invalid structure, or a confirmed count mismatch.

For compatibility, v0.5.1 treats an empty main-file placeholder as “no separate main file.” This includes nullish/blank values and objects with no meaningful recognized name/path/url data. Empty attachment placeholders are ignored, and supported scalar/object tag forms use the same semantics in classification and availability.

This is defensive compatibility behavior inferred from the reported stored Catalogue symptoms and supplied screenshots. It is not a claim that the current live API was observed returning `file: {}` or any other specific placeholder shape during this implementation.

Field availability is an observation about the creator-list responses actually stored for that Catalogue. It is not a claim that every Pawchive service always provides or omits that field.

## Creator-list and detail compatibility

The canonical creator-list candidate requests:

```text
id,user,service,title,shared_file,added,published,edited,file,attachments,tags,content
```

A no-fields candidate and existing compatible endpoint forms remain fallbacks. Recognized list shapes are:

```js
[post]
{ posts: [post] }
{ data: [post] }
{ data: { posts: [post] } }
```

The individual-detail parser supports arrays, `post`, `data`, nested `data.post`, and plain objects. Those shapes are implemented compatibility handling, not new evidence that the live detail endpoint currently returns every shape.

## Pagination evidence

Short or empty pages and a known total can establish the creator-list end. A later-offset HTTP 400 may be interpreted as out-of-range only when prior page evidence exists and all endpoint candidates return 400. Offset 0 and individual-detail HTTP 400 remain errors.

This rule remains a compatibility boundary. Live contextual HTTP 400 behavior was not re-observed for v0.6.0.

## v0.5.1+ local metadata

`cacheSources` is local ownership metadata added by the userscript; it is not an API field. Likewise, `fieldAvailability`, page manifests, retry reasons, `cacheOwnershipVersion`, and `metadataPolicyVersion` are local records derived from stored responses and operations.

No schema-2 classification claim is changed by adding ownership. No media file is downloaded.

## Still unverified live

- migration of the user's actual 724- and 81-post Catalogues;
- exact field availability for that creator/service;
- current live empty-main-file and tag value shapes;
- explicit `fields` support across all Pawchive services;
- which fallback each service selects;
- current individual-detail response shape;
- real IndexedDB source-specific clear transactions and restart persistence;
- large Catalogue page timing without detail bursts;
- Update with real new posts;
- live Details-panel refresh;
- card footer layout with one through five badges;
- measured Big/Medium/Small grid geometry, native comparison, aspect-ratio independence, and resize behavior;
- route races during active operations.

Use `TESTING.md` for the manual verification matrix.

## v0.8.1 Favorite synchronization

The corrective release implements conservative host-scoped snapshots and bounded native post-page observation. No signed-in Pawchive browser session was available during implementation, so live Account-nav discovery, current Favorites markup, paginator end evidence, and real IndexedDB v3→v4 migration remain unverified. Automated tests cover resolver precedence, legacy false migration, global status-filter cycles, removal of startup sync, and the absence of the former mass-false loop.
