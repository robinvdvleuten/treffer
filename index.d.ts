export interface TrefferOptions {
	/**
	 * Treat `^` and `$` as subject anchors.
	 *
	 * This is a compatibility extension and is not part of RFC 9485.
	 */
	anchors?: boolean;
}

export interface Treffer {
	/** Test whether the pattern matches the whole subject. */
	readonly match: (subject: string) => boolean;
	/** Test whether the pattern matches any substring of the subject. */
	readonly search: (subject: string) => boolean;
}

/** Compile and validate an RFC 9485 I-Regexp. */
export function compile(pattern: string, options?: TrefferOptions): Treffer;

/** Compile a pattern and test it against the whole subject. */
export function match(pattern: string, subject: string, options?: TrefferOptions): boolean;

/** Compile a pattern and test it against any substring of the subject. */
export function search(pattern: string, subject: string, options?: TrefferOptions): boolean;
