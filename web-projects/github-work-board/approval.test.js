import { describe, expect, test } from "bun:test";
import {
  TOKEN_STATUS_URL,
  approvalOrganisations,
  approvalPageUrl,
  isOrganisationName,
  readsOnlyPublicData,
  shouldAskAboutApproval,
} from "./approval.js";

describe("shouldAskAboutApproval", () => {
  // The extra call is spent only on a token that found nothing at all. A token
  // that found work is approved, or needs no approval, and costs nothing more.
  test("asks only when the token found no work of any kind", () => {
    expect(shouldAskAboutApproval({ openCount: 0, finishedCount: 0, reviewCount: 0 })).toBe(true);
    expect(shouldAskAboutApproval({ openCount: 1, finishedCount: 0, reviewCount: 0 })).toBe(false);
    expect(shouldAskAboutApproval({ openCount: 0, finishedCount: 2, reviewCount: 0 })).toBe(false);
    expect(shouldAskAboutApproval({ openCount: 0, finishedCount: 0, reviewCount: 3 })).toBe(false);
  });

  test("reads a missing count as nothing found", () => {
    expect(shouldAskAboutApproval({})).toBe(true);
    expect(shouldAskAboutApproval()).toBe(true);
  });
});

describe("readsOnlyPublicData", () => {
  // A pending token reads public data only, so it reaches no private
  // repository. A personal token always reaches at least one: the reader's own.
  test("is true when the answer lists no private repository", () => {
    expect(readsOnlyPublicData({ ok: true, data: [] })).toBe(true);
  });

  test("is false when the token reaches a private repository", () => {
    expect(readsOnlyPublicData({ ok: true, data: [{ full_name: "guplem/board" }] })).toBe(false);
  });

  // A call that failed proves nothing, and the board never claims what it did
  // not see. The failed call already says what went wrong on its own row.
  test("is false when the call failed or answered nonsense", () => {
    expect(readsOnlyPublicData({ ok: false, status: 403, message: "Forbidden" })).toBe(false);
    expect(readsOnlyPublicData({ ok: true, data: null })).toBe(false);
    expect(readsOnlyPublicData(null)).toBe(false);
  });
});

describe("isOrganisationName", () => {
  // GitHub's rule for a login: letters, digits and single hyphens inside, at
  // most 39 characters. Anything else would build a link that goes nowhere.
  test("accepts a GitHub login", () => {
    expect(isOrganisationName("Galtea-AI")).toBe(true);
    expect(isOrganisationName("a")).toBe(true);
    expect(isOrganisationName("x".repeat(39))).toBe(true);
  });

  test("refuses what GitHub would refuse", () => {
    expect(isOrganisationName("")).toBe(false);
    expect(isOrganisationName("-galtea")).toBe(false);
    expect(isOrganisationName("galtea-")).toBe(false);
    expect(isOrganisationName("gal--tea")).toBe(false);
    expect(isOrganisationName("galtea/ai")).toBe(false);
    expect(isOrganisationName("x".repeat(40))).toBe(false);
    expect(isOrganisationName(null)).toBe(false);
  });
});

describe("approvalPageUrl", () => {
  test("is the organisation's own page of token requests", () => {
    expect(approvalPageUrl("Galtea-AI")).toBe(
      "https://github.com/organizations/Galtea-AI/settings/personal-access-token-requests",
    );
  });

  test("trims the name a person typed", () => {
    expect(approvalPageUrl("  Galtea-AI ")).toBe(
      "https://github.com/organizations/Galtea-AI/settings/personal-access-token-requests",
    );
  });

  test("is empty for a name that is not a GitHub login", () => {
    expect(approvalPageUrl("not a name")).toBe("");
    expect(approvalPageUrl("")).toBe("");
  });
});

describe("approvalOrganisations", () => {
  // The name the reader typed is the one they know is right, so it wins over
  // anything GitHub suggests.
  test("prefers the organisation the reader typed", () => {
    expect(approvalOrganisations({ saved: "Galtea-AI", publicOrganisations: ["other-org"], login: "guplem" })).toEqual([
      "Galtea-AI",
    ]);
  });

  // Most people keep their membership private, so this list is often empty.
  test("falls back to the organisations the person belongs to in public", () => {
    expect(
      approvalOrganisations({ saved: "", publicOrganisations: ["Galtea-AI", "acme"], login: "guplem" }),
    ).toEqual(["Galtea-AI", "acme"]);
  });

  test("drops the person's own login, repeats and broken names", () => {
    expect(
      approvalOrganisations({
        saved: "not a name",
        publicOrganisations: ["guplem", "acme", "acme", "", 7, "ACME"],
        login: "GUPLEM",
      }),
    ).toEqual(["acme"]);
  });

  test("answers with no organisation when nothing names one", () => {
    expect(approvalOrganisations({})).toEqual([]);
    expect(approvalOrganisations()).toEqual([]);
  });
});

describe("TOKEN_STATUS_URL", () => {
  // The reader's own list, where GitHub says which owner each token has and
  // whether a request is still waiting.
  test("is the reader's list of fine-grained tokens", () => {
    expect(TOKEN_STATUS_URL).toBe("https://github.com/settings/personal-access-tokens");
  });
});
