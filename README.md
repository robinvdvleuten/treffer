# treffer

A tiny, bounded [RFC 9485 I-Regexp](https://www.rfc-editor.org/rfc/rfc9485.html) matcher for JavaScript. **~2KB min+gzip, zero runtime dependencies.**

[![NPM version](https://img.shields.io/npm/v/treffer.svg)](https://www.npmjs.com/package/treffer)
[![Build Status](https://github.com/robinvdvleuten/treffer/actions/workflows/test.yml/badge.svg)](https://github.com/robinvdvleuten/treffer/actions/workflows/test.yml)
[![NPM downloads](https://img.shields.io/npm/dm/treffer.svg)](https://www.npmjs.com/package/treffer)
[![MIT license](https://img.shields.io/github/license/robinvdvleuten/treffer.svg)](https://github.com/robinvdvleuten/treffer/blob/main/LICENSE)

<a href="https://webstronauts.com?utm_source=github&utm_medium=readme&utm_campaign=treffer">
	<picture>
		<img src="https://webstronauts.com/images/sponsored-by.svg" alt="Sponsored by The Webstronauts" width="200" height="65">
	</picture>
</a>

*Treffer* is Dutch for a hit or match. It parses I-Regexp patterns into Thompson NFAs and evaluates all active states together. Matching never backtracks, so patterns such as `(a+)+` have predictable runtime.

```js
import { compile, match, search } from 'treffer';

const isbn = compile('[0-9]{13}');

isbn.match('9780131103627');        // true
isbn.match('ISBN 9780131103627');   // false
isbn.search('ISBN 9780131103627');  // true

match('a|b', 'a');                  // true
search('\\p{Lu}+', 'price: EUR');   // true
```

## API

### `compile(pattern, options?)`

Checks and compiles a pattern once. The returned object has two methods:

- `match(subject)` tests the whole subject.
- `search(subject)` tests whether any substring matches.

```js
const words = compile('[\\p{L}-]+');

words.match('naïve');       // true
words.search('42 naïve');   // true
```

### `match(pattern, subject, options?)`

Compiles the pattern and tests the whole subject.

### `search(pattern, subject, options?)`

Compiles the pattern and tests every possible start position in one forward pass.

Use `compile()` when a pattern will run more than once.

## Syntax

Treffer is a checking RFC 9485 implementation. It supports:

- alternation, concatenation, and groups;
- `.`, character classes, ranges, and negated classes;
- Unicode general categories such as `\p{Lu}` and `\P{N}`;
- `*`, `+`, `?`, and `{m,n}` quantifiers.

JavaScript-only syntax such as `\d`, `\w`, lookarounds, backreferences, and lazy quantifiers is rejected. Use `[0-9]` instead of `\d`.

RFC 9485 treats `^` and `$` as ordinary characters. Pass `{ anchors: true }` to use them as subject anchors:

```js
const line = compile('^item-[0-9]+$', { anchors: true });
line.search('item-42'); // true
line.search('x item-42'); // false
```

## Errors and limits

`compile()` throws `SyntaxError` for invalid I-Regexp syntax. Type mistakes throw `TypeError`. Resource limits throw `RangeError`.

The fixed safety limits are:

- 4,096 Unicode scalar values per pattern;
- 64 nested groups;
- 4,096 NFA states;
- 1,024 repetitions in a range quantifier;
- six digits per quantifier bound;
- one million Unicode scalar values per subject;
- one million state transitions per match.

Runtime is bounded by the subject length times the number of active NFA states. Character-class checks count toward the transition budget. Treffer validates Unicode scalar values and rejects lone surrogates.

## Content Security Policy

Treffer parses patterns into data structures and closures. It generates no JavaScript source and works under a strict Content Security Policy.

## License

MIT © [Robin van der Vleuten](https://robinvdvleuten.nl)
