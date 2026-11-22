/**
 * Typed surface for check-comments.mjs, so importers under src/ type-check
 * under strict tsc without enableJs. Keep in lockstep with the .mjs exports.
 */

export interface CommentBlock {
  text: string;
  start: number;
  end: number;
}

/** Per-file counts of identical comment lexemes, keyed by sha256 hash. */
export type HashCounts = { [hash: string]: number };

/** Per-path comment inventory, keyed by posix path relative to the repo root. */
export type Inventory = { [path: string]: HashCounts };

export type Baseline = Inventory;

export interface AddedComment {
  path: string;
  hash: string;
  extra: number;
}

export interface CompareResult {
  before: number;
  now: number;
  added: AddedComment[];
}

export declare function collectComments(filePath: string, source: string): CommentBlock[];

export declare function fingerprint(text: string): string;

export declare function countsOf(blocks: CommentBlock[]): HashCounts;

export declare function inventoryAt(root: string, dirs: readonly string[]): Inventory;

export declare function inventoryFiles(root: string, files: readonly string[]): Inventory;

export declare function compareBaseline(baseline: Baseline, actual: Baseline): CompareResult;

export declare function serializeBaseline(actual: Baseline): string;

export declare const SOURCE_DIRS: readonly string[];

export declare const SOURCE_FILES: readonly string[];
