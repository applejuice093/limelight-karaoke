// auto.js is a browser module that touches the DOM on load, so its pure helpers
// are sliced out of the source and evaluated here, like tests/lrc.test.mjs does for app.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../auto.js', import.meta.url), 'utf8');
const slice = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const { guessMeta, buildLines } = new Function(
  slice('function guessMeta', 'async function lrclib') +
  slice('function buildLines', 'let worker;') +
  'return {guessMeta,buildLines};')();

test('guessMeta prefers ID3 tags', () => {
  assert.deepEqual(guessMeta({ name: 'x.mp3' }, { title: 'Song', artist: 'Band' }), { title: 'Song', artist: 'Band' });
});

test('guessMeta splits "Artist - Title" filenames and strips video noise', () => {
  assert.deepEqual(
    guessMeta({ name: 'The_Killers - Mr. Brightside (Official Video) [HD].mp3' }, {}),
    { title: 'Mr. Brightside', artist: 'The Killers' });
});

test('guessMeta keeps the whole name as the title when there is no artist', () => {
  assert.deepEqual(guessMeta({ name: 'demo.wav' }, {}), { title: 'demo', artist: undefined });
});

test('buildLines merges sub-word tokens and drops bracketed noise', () => {
  const chunks = [
    { text: ' Hel', timestamp: [0, 0.2] }, { text: 'lo', timestamp: [0.2, 0.4] },
    { text: ' [Music]', timestamp: [0.4, 0.5] }, { text: ' world', timestamp: [0.5, 0.9] },
  ];
  const lines = buildLines(chunks);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'Hello world');
  assert.equal(lines[0].t, 0);
});

test('buildLines starts a new line after a long pause', () => {
  const lines = buildLines([
    { text: ' one', timestamp: [0, 0.5] },
    { text: ' two', timestamp: [3, 3.5] },
  ]);
  assert.deepEqual(lines.map((l) => l.text), ['one', 'two']);
});
