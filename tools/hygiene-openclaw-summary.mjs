#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repo = process.argv[2] || "bniceley50/ai-session-notes";
const outFile = process.argv[3] || "";

function runGh(args) {
  return execFileSync("gh", args, { encoding: "utf8" });
}

let runs = [];
try {
  const raw = runGh([
    "run",
    "list",
    "-R",
    repo,
    "--limit",
    "30",
    "--json",
    "workflowName,status,conclusion,displayTitle,createdAt,url,event",
  ]);
  runs = JSON.parse(raw);
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Failed to fetch workflow runs for ${repo}: ${message}`);
  process.exit(1);
}

const tracked = runs.filter((r) => {
  const name = String(r.workflowName || "");
  return (
    name.startsWith("Repo Hygiene") ||
    name === "Jobs Runner Schedule"
  );
});

const failing = tracked.filter((r) => r.conclusion === "failure");
const inProgress = tracked.filter((r) => r.status !== "completed");
const success = tracked.filter((r) => r.conclusion === "success");
const latestByWorkflow = new Map();
for (const run of tracked) {
  if (!latestByWorkflow.has(run.workflowName)) {
    latestByWorkflow.set(run.workflowName, run);
  }
}
const currentFailures = [...latestByWorkflow.values()].filter(
  (r) => r.status === "completed" && r.conclusion === "failure",
);

const lines = [];
lines.push(`# Repo Hygiene Summary (${repo})`);
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Tracked runs: ${tracked.length}`);
lines.push(`Success: ${success.length}`);
lines.push(`Failure: ${failing.length}`);
lines.push(`In-progress: ${inProgress.length}`);
lines.push("");

if (tracked.length === 0) {
  lines.push("No tracked hygiene workflow runs found.");
} else {
  lines.push("## Current Workflow Health");
  lines.push("");
  for (const run of latestByWorkflow.values()) {
    const status = run.status === "completed" ? run.conclusion : run.status;
    lines.push(`- ${run.workflowName}: ${status} (${run.event}) - ${run.url}`);
  }
  lines.push("");
  lines.push("## Recent Runs");
  lines.push("");
  for (const run of tracked.slice(0, 10)) {
    const status = run.status === "completed" ? run.conclusion : run.status;
    lines.push(`- ${run.workflowName}: ${status} (${run.event}) - ${run.url}`);
  }
}

if (currentFailures.length > 0) {
  lines.push("");
  lines.push("## Attention Needed");
  lines.push("");
  for (const run of currentFailures) {
    lines.push(`- ${run.workflowName} latest run failed: ${run.url}`);
  }
}

const output = `${lines.join("\n")}\n`;
process.stdout.write(output);

if (outFile) {
  const abs = path.resolve(process.cwd(), outFile);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, output, "utf8");
}
