/**
 * Path confinement.
 *
 * The model chooses the paths passed to the file tools. Model output is
 * untrusted input as far as your filesystem is concerned, so every path is
 * forced back inside an allowed root before it reaches `fs`. Without this,
 * a path like "../../.ssh/id_rsa" would resolve to a real file.
 */
import path from "node:path";
import fs from "node:fs/promises";
import { MAX_READ_BYTES, SANDBOX_DIR, STUDY_ROOT } from "./config.js";

/** Thrown when a requested path escapes its root. */
export class PathOutsideRootError extends Error {
  constructor(requested: string, root: string) {
    super(`Refusing to touch "${requested}" - it is outside ${root}`);
    this.name = "PathOutsideRootError";
  }
}

/**
 * Resolves `candidate` against `root` and proves the result is still inside it.
 *
 * The trailing-separator check matters: without it, "/home/user/ts-tutor-evil"
 * would pass a naive `startsWith("/home/user/ts-tutor")` test.
 */
export function resolveWithin(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new PathOutsideRootError(candidate, resolvedRoot);
  }
  return resolved;
}

/** Directory names never worth showing the model. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".cache",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts",
  ".json", ".md", ".css", ".html",
]);

/**
 * Lists source files under `dir`, breadth-limited so a large project does not
 * flood the conversation.
 *
 * READING NOTE: this function calls itself (see the `walk` recursion). Each
 * call handles one directory and delegates subdirectories to a fresh call.
 */
export async function listSourceFiles(
  dir: string,
  maxDepth = 3,
  maxFiles = 200,
): Promise<string[]> {
  const root = resolveWithin(STUDY_ROOT, dir);
  const found: string[] = [];

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > maxDepth || found.length >= maxFiles) return;

    // `withFileTypes` gives entries that already know if they are directories,
    // which saves a `stat` call per entry.
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (found.length >= maxFiles) return;
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;

      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full, depth + 1);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        found.push(path.relative(STUDY_ROOT, full));
      }
    }
  }

  await walk(root, 0);
  return found.sort();
}

/** What `readSourceFile` hands back. */
export interface FileSlice {
  /** Path relative to the study root, for display. */
  relativePath: string;
  /** The requested lines, each prefixed with its line number. */
  numberedText: string;
  /** Total lines in the file, so the model knows if it saw all of it. */
  totalLines: number;
  truncated: boolean;
}

/**
 * Reads a file (or a slice of one) with line numbers attached.
 *
 * Line numbers are what let the tutor say "look at line 42" and have that mean
 * the same thing in your editor.
 */
export async function readSourceFile(
  filePath: string,
  startLine?: number,
  endLine?: number,
): Promise<FileSlice> {
  const absolute = resolveWithin(STUDY_ROOT, filePath);

  const stats = await fs.stat(absolute);
  if (stats.size > MAX_READ_BYTES) {
    throw new Error(
      `${filePath} is ${stats.size} bytes, over the ${MAX_READ_BYTES} byte limit. ` +
        `Read it in slices using startLine and endLine.`,
    );
  }

  const lines = (await fs.readFile(absolute, "utf8")).split("\n");

  // Convert the 1-based, inclusive line numbers a human would use into the
  // 0-based, end-exclusive indices `slice` wants.
  const from = Math.max(1, startLine ?? 1);
  const to = Math.min(lines.length, endLine ?? lines.length);
  const selected = lines.slice(from - 1, to);

  const width = String(to).length;
  const numberedText = selected
    .map((line, i) => `${String(from + i).padStart(width, " ")} | ${line}`)
    .join("\n");

  return {
    relativePath: path.relative(STUDY_ROOT, absolute),
    numberedText,
    totalLines: lines.length,
    truncated: from > 1 || to < lines.length,
  };
}

/** Writes an exercise file. Only ever inside sandbox/. */
export async function writeSandboxFile(name: string, contents: string): Promise<string> {
  const absolute = resolveWithin(SANDBOX_DIR, name);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, contents, "utf8");
  return path.relative(SANDBOX_DIR, absolute);
}
