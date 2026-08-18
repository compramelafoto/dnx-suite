/**
 * QA del fixture de nota con videos.
 * pnpm --filter @repo/editor exec tsx ../../apps/infospot/lib/editorial/video-embed-qa-fixture.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractEditorialFigures,
  extractEditorialVideos,
  markdownToEditorHtml,
  editorHtmlToMarkdown,
} from "@repo/editor";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "video-embed-qa-fixture.md"),
  "utf8",
);

const html = markdownToEditorHtml(fixture);
const videos = extractEditorialVideos(html);
const figures = extractEditorialFigures(html);

assert.equal(videos.length, 3);
assert.deepEqual(
  videos.map((v) => v.provider),
  ["youtube", "vimeo", "instagram"],
);
assert.equal(videos[0]?.width, "full");
assert.equal(videos[1]?.width, "content");
assert.equal(videos[1]?.alignment, "right");
assert.equal(videos[2]?.variant, "reel");
assert.equal(figures.length, 1);
assert.match(html, /<strong>/);
assert.match(html, /<em>/);
assert.match(html, /<blockquote>/);
assert.doesNotMatch(html, /<iframe/i);

const roundtrip = editorHtmlToMarkdown(html);
assert.equal(extractEditorialVideos(roundtrip).length, 3);
assert.equal(extractEditorialFigures(roundtrip).length, 1);

console.log("video-embed-qa-fixture tests: ok");
