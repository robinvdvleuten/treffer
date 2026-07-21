import test from 'tape';
import { compile, match, search } from '../src/index.js';

test('compile once, run many', t => {
	const re = compile('(ab|cd)+');
	t.ok(Object.isFrozen(re), 'compiled matcher is immutable');
	t.ok(re.match('ab'));
	t.ok(re.match('abcd'));
	t.ok(re.match('cdab'));
	t.notOk(re.match('zab'));
	t.ok(re.search('zabcd!'));
	t.end();
});

test('quantifiers and empty branches', t => {
	for (const [pattern, yes, no] of [
		['a*', ['', 'a', 'aaa'], ['b']],
		['a+', ['a', 'aaa'], ['', 'b']],
		['a?', ['', 'a'], ['aa']],
		['a{2,4}', ['aa', 'aaaa'], ['a', 'aaaaa']],
		['a{2,}', ['aa', 'aaaaa'], ['a']],
		['a|', ['', 'a'], ['aa']],
		['', [''], ['a']],
	]) {
		const re = compile(pattern);
		for (const value of yes) t.ok(re.match(value), pattern + ' matches ' + JSON.stringify(value));
		for (const value of no) t.notOk(re.match(value), pattern + ' rejects ' + JSON.stringify(value));
	}
	t.end();
});

test('character classes', t => {
	t.ok(match('[-a]+', 'a-a'), 'leading hyphen');
	t.ok(match('[a-]+', 'a-a'), 'trailing hyphen');
	t.ok(match('[^a]+', 'bbb'), 'negated class');
	t.notOk(match('[^a]+', 'aba'), 'negated class rejects member');
	t.ok(match('[\\[]+', '[[['), 'escaped opening bracket');
	t.ok(match('[\\]]+', ']]]'), 'escaped closing bracket');
	t.ok(match('[\\\\]+', '\\\\'), 'escaped backslash');
	t.ok(match('[\\n-\\r]+', '\n\f\r'), 'escaped range endpoints');
	t.end();
});

test('Unicode scalar and property semantics', t => {
	t.ok(match('\\p{Lu}+', 'ÄBC'));
	t.notOk(match('\\p{Lu}+', 'Äbc'));
	t.ok(match('\\P{Lu}+', 'abc'));
	t.ok(match('.', '😀'), 'dot consumes one astral scalar');
	t.ok(match('.', '\u2028'), 'dot includes Unicode line separator');
	t.notOk(match('.', '\n'), 'dot excludes newline');
	t.notOk(match('.', '\r'), 'dot excludes carriage return');
	t.ok(match('😀+', '😀😀'));
	t.end();
});

test('match and search differ only in anchoring', t => {
	t.ok(match('[0-9]+', '123'));
	t.notOk(match('[0-9]+', 'x123'));
	t.ok(search('[0-9]+', 'x123'));
	t.notOk(search('[0-9]+', 'abc'));
	t.ok(search('', 'abc'), 'empty pattern is found');
	t.end();
});

test('subject anchors are an explicit extension', t => {
	t.ok(match('^a$', '^a$'), 'strict RFC mode treats anchors as literals');
	t.notOk(match('^a$', 'a'), 'strict mode does not anchor');

	const re = compile('^a+$', { anchors: true });
	t.ok(re.match('aaa'));
	t.ok(re.search('aaa'));
	t.notOk(re.search('xaaa'));
	t.notOk(re.search('aaax'));
	t.end();
});

test('one-shot helpers match compiled behavior', t => {
	const pattern = '(a|bc)+', subject = 'abca';
	const re = compile(pattern);
	t.equal(match(pattern, subject), re.match(subject));
	t.equal(search(pattern, 'x' + subject), re.search('x' + subject));
	t.end();
});
