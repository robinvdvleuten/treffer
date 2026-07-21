import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from '../src/index.js';

const notOk = (value, message) => assert.ok(!value, message);

test('source contains no string-to-code constructs', () => {
	const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
	notOk(/\beval\b|\bFunction\s*\(|new\s+Function/.test(src));
});

test('adversarial regular expressions stay bounded', () => {
	const n = 30_000, text = 'a'.repeat(n) + '!';
	const t0 = Date.now();

	assert.throws(() => compile('(a+)+$', { anchors: true }).search(text), RangeError, 'nested repetition hits work cap');
	assert.ok(compile('(a*)*').match('a'.repeat(n)), 'nullable cycle');
	assert.throws(() => compile('(a|aa)+$', { anchors: true }).search(text), RangeError, 'ambiguous alternation hits work cap');
	assert.throws(() => compile('a{1000000}'), RangeError, 'huge range');
	assert.throws(() => compile('a{1024}a{1024}a{1024}a{1024}'), RangeError, 'state cap');
	assert.throws(() => compile('a'.repeat(5_000_000)), RangeError, 'oversized pattern rejected before allocation');

	assert.ok(Date.now() - t0 < 1500, 'completes within the work budget');
});
