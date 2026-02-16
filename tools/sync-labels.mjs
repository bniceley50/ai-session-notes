#!/usr/bin/env node

/**
 * sync-labels.mjs — Upsert GitHub labels from .github/labels.json.
 *
 * Usage:
 *   node tools/sync-labels.mjs
 *   pnpm labels:sync
 *
 * Prerequisites:
 *   - `gh` CLI installed and authenticated (`gh auth login`)
 *   - Run from the repo root
 *
 * Behavior (safe mode):
 *   - Creates labels that don't exist yet.
 *   - Updates color/description if they differ from the seed file.
 *   - Does NOT delete labels that exist on GitHub but aren't in the seed.
 *   - Idempotent — safe to run repeatedly.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const LABELS_PATH = resolve(".", ".github", "labels.json");

// ── Load seed labels ──────────────────────────────────────────────
let labels;
try {
  labels = JSON.parse(readFileSync(LABELS_PATH, "utf-8"));
} catch (err) {
  console.error(`Failed to read ${LABELS_PATH}:`, err.message);
  process.exit(1);
}

console.log(`Syncing ${labels.length} labels...\n`);

// ── Fetch existing labels from GitHub ─────────────────────────────
let existing;
try {
  const raw = execSync("gh label list --json name,color,description --limit 200", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  existing = new Map(JSON.parse(raw).map((l) => [l.name, l]));
} catch {
  console.error("Failed to list labels. Is `gh` authenticated? Run: gh auth login");
  process.exit(1);
}

// ── Upsert each label ─────────────────────────────────────────────
let created = 0;
let updated = 0;
let unchanged = 0;

for (const label of labels) {
  const { name, color, description } = label;
  const current = existing.get(name);

  if (!current) {
    // Create
    try {
      execSync(
        `gh label create ${quote(name)} --color "${color}" --description ${quote(description)}`,
        { stdio: "pipe" },
      );
      console.log(`  + created: ${name}`);
      created++;
    } catch (err) {
      console.error(`  ! failed to create: ${name}`, err.message);
    }
  } else if (
    current.color.toLowerCase() !== color.toLowerCase() ||
    (current.description || "") !== description
  ) {
    // Update
    try {
      execSync(
        `gh label edit ${quote(name)} --color "${color}" --description ${quote(description)}`,
        { stdio: "pipe" },
      );
      console.log(`  ~ updated: ${name}`);
      updated++;
    } catch (err) {
      console.error(`  ! failed to update: ${name}`, err.message);
    }
  } else {
    unchanged++;
  }
}

console.log(`\nDone: ${created} created, ${updated} updated, ${unchanged} unchanged.`);

// ── Helpers ───────────────────────────────────────────────────────
function quote(str) {
  // Shell-safe quoting for gh CLI arguments
  return `"${str.replace(/"/g, '\\"')}"`;
}

