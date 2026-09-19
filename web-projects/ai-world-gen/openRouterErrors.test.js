import { describe, expect, test } from "bun:test";
import { describeFailure } from "./openRouterErrors.js";

describe("describeFailure", () => {
  test("a request that never completed names the browser, not the key", () => {
    const text = describeFailure({ ok: false, status: 0, message: "The request never completed." });
    expect(text).toContain("did not reach OpenRouter");
    expect(text).toMatch(/network|blocked|offline/i);
  });

  test("401 says the key is wrong", () => {
    expect(describeFailure({ ok: false, status: 401, message: "User not found." })).toMatch(/key/i);
  });

  test("402 says there are no credits", () => {
    expect(describeFailure({ ok: false, status: 402, message: "Insufficient credits" })).toMatch(/credit/i);
  });

  test("404 and 400 with a model name say the model is not available", () => {
    expect(describeFailure({ ok: false, status: 404, message: "No endpoints found" })).toMatch(/model/i);
    expect(describeFailure({ ok: false, status: 400, message: "not a valid model ID" })).toMatch(/model/i);
  });

  test("429 says to wait", () => {
    expect(describeFailure({ ok: false, status: 429, message: "Rate limited" })).toMatch(/rate|wait|slow/i);
  });

  test("a provider error names the provider and keeps the message", () => {
    const text = describeFailure({ ok: false, status: 502, message: "Provider returned error" });
    expect(text).toMatch(/provider|OpenRouter/i);
    expect(text).toContain("Provider returned error");
  });

  test("an unknown status still says something with the message in it", () => {
    expect(describeFailure({ ok: false, status: 418, message: "teapot" })).toContain("teapot");
    expect(describeFailure(null)).toBeTruthy();
  });
});
