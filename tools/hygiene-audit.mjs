#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const SEVERITY_ORDER = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "coverage",
  ".artifacts",
  ".hygiene",
]);

const TEXT_EXTENSIONS = new Set([
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
  ".env",
  ".example",
]);

function parseArgs(argv) {
  const args = {
    mode: "local",
    outDir: ".hygiene",
    failOn: "P1",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mode" && argv[i + 1]) {
      args.mode = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out-dir" && argv[i + 1]) {
      args.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--fail-on" && argv[i + 1]) {
      args.failOn = argv[i + 1].toUpperCase();
      i += 1;
      continue;
    }
  }

  if (!["P0", "P1", "P2", "P3", "NONE"].includes(args.failOn)) {
    throw new Error(`Invalid --fail-on value: ${args.failOn}`);
  }

  return args;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeFindingId(seed) {
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 12);
}

function isTextFile(filePath) {
  const base = path.basename(filePath);
  if (base === ".env" || base.endsWith(".env") || base.endsWith(".env.local") || base.endsWith(".env.example")) {
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

async function listFiles(rootDir) {
  const results = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const rel = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        await walk(fullPath);
        continue;
      }

      results.push({
        fullPath,
        relPath: toPosix(rel),
      });
    }
  }

  await walk(rootDir);
  return results;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function compareFinding(a, b) {
  const sevA = SEVERITY_ORDER[a.severity] ?? 99;
  const sevB = SEVERITY_ORDER[b.severity] ?? 99;
  if (sevA !== sevB) return sevA - sevB;
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  return (a.line ?? 0) - (b.line ?? 0);
}

function parseJsonSafe(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

const args = parseArgs(process.argv.slice(2));
const root = process.cwd();
const outDir = path.resolve(root, args.outDir);

const findings = [];
const findingSeen = new Set();

function addFinding({ severity, title, file, line = 1, details, recommendation, autoFixable = false, id }) {
  const normalizedFile = toPosix(file);
  const key = `${severity}|${title}|${normalizedFile}|${line}|${details}`;
  if (findingSeen.has(key)) return;
  findingSeen.add(key);

  const finalId = id || makeFindingId(`${title}|${normalizedFile}|${line}|${details}`);
  const fingerprint = makeFindingId(`${severity}|${title}|${normalizedFile}|${details.slice(0, 200)}`);

  findings.push({
    id: finalId,
    fingerprint,
    severity,
    title,
    file: normalizedFile,
    line,
    details,
    recommendation,
    autoFixable,
  });
}

const files = await listFiles(root);
const fileMap = new Map(files.map((entry) => [entry.relPath, entry.fullPath]));

// 1) Required files present
for (const required of [
  "README.md",
  "SECURITY.md",
  ".env.example",
  "docs/RELEASE_CHECKLIST.md",
  "src/lib/config.ts",
  ".github/workflows/e2e-playwright.yml",
]) {
  if (!fileMap.has(required)) {
    addFinding({
      severity: "P1",
      title: "Required repo file is missing",
      file: required,
      line: 1,
      details: `Expected required file \`${required}\` was not found.`,
      recommendation: `Restore or recreate \`${required}\` so docs/runtime checks stay trustworthy.`,
      autoFixable: false,
    });
  }
}

// 2) Validate env var docs parity with config getters
const configRel = "src/lib/config.ts";
const envRel = ".env.example";
if (fileMap.has(configRel) && fileMap.has(envRel)) {
  const configText = await fs.readFile(fileMap.get(configRel), "utf8");
  const envText = await fs.readFile(fileMap.get(envRel), "utf8");

  const requiredVars = new Set();
  for (const match of configText.matchAll(/requiredString\("([A-Z0-9_]+)"\)/g)) {
    requiredVars.add(match[1]);
  }
  for (const match of configText.matchAll(/requiredPositiveInt\("([A-Z0-9_]+)"\)/g)) {
    requiredVars.add(match[1]);
  }

  for (const variable of requiredVars) {
    const pattern = new RegExp(`(^|\\n)\\s*#?\\s*${escapeRegExp(variable)}=`);
    if (!pattern.test(envText)) {
      addFinding({
        severity: "P1",
        title: "Missing required env var in .env.example",
        file: envRel,
        line: 1,
        details: `Config requires \`${variable}\` but .env.example does not declare it.`,
        recommendation: `Add \`${variable}=\` (or commented placeholder) to .env.example.`,
        autoFixable: false,
        id: `env-${variable.toLowerCase()}`,
      });
    }
  }
}

// 3) Markdown internal links + workflow path refs
const markdownFiles = files.filter((entry) => entry.relPath.endsWith(".md"));
for (const md of markdownFiles) {
  const content = await fs.readFile(md.fullPath, "utf8");
  const lines = content.split(/\r?\n/);

  // workflow references inside docs
  for (const match of content.matchAll(/\.github\/workflows\/([A-Za-z0-9._-]+\.ya?ml)/g)) {
    const workflowRel = `.github/workflows/${match[1]}`;
    if (!fileMap.has(workflowRel)) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      addFinding({
        severity: "P1",
        title: "Docs reference missing workflow file",
        file: md.relPath,
        line,
        details: `Referenced workflow \`${workflowRel}\` does not exist.`,
        recommendation: "Update docs to the correct workflow filename or restore the workflow file.",
        autoFixable: false,
      });
    }
  }

  // internal markdown links
  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of content.matchAll(linkRegex)) {
    const rawTarget = match[1].trim();
    if (!rawTarget) continue;
    if (rawTarget.startsWith("http://") || rawTarget.startsWith("https://") || rawTarget.startsWith("mailto:") || rawTarget.startsWith("tel:") || rawTarget.startsWith("#")) {
      continue;
    }

    const cleanTarget = rawTarget.replace(/^<|>$/g, "");
    const [targetPathRaw] = cleanTarget.split("#");
    if (!targetPathRaw) continue;

    let resolved;
    if (targetPathRaw.startsWith("/")) {
      resolved = path.resolve(root, `.${targetPathRaw}`);
    } else {
      resolved = path.resolve(path.dirname(md.fullPath), targetPathRaw);
    }

    const exists = await fileExists(resolved);
    if (!exists) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      addFinding({
        severity: "P1",
        title: "Broken internal markdown link",
        file: md.relPath,
        line,
        details: `Link target \`${targetPathRaw}\` does not resolve to a file in this repo.`,
        recommendation: "Fix or remove the broken markdown link target.",
        autoFixable: false,
      });
    }
  }

  // command docs drift check for pnpm commands
  const pkgRaw = fileMap.get("package.json") ? await fs.readFile(fileMap.get("package.json"), "utf8") : "{}";
  const scripts = new Set(Object.keys(parseJsonSafe(pkgRaw, {}).scripts ?? {}));
  const allowedPnpmCommands = new Set(["install", "exec", "dlx", "create", "add", "remove", "run", "publish", "tsc", "eslint"]);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const cmdMatch = line.match(/^\s*(?:\$\s*)?pnpm\s+(.+)$/);
    if (!cmdMatch) continue;

    const tokens = cmdMatch[1].trim().split(/\s+/).filter(Boolean);
    while (tokens.length > 0 && tokens[0].startsWith("-")) tokens.shift();
    if (tokens.length === 0) continue;

    const first = tokens[0];
    if (first === "run") {
      const script = tokens[1];
      if (script && !scripts.has(script)) {
        addFinding({
          severity: "P2",
          title: "Markdown command references missing npm script",
          file: md.relPath,
          line: i + 1,
          details: `Command references \`pnpm run ${script}\`, but package.json has no \`${script}\` script.`,
          recommendation: "Update docs to an existing script or add the missing script.",
          autoFixable: false,
        });
      }
      continue;
    }

    if (scripts.has(first) || allowedPnpmCommands.has(first)) continue;

    addFinding({
      severity: "P2",
      title: "Potentially stale pnpm command in docs",
      file: md.relPath,
      line: i + 1,
      details: `Found \`pnpm ${first}\` which is not recognized as a package script or standard pnpm command in this repo context.`,
      recommendation: "Verify the command still works and update docs if needed.",
      autoFixable: false,
    });
  }
}

// 4) Workflow hygiene checks
const workflowFiles = files.filter((entry) => entry.relPath.startsWith(".github/workflows/") && /\.ya?ml$/.test(entry.relPath));
for (const workflow of workflowFiles) {
  const content = await fs.readFile(workflow.fullPath, "utf8");
  if (!/timeout-minutes\s*:/m.test(content)) {
    addFinding({
      severity: "P2",
      title: "Workflow missing timeout",
      file: workflow.relPath,
      line: 1,
      details: "Workflow does not set timeout-minutes, which can cause hung CI jobs.",
      recommendation: "Set timeout-minutes for each job.",
      autoFixable: false,
    });
  }
}

// 5) Secret leak scan + TODO/FIXME tracking
const secretPatterns = [
  { re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, name: "GitHub token" },
  { re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, name: "GitHub PAT" },
  { re: /\bsk-[A-Za-z0-9]{20,}\b/g, name: "API key" },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, name: "AWS access key" },
];

for (const entry of files) {
  if (!isTextFile(entry.fullPath)) continue;
  const text = await fs.readFile(entry.fullPath, "utf8");
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lc = line.toLowerCase();

    if (/(\bTODO\b|\bFIXME\b|\bHACK\b)/.test(line)) {
      addFinding({
        severity: "P3",
        title: "Track outstanding TODO/FIXME/HACK",
        file: entry.relPath,
        line: i + 1,
        details: line.trim().slice(0, 240),
        recommendation: "Confirm this marker is still valid and track/remove it intentionally.",
        autoFixable: false,
      });
    }

    for (const pattern of secretPatterns) {
      pattern.re.lastIndex = 0;
      const matched = pattern.re.test(line);
      if (!matched) continue;

      if (lc.includes("example") || lc.includes("placeholder") || lc.includes("dummy") || lc.includes("redacted")) {
        continue;
      }

      addFinding({
        severity: "P0",
        title: `Potential ${pattern.name} leaked in repository`,
        file: entry.relPath,
        line: i + 1,
        details: "Line content matched a high-confidence credential pattern.",
        recommendation: "Rotate the credential immediately, remove it from git history, and replace with env references.",
        autoFixable: false,
      });
    }
  }
}

// 6) Repo manager lockfile parity
if (fileMap.has("package.json")) {
  const pkgText = await fs.readFile(fileMap.get("package.json"), "utf8");
  const pkg = parseJsonSafe(pkgText, {});
  const packageManager = String(pkg.packageManager ?? "");

  if (packageManager.startsWith("pnpm@") && !fileMap.has("pnpm-lock.yaml")) {
    addFinding({
      severity: "P1",
      title: "Missing pnpm lockfile",
      file: "package.json",
      line: 1,
      details: "packageManager declares pnpm, but pnpm-lock.yaml is missing.",
      recommendation: "Commit pnpm-lock.yaml to keep installs reproducible.",
      autoFixable: false,
    });
  }
}

findings.sort(compareFinding);

const summary = {
  total: findings.length,
  bySeverity: {
    P0: findings.filter((f) => f.severity === "P0").length,
    P1: findings.filter((f) => f.severity === "P1").length,
    P2: findings.filter((f) => f.severity === "P2").length,
    P3: findings.filter((f) => f.severity === "P3").length,
  },
};

await fs.mkdir(outDir, { recursive: true });

const jsonPayload = {
  generatedAt: new Date().toISOString(),
  mode: args.mode,
  failOn: args.failOn,
  summary,
  findings,
};

const jsonPath = path.join(outDir, "findings.json");
await fs.writeFile(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");

const mdLines = [];
mdLines.push("# Hygiene Audit Report");
mdLines.push("");
mdLines.push(`- Generated: ${jsonPayload.generatedAt}`);
mdLines.push(`- Mode: ${args.mode}`);
mdLines.push(`- Fail threshold: ${args.failOn}`);
mdLines.push(`- Findings: ${summary.total} (P0 ${summary.bySeverity.P0}, P1 ${summary.bySeverity.P1}, P2 ${summary.bySeverity.P2}, P3 ${summary.bySeverity.P3})`);
mdLines.push("");

if (findings.length === 0) {
  mdLines.push("No material hygiene issues found.");
} else {
  mdLines.push("| Severity | Title | File | Line | Auto-fixable | ID |");
  mdLines.push("|---|---|---|---:|---|---|");
  for (const finding of findings) {
    mdLines.push(`| ${finding.severity} | ${finding.title} | ${finding.file} | ${finding.line} | ${finding.autoFixable ? "yes" : "no"} | ${finding.id} |`);
  }

  mdLines.push("");
  mdLines.push("## Details");
  mdLines.push("");
  for (const finding of findings) {
    mdLines.push(`### [${finding.severity}] ${finding.title}`);
    mdLines.push(`- File: \`${finding.file}:${finding.line}\``);
    mdLines.push(`- ID: \`${finding.id}\``);
    mdLines.push(`- Auto-fixable: ${finding.autoFixable ? "yes" : "no"}`);
    mdLines.push(`- Evidence: ${finding.details}`);
    mdLines.push(`- Recommended fix: ${finding.recommendation}`);
    mdLines.push("");
  }
}

const mdPath = path.join(outDir, "findings.md");
await fs.writeFile(mdPath, `${mdLines.join("\n")}\n`, "utf8");

console.log(`Hygiene audit complete: ${summary.total} finding(s).`);
console.log(`P0=${summary.bySeverity.P0} P1=${summary.bySeverity.P1} P2=${summary.bySeverity.P2} P3=${summary.bySeverity.P3}`);
console.log(`Report JSON: ${jsonPath}`);
console.log(`Report MD: ${mdPath}`);

if (args.failOn !== "NONE") {
  const threshold = SEVERITY_ORDER[args.failOn];
  const blocking = findings.filter((f) => (SEVERITY_ORDER[f.severity] ?? 99) <= threshold);
  if (blocking.length > 0) {
    console.error(`Blocking findings at ${args.failOn}+ threshold: ${blocking.length}`);
    process.exit(1);
  }
}

