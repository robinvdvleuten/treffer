# treffer

Tiny, bounded RFC 9485 I-Regexp matcher for JavaScript. Zero runtime dependencies, plain JS + JSDoc, hand-written declarations.

## Commands

- `npm test` runs the Node test runner under `node --disallow-code-generation-from-strings`.
- `npm run build` creates minified ESM and CJS bundles in `dist/`.
- `npm run size` checks both bundles against the budgets in `package.json`.
- `npm run fuzz` runs compile, match, and structured fuzz targets for 60 seconds each.
- `npm run fuzz:regression` replays the committed corpus.

## Architecture

The implementation lives in `src/index.js`. `parse()` checks RFC 9485 syntax and produces a small internal tree. `build()` compiles that tree to a Thompson NFA. `run()` simulates active states as sets and computes epsilon closures with visited-state tracking.

`compile(pattern)` returns an object with `match(subject)` and `search(subject)`. The one-shot exports compile and run in one call. Strict RFC behavior is the default; `{ anchors: true }` enables `^` and `$` as a compatibility extension.

## Hard constraints

1. Matcher runtime must stay bounded. Never pass attacker-controlled patterns and subjects to a backtracking matcher.
2. Preserve the limits for pattern scalars, parser depth, repetition expansion, NFA states, subject scalars, and state transitions.
3. Character-class predicate checks count toward the transition budget.
4. Epsilon closure must use visited-state tracking so nullable cycles terminate.
5. Substring search adds the start state during one forward pass. Do not restart matching over every suffix.
6. Pattern and subject iteration uses Unicode scalar values. Lone surrogates are errors.
7. Treffer is a checking RFC 9485 implementation. Reject unsupported JavaScript syntax rather than interpreting it.
8. `^` and `$` are literals in strict mode. Anchor behavior requires `{ anchors: true }`.
9. Keep zero runtime dependencies and CSP safety.
10. Size is a soft goal. Never remove a safety check to save bytes.

## Limits

- 4,096 pattern Unicode scalar values
- 64 nested groups
- 4,096 NFA states
- 1,024 expanded repetitions
- six digits per quantifier bound
- one million subject Unicode scalar values
- one million state transitions per match

Syntax errors throw `SyntaxError`, invalid API values throw `TypeError`, and resource limits throw `RangeError`.

## Conventions

- Tabs in JavaScript.
- Tests use the Node test runner and live in `test/*.test.js`.
- New syntax or safety behavior needs unit tests and structured fuzz coverage.
- Keep the fuzz differential oracle restricted to short patterns and subjects so the native comparison engine cannot become a fuzzing bottleneck.
- `index.d.ts` is hand-written. Type generation stays disabled in `tsdown.config.js`.
- `dist/`, `.fuzz-corpus/`, and generated fuzz artifacts are not committed.
