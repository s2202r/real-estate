import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_KEYS, FEATURE_STATUS, features, resolveFeature } from "../features";

/**
 * The admin console reported three modules as "Blocked by environment", which
 * reads as a finished feature held back by a variable. Two of the three had no
 * implementation at all. These keep the claim honest by checking it against the
 * source rather than against a comment.
 */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "__tests__") continue;
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(entry) && !path.endsWith("config/features.ts")) {
      out.push(path);
    }
  }
  return out;
}

const SOURCE = sourceFiles("src")
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

/** Callers that actually consult the flag, ignoring prose that mentions it. */
function callerCount(key: string): number {
  const patterns = [`features.${key}`, `isFeatureEnabled("${key}")`, `resolveFeature("${key}"`];
  return patterns.reduce((total, pattern) => total + SOURCE.split(pattern).length - 1, 0);
}

describe("FEATURE_STATUS", () => {
  it("classifies every flag", () => {
    for (const key of FEATURE_KEYS) {
      expect(FEATURE_STATUS[key], key).toBeDefined();
    }
    expect(Object.keys(FEATURE_STATUS)).toHaveLength(FEATURE_KEYS.length);
  });

  it("marks a flag `live` only when something reads it", () => {
    for (const key of FEATURE_KEYS) {
      if (FEATURE_STATUS[key] === "live") {
        expect(callerCount(key), `${key} is marked live but nothing reads it`).toBeGreaterThan(0);
      }
    }
  });

  it("marks a flag `unbuilt` only while nothing reads it", () => {
    // The one that bites later: a flag gains its first caller and the console
    // keeps telling an operator the feature does not exist.
    for (const key of FEATURE_KEYS) {
      if (FEATURE_STATUS[key] === "unbuilt") {
        expect(
          callerCount(key),
          `${key} is marked unbuilt but ${callerCount(key)} place(s) read it — reclassify it`,
        ).toBe(0);
      }
    }
  });

  it("marks a flag `always-on` only while nothing reads it either", () => {
    for (const key of FEATURE_KEYS) {
      if (FEATURE_STATUS[key] === "always-on") {
        expect(callerCount(key), `${key} is read somewhere; it is not always-on`).toBe(0);
      }
    }
  });
});

describe("the investor module", () => {
  it("is enabled by default", () => {
    // Turned on at the operator's instruction. LEGAL_REVIEW.md L1 stays open;
    // the database constraint on agreements is what actually protects it.
    expect(features.ENABLE_INVESTOR_MODULE).toBe(true);
  });

  it("can still be turned off from the environment", () => {
    // The ceiling has to work in the direction that matters.
    expect(resolveFeature("ENABLE_INVESTOR_MODULE", false)).toBe(false);
  });
});

describe("resolveFeature", () => {
  it("lets the database narrow an enabled flag but never widen a disabled one", () => {
    expect(resolveFeature("ENABLE_AI_SEARCH", true)).toBe(features.ENABLE_AI_SEARCH);
    expect(resolveFeature("ENABLE_AI_SEARCH", false)).toBe(false);
    expect(resolveFeature("ENABLE_DOCUMENT_AI", true)).toBe(false);
  });

  it("treats an absent database row as no opinion", () => {
    expect(resolveFeature("ENABLE_AI_SEARCH", undefined)).toBe(features.ENABLE_AI_SEARCH);
  });
});
