/**
 * Checking RFC 9485 I-Regexp compiler backed by a bounded Thompson NFA.
 */

const PROP = /^(?:L[lmotu]?|M[cen]?|N[dlo]?|P[cdefios]?|Z[lps]?|S[ckmo]?|C[cfno]?)$/;
const MAX = 4096, DEPTH = 64, REPEAT = 1024, STEPS = 1e6;

let bad = () => { throw SyntaxError('Invalid I-Regexp') };
let cap = () => { throw RangeError('I-Regexp resource limit exceeded') };

// Count Unicode scalar values without allocating, rejecting lone surrogates.
let scalarCount = (s, max, invalid) => {
	let count = 0;
	for (let j = 0; j < s.length; j++) {
		const a = s.charCodeAt(j);
		if (a >= 0xd800 && a <= 0xdbff) {
			const b = s.charCodeAt(++j);
			(b >= 0xdc00 && b <= 0xdfff) || invalid();
		} else if (a >= 0xdc00 && a <= 0xdfff) invalid();
		++count <= max || cap();
	}
	return count;
};

let parse = (src, anchors) => {
	src.length <= MAX * 2 || cap();
	scalarCount(src, MAX, bad);
	const s = Array.from(src);
	let i = 0, depth = 0;
	const lit = c => ({ t: 'c', p: x => x === c });
	const prop = (neg, p) => {
		PROP.test(p) || bad();
		const r = new RegExp('^\\' + (neg ? 'P' : 'p') + '{' + p + '}$', 'u');
		return { p: c => r.test(c) };
	};
	const esc = () => {
		const c = s[i++] ?? bad();
		if ((c === 'p' || c === 'P') && s[i] === '{') {
			i++;
			let p = '';
			while (i < s.length && s[i] !== '}') p += s[i++];
			s[i++] === '}' || bad();
			return prop(c === 'P', p);
		}
		'()*+-.?[\\]^nrt{|}'.includes(c) || bad();
		const v = c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c;
		return { p: x => x === v, c: v };
	};
	const cls = () => {
		let neg = s[i] === '^', ps = [], any = false;
		if (neg) i++;
		const one = () => {
			const c = s[i++];
			if (c === '\\') return esc();
			(c != null && c !== '[' && c !== ']' && c !== '-') || bad();
			return { p: x => x === c, c };
		};
		if (s[i] === '-') { ps.push(x => x === '-'); i++; any = true }
		while (i < s.length && s[i] !== ']') {
			if (s[i] === '-' && s[i + 1] === ']') {
				ps.push(x => x === '-'); i++; any = true; continue;
			}
			const a = one();
			if (s[i] === '-' && s[i + 1] !== ']') {
				i++;
				const b = one();
				(a.c != null && b.c != null && a.c.codePointAt() <= b.c.codePointAt()) || bad();
				const lo = a.c.codePointAt(), hi = b.c.codePointAt();
				ps.push(x => { const n = x.codePointAt(); return n >= lo && n <= hi });
			} else ps.push(a.p);
			any = true;
		}
		(any && s[i++] === ']') || bad();
		return { t: 'c', p: (c, spend) => {
			let yes = false;
			for (const p of ps) {
				spend();
				if (p(c)) { yes = true; break }
			}
			return neg !== yes;
		} };
	};
	const number = () => {
		let n = 0, d = 0;
		while (i < s.length && s[i] >= '0' && s[i] <= '9') {
			++d <= 6 || cap();
			n = n * 10 + +s[i++];
			n <= REPEAT || cap();
		}
		d || bad();
		return n;
	};
	let alt;
	const atom = () => {
		const c = s[i++];
		if (c === '(') {
			++depth <= DEPTH || cap();
			const n = alt();
			s[i++] === ')' || bad();
			depth--;
			return n;
		}
		if (c === '[') return cls();
		if (c === '\\') { const e = esc(); return { t: 'c', p: e.p } }
		if (c === '.') return { t: 'c', p: x => x !== '\n' && x !== '\r' };
		if (anchors && (c === '^' || c === '$')) return { t: 'z', a: c === '$' };
		(c != null && !'()[]|*+?{}'.includes(c)) || bad();
		return lit(c);
	};
	const piece = () => {
		const a = atom(), c = s[i];
		let lo, hi;
		if (c === '*' || c === '+' || c === '?') {
			i++;
			lo = c === '+' ? 1 : 0;
			hi = c === '?' ? 1 : -1;
		} else if (c === '{') {
			i++;
			lo = number();
			if (s[i] === ',') {
				i++;
				hi = s[i] === '}' ? -1 : number();
			} else hi = lo;
			s[i++] === '}' || bad();
			(hi < 0 || lo <= hi) || bad();
		} else return a;
		return { t: 'q', a, lo, hi };
	};
	const branch = () => {
		const v = [];
		while (i < s.length && s[i] !== '|' && s[i] !== ')') v.push(piece());
		return v.length ? { t: 'n', v } : { t: 'e' };
	};
	alt = () => {
		const v = [branch()];
		while (s[i] === '|') { i++; v.push(branch()) }
		return v.length > 1 ? { t: 'a', v } : v[0];
	};
	const out = alt();
	i === s.length || bad();
	return out;
};

let build = (pattern, anchors) => {
	const ast = parse(pattern, anchors), st = [];
	const add = (t, x = -1, y = -1, v) => {
		st.length < MAX || cap();
		return st.push([t, x, y, v]) - 1;
	};
	const patch = (o, x) => o.forEach(([j, k]) => { st[j][k] = x });
	const empty = () => { const j = add(0); return { s: j, o: [[j, 1]] } };
	const cat = (a, b) => (patch(a.o, b.s), { s: a.s, o: b.o });
	const visit = n => {
		if (n.t === 'e') return empty();
		if (n.t === 'c') { const j = add(1, -1, -1, n.p); return { s: j, o: [[j, 1]] } }
		if (n.t === 'z') { const j = add(2, -1, -1, n.a); return { s: j, o: [[j, 1]] } }
		if (n.t === 'n') return n.v.reduce((a, x) => cat(a, visit(x)), empty());
		if (n.t === 'a') {
			let a = visit(n.v[0]);
			for (let k = 1; k < n.v.length; k++) {
				const b = visit(n.v[k]), j = add(0, a.s, b.s);
				a = { s: j, o: a.o.concat(b.o) };
			}
			return a;
		}
		let a = empty();
		for (let k = 0; k < n.lo; k++) a = cat(a, visit(n.a));
		if (n.hi < 0) {
			const b = visit(n.a), j = add(0, b.s);
			patch(a.o, j); patch(b.o, j);
			return { s: a.s, o: [[j, 2]] };
		}
		for (let k = n.lo; k < n.hi; k++) {
			const b = visit(n.a), j = add(0, b.s);
			patch(a.o, j);
			a = { s: a.s, o: b.o.concat([[j, 2]]) };
		}
		return a;
	};
	const f = visit(ast), end = add(3);
	patch(f.o, end);
	return { st, start: f.s, end };
};

let run = (nfa, str, full) => {
	typeof str === 'string' || (() => { throw TypeError('Subject must be a string') })();
	scalarCount(str, STEPS, () => { throw TypeError('Subject must contain Unicode scalar values') });
	const { st, start, end } = nfa, len = str.length;
	let cur = new Set(), steps = 0;
	const spend = () => { ++steps <= STEPS || cap() };
	const add = (set, root, pos) => {
		const todo = [root], seen = new Set();
		while (todo.length) {
			const j = todo.pop();
			if (j < 0 || seen.has(j)) continue;
			seen.add(j);
			spend();
			const q = st[j];
			if (q[0] === 0) { todo.push(q[1], q[2]); continue }
			if (q[0] === 2) { (q[3] ? pos === len : pos === 0) && todo.push(q[1]); continue }
			set.add(j);
		}
	};
	if (full) add(cur, start, 0);
	for (let pos = 0; pos <= len;) {
		full || add(cur, start, pos);
		if (cur.has(end) && (!full || pos === len)) return true;
		if (pos === len) break;
		const n = str.codePointAt(pos), c = String.fromCodePoint(n);
		const nextPos = pos + (n > 0xffff ? 2 : 1), next = new Set();
		for (const j of cur) {
			spend();
			const q = st[j];
			if (q[0] === 1 && q[3](c, spend)) add(next, q[1], nextPos);
		}
		cur = next;
		pos = nextPos;
	}
	return false;
};

export let compile = (pattern, options) => {
	typeof pattern === 'string' || (() => { throw TypeError('Pattern must be a string') })();
	if (options != null && typeof options !== 'object') throw TypeError('Options must be an object');
	const anchors = options?.anchors ?? false;
	typeof anchors === 'boolean' || (() => { throw TypeError('anchors must be a boolean') })();
	const nfa = build(pattern, anchors);
	return Object.freeze({
		match: subject => run(nfa, subject, true),
		search: subject => run(nfa, subject, false),
	});
};

export let match = (pattern, subject, options) => compile(pattern, options).match(subject);
export let search = (pattern, subject, options) => compile(pattern, options).search(subject);
