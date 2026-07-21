import test from 'tape';
import { compile, match, search } from '../src/index.js';

test('invalid I-Regexp syntax throws SyntaxError', t => {
	for (const pattern of [
		'(',
		')',
		'[',
		'[]',
		'[^]',
		'[[]',
		'[a[b]',
		'[z-a]',
		'\\d+',
		'(?=a)',
		'(a)\\1',
		'a+?',
		'a{,2}',
		'a{2,1}',
		'a{2',
		'\ud800',
	]) {
		t.throws(() => compile(pattern), SyntaxError, JSON.stringify(pattern));
	}
	t.end();
});

test('API type errors are explicit', t => {
	t.throws(() => compile(), TypeError, 'pattern required');
	t.throws(() => compile(1), TypeError, 'pattern must be a string');
	t.throws(() => compile('a', true), TypeError, 'options must be an object');
	t.throws(() => compile('a', { anchors: 1 }), TypeError, 'anchors must be Boolean');
	t.throws(() => compile('a').match(), TypeError, 'subject required');
	t.throws(() => match('a', 1), TypeError, 'subject must be a string');
	t.end();
});

test('compile-time resource limits throw RangeError', t => {
	t.doesNotThrow(() => compile('('.repeat(64) + 'a' + ')'.repeat(64)), 'deepest group');
	t.throws(() => compile('('.repeat(65) + 'a' + ')'.repeat(65)), RangeError, 'group depth');

	t.doesNotThrow(() => compile('a{1024}'), 'largest repetition');
	t.throws(() => compile('a{1025}'), RangeError, 'repetition count');
	t.throws(() => compile('a{0001024}'), RangeError, 'quantifier digits');

	t.doesNotThrow(() => compile('a'.repeat(4094)), 'largest NFA');
	t.throws(() => compile('a'.repeat(4095)), RangeError, 'NFA state count');
	t.doesNotThrow(() => compile('[' + 'a'.repeat(4094) + ']'), 'largest pattern');
	t.throws(() => compile('[' + 'a'.repeat(4095) + ']'), RangeError, 'pattern scalar count');
	t.end();
});

test('subject validation and work limits throw', t => {
	const re = compile('a');
	t.throws(() => re.match('\ud800'), TypeError, 'lone surrogate');
	t.throws(() => search('', 'a'.repeat(1_000_001)), RangeError, 'subject scalar count');

	const expensive = compile('[' + 'b'.repeat(4093) + ']');
	t.throws(() => expensive.search('a'.repeat(1000)), RangeError, 'character-class work');
	t.end();
});
