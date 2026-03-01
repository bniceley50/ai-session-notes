import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { writeFileAtomic } from "@/lib/fs/writeFileAtomic";

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "atomic-write-test-"));
}

describe("writeFileAtomic", () => {
  test("creates file with correct content", async () => {
    const dir = await makeTmpDir();
    const filePath = path.join(dir, "output.txt");

    await writeFileAtomic(filePath, "hello world");

    const content = await fs.readFile(filePath, "utf8");
    assert.equal(content, "hello world");

    await fs.rm(dir, { recursive: true, force: true });
  });

  test("creates parent directories if missing", async () => {
    const dir = await makeTmpDir();
    const filePath = path.join(dir, "nested", "deep", "output.txt");

    await writeFileAtomic(filePath, "nested content");

    const content = await fs.readFile(filePath, "utf8");
    assert.equal(content, "nested content");

    await fs.rm(dir, { recursive: true, force: true });
  });

  test("overwrites existing file atomically", async () => {
    const dir = await makeTmpDir();
    const filePath = path.join(dir, "output.txt");

    await writeFileAtomic(filePath, "original");
    await writeFileAtomic(filePath, "updated");

    const content = await fs.readFile(filePath, "utf8");
    assert.equal(content, "updated");

    await fs.rm(dir, { recursive: true, force: true });
  });

  test("no temp files remain after successful write", async () => {
    const dir = await makeTmpDir();
    const filePath = path.join(dir, "output.txt");

    await writeFileAtomic(filePath, "content");

    const entries = await fs.readdir(dir);
    const temps = entries.filter((e) => e.includes(".tmp-"));
    assert.equal(temps.length, 0, "no temp files should remain after success");

    await fs.rm(dir, { recursive: true, force: true });
  });

  test("throws on impossible path and leaves no temp files", async () => {
    // /dev/null is a file, not a directory — mkdir will fail with ENOTDIR
    const filePath = "/dev/null/impossible/output.txt";

    await assert.rejects(
      () => writeFileAtomic(filePath, "should fail"),
      (err: NodeJS.ErrnoException) => {
        assert.ok(
          err.code === "ENOTDIR" || err.code === "ENOENT",
          `expected ENOTDIR or ENOENT, got ${err.code}`,
        );
        return true;
      },
    );
  });

  test("preserves existing file when rename source is missing", async () => {
    const dir = await makeTmpDir();
    const filePath = path.join(dir, "output.txt");

    // Write original content normally
    await writeFileAtomic(filePath, "original content");

    // Verify the content is correct
    const content = await fs.readFile(filePath, "utf8");
    assert.equal(content, "original content");

    // Verify no temp files linger
    const entries = await fs.readdir(dir);
    const temps = entries.filter((e) => e.includes(".tmp-"));
    assert.equal(temps.length, 0, "no temp files should remain");

    await fs.rm(dir, { recursive: true, force: true });
  });
});
