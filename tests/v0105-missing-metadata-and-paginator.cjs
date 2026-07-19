const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api: { Config, Settings, PostMissingStats, CreatorCatalogueSummary, Paginator } } = loadUserscript();
assert.equal(Config.version, '0.10.9');

const parsed = PostMissingStats.parse(' Missing 1 full-res photo, 2 videos and 3 archives. ');
assert.equal(parsed.missingStatsKnown, true);
assert.equal(parsed.hasMissingStats, true);
assert.equal(parsed.missingImageCount, 1);
assert.equal(parsed.missingVideoCount, 2);
assert.equal(parsed.missingArchiveCount, 3);
assert.equal(parsed.missingAttachmentCount, 6);
assert.equal(PostMissingStats.fromHtml('<p class="post__missing-stats">Missing 1 video.</p>').missingVideoCount, 1);
assert.equal(PostMissingStats.fromHtml('<main>checked page</main>').hasMissingStats, false);

const pages = (current, total) => Array.from(Paginator.pageButtons(current, total, 5));
assert.deepEqual(pages(1, 1), [1]);
assert.deepEqual(pages(1, 6), [1, 2, 3, 4, 5]);
assert.deepEqual(pages(5, 6), [2, 3, 4, 5, 6]);
assert.deepEqual(pages(50, 100), [48, 49, 50, 51, 52]);
assert.deepEqual(pages(100, 100), [96, 97, 98, 99, 100]);

const post = (id, missing = false) => ({ id: String(id), creatorKey: 'pawchive.pw|fanbox|1', cacheSources: { catalogue: true }, scanSchemaVersion: Config.schemaVersion, missingStatsKnown: missing, hasMissingStats: missing, videoCount: 1, imageCount: 0, archiveCount: 0, projectFileCount: 0, externalLinkCount: 0, publishedAt: '2026-01-01' });
const posts = Array.from({ length: 500 }, (_, index) => post(index, index < 20));
const offsets = Array.from({ length: 10 }, (_, index) => index * 50);
const state = { storedPostCount: 500, totalExpectedPosts: 500, pageCoverage: Object.fromEntries(offsets.map((offset) => [offset, { complete: true, count: 50 }])), requiredOffsets: offsets, lastUpdateCheckAt: 1 };
const previous = Settings.value.excludePostsWithMissingAttachments;
Settings.value.excludePostsWithMissingAttachments = true;
const summary = CreatorCatalogueSummary.compute(posts, state);
Settings.value.excludePostsWithMissingAttachments = previous;
assert.equal(summary.sourcePostCount, 500);
assert.equal(summary.aggregateEligiblePostCount, 480);
assert.equal(summary.excludedMissingAttachmentPostCount, 20);
assert.equal(summary.media.videos.posts, 480);
assert.equal(summary.completeness, 'complete');

console.log('Pawchive Media Filter v0.10.9 missing metadata and paginator tests passed.');
