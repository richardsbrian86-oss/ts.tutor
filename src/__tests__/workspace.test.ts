/**
 * Tests for the path confinement rules. These are the tests that matter most:
 * everything else here is a teaching aid, but this is what stops a bad path
 * from reaching your filesystem.
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import { PathOutsideRootError, resolveWithin } from "../workspace.js";

const ROOT = path.resolve("/home/example/project");

describe("resolveWithin", () => {
  it("resolves a plain relative path inside the root", () => {
    expect(resolveWithin(ROOT, "src/app.ts")).toBe(path.join(ROOT, "src", "app.ts"));
  });

  it("allows the root itself", () => {
    expect(resolveWithin(ROOT, ".")).toBe(ROOT);
  });

  it("rejects a path that climbs out with ..", () => {
    expect(() => resolveWithin(ROOT, "../secrets.txt")).toThrow(PathOutsideRootError);
  });

  it("rejects a deeply disguised climb", () => {
    expect(() => resolveWithin(ROOT, "src/../../../etc/passwd")).toThrow(
      PathOutsideRootError,
    );
  });

  it("rejects an absolute path elsewhere", () => {
    expect(() => resolveWithin(ROOT, "/etc/passwd")).toThrow(PathOutsideRootError);
  });

  it("rejects a sibling directory with the root as a name prefix", () => {
    // The bug this guards against: a naive startsWith check would let
    // "/home/example/project-evil" through, because the string does start
    // with "/home/example/project".
    expect(() => resolveWithin(ROOT, "../project-evil/file.ts")).toThrow(
      PathOutsideRootError,
    );
  });
});
