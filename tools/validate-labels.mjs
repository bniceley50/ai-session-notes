#!/usr/bin/env node

/**
 * validate-labels.mjs — Validate .github/labels.json structure.
 *
 * Usage:
 *   node tools/validate-labels.mjs              # warn on unsorted (default)
 *   node tools/validate-labels.mjs --strict-sort # fail on unsorted
 *   pnpm labels:check                            # default mode
 *   pnpm labels:check:strict                     # strict mode
 *
 * Checks:
 *   1. File exists and parses as JSON array.
 *   2. Each label has non-empty name, valid hex color, non-empty description.
 *   3. No duplicate names (case-insensitive).
 *   4. Sort order: warn (default) or fail (--strict-sort).
 *
 * Exits non-zero on any validation failure.
 * To enforce strict sort in CI, switch the workflow step to `pnpm labels:check:strict`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LABELS_PATH = resolve(".", ".github", "labels.json");
const HEX_COLOR = /^[0-9a-fA-F]{6}$/;
const strictSort = process.argv.includes("--strict-sort");

let raw;
try {
  raw = readFileSync(LABELS_PATH, "utf-8");
} catch {
  console.error(`FAIL: Cannot read ${LABELS_PATH}`);
  process.exit(1);
}

let labels;
try {
  labels = JSON.parse(raw);
} catch (err) {
  console.error(`FAIL: Invalid JSON in ${LABELS_PATH}: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(labels)) {
  console.error("FAIL: labels.json must be a JSON array.");
  process.exit(1);
}

// ── Validate each label ───────────────────────────────────────────
const errors = [];
const seen = new Map(); // lowercase name → original index

for (let i = 0; i < labels.length; i++) {
  const label = labels[i];
  const prefix = `[${i}]`;

  if (!label || typeof label !== "object") {
    errors.push(`${prefix} Not an object.`);
    continue;
  }

  const { name, color, description } = label;

  if (typeof name !== "string" || name.trim() === "") {
    errors.push(`${prefix} Missing or empty "name".`);
  } else {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      errors.push(`${prefix} Duplicate name "${name}" (first at index ${seen.get(key)}).`);
    } else {
      seen.set(key, i);
    }
  }

  if (typeof color !== "string" || !HEX_COLOR.test(color)) {
    errors.push(`${prefix} Invalid "color": "${color ?? ""}" — expected 6-digit hex (e.g. "D73A4A").`);
  }

  if (typeof description !== "string" || description.trim() === "") {
    errors.push(`${prefix} Missing or empty "description".`);
  }
}

// ── Sort check (warning only) ─────────────────────────────────────
const names = labels.map((l) => l.name).filter(Boolean);
const sorted = [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
const isSorted = names.every((n, i) => n === sorted[i]);

// ── Report ────────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error(`\nFAIL: ${errors.length} error(s) in labels.json:\n`);
  for (const err of errors) {
    console.error(`  ${err}`);
  }
  console.error("");
  process.exit(1);
}

console.log(`OK: ${labels.length} labels validated.`);

if (!isSorted) {
  if (strictSort) {
    console.error("FAIL: Labels are not sorted alphabetically by name (--strict-sort).");
    process.exit(1);
  }
  console.warn("WARN: Labels are not sorted alphabetically by name. Consider sorting for readability.");
}

process.exit(0);

