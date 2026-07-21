import { readFileSync } from 'node:fs';
import test from 'tape';
import { compile } from '../src/index.js';

test('source contains no string-to-code constructs', t => {
	const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
	t.notOk(/\beval\b|\bFunction\s*\(|new\s+Function/.test(src));
	t.end();
});

test('adversarial regular expressions stay bounded', t => {
	const n = 30_000, text = 'a'.repeat(n) + '!';
	const t0 = Date.now();

	t.throws(() => compile('(a+)+$', { anchors: true }).search(text), RangeError, 'nested repetition hits work cap');
	t.ok(compile('(a*)*').match('a'.repeat(n)), 'nullable cycle');
	t.throws(() => compile('(a|aa)+$', { anchors: true }).search(text), RangeError, 'ambiguous alternation hits work cap');
	t.throws(() => compile('a{1000000}'), RangeError, 'huge range');
	t.throws(() => compile('a{1024}a{1024}a{1024}a{1024}'), RangeError, 'state cap');
	t.throws(() => compile('a'.repeat(5_000_000)), RangeError, 'oversized pattern rejected before allocation');

	t.ok(Date.now() - t0 < 1500, 'completes within the work budget');
	t.end();
});
