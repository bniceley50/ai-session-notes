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

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const LABELS_PATH = resolve(".", ".github", "labels.json");

// ── Resolve `gh` binary ──────────────────────────────────────────
// Supports: GH_BIN env var → `gh` on PATH → common install locations.
function resolveGh() {
  // 1. Explicit override
  if (process.env.GH_BIN) {
    if (!existsSync(process.env.GH_BIN)) {
      console.error(`GH_BIN points to ${process.env.GH_BIN} but file does not exist.`);
      process.exit(1);
    }
    return `"${process.env.GH_BIN}"`;
  }

  // 2. Try `gh` on current PATH
  try {
    execSync("gh --version", { stdio: "pipe" });
    return "gh";
  } catch {
    // not on PATH — continue
  }

  // 3. Common install locations (Windows / macOS / Linux)
  // Use forward slashes — Node resolves them on all platforms.
  const candidates = [
    "C:/Program Files/GitHub CLI/gh.exe",
    "C:/Program Files (x86)/GitHub CLI/gh.exe",
    "/usr/local/bin/gh",
    "/opt/homebrew/bin/gh",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return `"${candidate}"`;
    }
  }

  console.error(
    "gh CLI not found. Either:\n" +
    "  • Set GH_BIN to the full path of gh.exe\n" +
    "  • Add GitHub CLI to your PATH\n" +
    "  • Install: https://cli.github.com",
  );
  process.exit(1);
}

const GH = resolveGh();

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
  const raw = execSync(`${GH} label list --json name,color,description --limit 200`, {
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
        `${GH} label create ${quote(name)} --color "${color}" --description ${quote(description)}`,
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
        `${GH} label edit ${quote(name)} --color "${color}" --description ${quote(description)}`,
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
