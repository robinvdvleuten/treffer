import assert from 'node:assert/strict';
import test from 'node:test';
import { compile, match, search } from '../src/index.js';

test('invalid I-Regexp syntax throws SyntaxError', () => {
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
		assert.throws(() => compile(pattern), SyntaxError, JSON.stringify(pattern));
	}
});

test('API type errors are explicit', () => {
	assert.throws(() => compile(), TypeError, 'pattern required');
	assert.throws(() => compile(1), TypeError, 'pattern must be a string');
	assert.throws(() => compile('a', true), TypeError, 'options must be an object');
	assert.throws(() => compile('a', { anchors: 1 }), TypeError, 'anchors must be Boolean');
	assert.throws(() => compile('a').match(), TypeError, 'subject required');
	assert.throws(() => match('a', 1), TypeError, 'subject must be a string');
});

test('compile-time resource limits throw RangeError', () => {
	assert.doesNotThrow(() => compile('('.repeat(64) + 'a' + ')'.repeat(64)), 'deepest group');
	assert.throws(() => compile('('.repeat(65) + 'a' + ')'.repeat(65)), RangeError, 'group depth');

	assert.doesNotThrow(() => compile('a{1024}'), 'largest repetition');
	assert.throws(() => compile('a{1025}'), RangeError, 'repetition count');
	assert.throws(() => compile('a{0001024}'), RangeError, 'quantifier digits');

	assert.doesNotThrow(() => compile('a'.repeat(4094)), 'largest NFA');
	assert.throws(() => compile('a'.repeat(4095)), RangeError, 'NFA state count');
	assert.doesNotThrow(() => compile('[' + 'a'.repeat(4094) + ']'), 'largest pattern');
	assert.throws(() => compile('[' + 'a'.repeat(4095) + ']'), RangeError, 'pattern scalar count');
});

test('subject validation and work limits throw', () => {
	const re = compile('a');
	assert.throws(() => re.match('\ud800'), TypeError, 'lone surrogate');
	assert.throws(() => search('', 'a'.repeat(1_000_001)), RangeError, 'subject scalar count');

	const expensive = compile('[' + 'b'.repeat(4093) + ']');
	assert.throws(() => expensive.search('a'.repeat(1000)), RangeError, 'character-class work');
});
