// Decisions that are cheap to break and expensive to notice. The page and the
// scheduled job live in different files, so nothing else checks they agree.
import { describe, test, expect } from "bun:test";
import { FEED_URL } from "./feed.js";
import { FIRMS_SOURCES } from "./firms.js";

const workflow = await Bun.file(new URL("../../.github/workflows/wildfire-feed.yml", import.meta.url)).text();

describe("the feed job and the page agree", () => {
  test("the job publishes to the branch and file the page reads", () => {
    const [, branch, file] = FEED_URL.match(/guplem\.github\.io\/([^/]+)\/(.+)$/);
    expect(workflow).toContain(`git push -f "https://x-access-token:\${{ github.token }}@github.com/\${{ github.repository }}.git" ${branch}`);
    expect(workflow).toContain(`--out out/${file}`);
  });
  test("the job runs the script in this folder", () => {
    expect(workflow).toContain("bun web-projects/wildfire-watch/makeFeed.js");
  });
  test("the job runs on a schedule, so the fire data keeps moving", () => {
    expect(workflow).toMatch(/schedule:\s*\n\s*- cron:/);
  });
  test("every FIRMS file is a keyless public file, so no secret is needed", () => {
    for (const s of FIRMS_SOURCES) expect(s.url).not.toMatch(/MAP_KEY|api\//i);
  });
});
