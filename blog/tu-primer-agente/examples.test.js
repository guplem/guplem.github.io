// Tests for the downloadable example agents of the tutorial, in both
// languages. Each example lives twice: as a folder (so a reviewer and a
// crawler can read every file) and as a .zip (so a reader downloads it in one
// click). These tests keep the two in step, and keep each example a working
// agent: the instructions, the one-line CLAUDE.md, and the same skills in the
// folder that Claude reads and in the folder that the other apps read.
//
// To rebuild a zip after a change to its folder, run from the examples folder:
//   rm -f NAME.zip && zip -r -X NAME.zip NAME

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "./agentCore.js";

const blogDir = join(import.meta.dir, "..");
const posts = [
  { post: "tu-primer-agente", examples: "ejemplos" },
  { post: "your-first-agent", examples: "examples" },
].filter(({ post }) => existsSync(join(blogDir, post, "index.html")));

/** Every file under a folder, as paths relative to `base`, with "/" separators. */
function listFiles(folder, base = folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? listFiles(path, base) : [path.slice(base.length + 1).split("\\").join("/")];
  });
}

/** The files a zip holds, read from its central directory: name to CRC-32. */
function zipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("not a zip file");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const crc = view.getUint32(offset + 16, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (!name.endsWith("/")) entries.set(name, crc);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

for (const { post, examples } of posts) {
  const examplesDir = join(blogDir, post, examples);
  const html = readFileSync(join(blogDir, post, "index.html"), "utf8");
  const linked = [...html.matchAll(new RegExp(`href="${examples}/([^"]+)\\.zip"`, "g"))].map((match) => match[1]);

  describe(`${post}: the downloadable examples`, () => {
    test("the post links five examples, and each link has its zip and its folder", () => {
      expect(linked.length).toBe(5);
      for (const name of linked) {
        expect(existsSync(join(examplesDir, `${name}.zip`)), `${name}.zip`).toBe(true);
        expect(existsSync(join(examplesDir, name)), name).toBe(true);
      }
    });

    for (const name of linked) {
      const folder = join(examplesDir, name);
      if (!existsSync(folder)) continue;
      const files = listFiles(folder);

      test(`${name}: the zip holds exactly the files of the folder`, () => {
        const entries = zipEntries(new Uint8Array(readFileSync(join(examplesDir, `${name}.zip`))));
        expect([...entries.keys()].sort()).toEqual(files.map((file) => `${name}/${file}`).sort());
        for (const file of files) {
          expect(entries.get(`${name}/${file}`), file).toBe(Bun.hash.crc32(readFileSync(join(folder, file))));
        }
      });

      test(`${name}: is a complete agent folder`, () => {
        expect(files).toContain("AGENTS.md");
        expect(readFileSync(join(folder, "CLAUDE.md"), "utf8").trim()).toBe("@AGENTS.md");
        expect(files.some((file) => file.startsWith("exportaciones/") || file.startsWith("exports/"))).toBe(true);
      });

      test(`${name}: has the same valid skills for Claude and for the other apps`, () => {
        const skills = (dir) => files.filter((file) => file.startsWith(`${dir}/`) && file.endsWith("/SKILL.md")).map((file) => file.slice(dir.length + 1));
        const shared = skills(".agents/skills");
        expect(shared.length).toBeGreaterThan(0);
        expect(skills(".claude/skills")).toEqual(shared);
        for (const skill of shared) {
          const text = readFileSync(join(folder, ".agents/skills", skill), "utf8");
          expect(readFileSync(join(folder, ".claude/skills", skill), "utf8")).toBe(text);
          const meta = parseFrontmatter(text);
          expect(meta?.name).toBe(skill.split("/")[0]);
          expect(meta?.description?.length).toBeGreaterThan(0);
          // A second ": " in a plain YAML value breaks strict parsers.
          expect(meta.description).not.toContain(": ");
        }
      });
    }
  });
}
