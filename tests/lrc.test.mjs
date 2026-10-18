// Run with: node --test tests/
// app.js is a browser IIFE, so the pure helpers are sliced out of the source and evaluated here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const slice = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const { parse, fmt, lrcTime } = new Function(
  slice('const fmt=', 'function setLyrics') + 'return {parse,fmt,lrcTime};')();

test('timed LRC is sorted and metadata tags are dropped', () => {
  const p = parse('[ti:Song]\n[00:05.00]second\n[00:01.50]first');
  assert.equal(p.timed, true);
  assert.deepEqual(p.lines, [{ t: 1.5, text: 'first' }, { t: 5, text: 'second' }]);
});

test('repeated timestamps on one line expand to several entries', () => {
  const p = parse('[00:01.00][00:10.00]chorus');
  assert.deepEqual(p.lines.map((l) => l.t), [1, 10]);
});

test('[offset:] shifts lyrics earlier and clamps at zero', () => {
  const p = parse('[offset:+500]\n[00:00.20]a\n[00:02.00]b');
  assert.deepEqual(p.lines.map((l) => l.t), [0, 1.5]);
});

test('plain text stays untimed for tap-sync', () => {
  const p = parse('one\r\ntwo\n\n');
  assert.equal(p.timed, false);
  assert.deepEqual(p.lines.map((l) => l.text), ['one', 'two']);
});

test('time formatting round-trips the LRC shape', () => {
  assert.equal(fmt(75.9), '1:15');
  assert.equal(fmt(NaN), '0:00');
  assert.equal(lrcTime(65.5), '[01:05.50]');
});
