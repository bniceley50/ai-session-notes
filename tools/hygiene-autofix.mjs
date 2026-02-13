#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "coverage",
  ".artifacts",
  ".hygiene",
]);

const FIXABLE_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function shouldFix(filePath) {
  const base = path.basename(filePath);
  if (base === ".env" || base.endsWith(".env") || base.endsWith(".env.local") || base.endsWith(".env.example")) {
    return true;
  }
  return FIXABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function listFiles(rootDir) {
  const out = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        await walk(full);
      } else {
        out.push(full);
      }
    }
  }

  await walk(rootDir);
  return out;
}

function normalizeContent(content, isMarkdown) {
  let next = content;

  // Normalize line endings.
  next = next.replace(/\r\n/g, "\n");

  // Strip trailing spaces/tabs.
  next = next
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  // Keep markdown readable but avoid huge blank runs.
  if (isMarkdown) {
    next = next.replace(/\n{4,}/g, "\n\n\n");
  }

  // Exactly one trailing newline.
  next = next.replace(/\n*$/g, "\n");

  return next;
}

const root = process.cwd();
const files = await listFiles(root);
const changed = [];

for (const file of files) {
  if (!shouldFix(file)) continue;

  let content;
  try {
    content = await fs.readFile(file, "utf8");
  } catch {
    continue;
  }

  const normalized = normalizeContent(content, file.endsWith(".md"));
  if (normalized !== content) {
    await fs.writeFile(file, normalized, "utf8");
    changed.push(toPosix(path.relative(root, file)));
  }
}

console.log(`Auto-fix complete. Files changed: ${changed.length}`);
for (const rel of changed.slice(0, 200)) {
  console.log(`- ${rel}`);
}
