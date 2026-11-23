import { describe, expect, it } from "vitest";

import {
  validateBookmarkCreateVisibility,
  validateBookmarkUpdateVisibility,
} from "@/services/bookmarkVisibility";

describe("bookmark visibility validation", () => {
  it("rejects create payloads that set both is_vaulted and is_public to true", () => {
    expect(() =>
      validateBookmarkCreateVisibility({
        is_vaulted: true,
        is_public: true,
      }),
    ).toThrow(/is_vaulted and is_public cannot both be true/i);
  });

  it("allows create payloads when is_vaulted and is_public are not both true", () => {
    expect(() =>
      validateBookmarkCreateVisibility({
        is_vaulted: true,
        is_public: false,
      }),
    ).not.toThrow();
  });

  it("rejects update flow when current bookmark is public and update sets is_vaulted to true", () => {
    expect(() =>
      validateBookmarkUpdateVisibility(
        { is_public: true, is_vaulted: false },
        { is_vaulted: true },
      ),
    ).toThrow(/is_vaulted and is_public cannot both be true/i);
  });

  it("rejects update payloads that set both is_vaulted and is_public to true", () => {
    expect(() =>
      validateBookmarkUpdateVisibility(
        { is_public: false, is_vaulted: false },
        { is_vaulted: true, is_public: true },
      ),
    ).toThrow(/is_vaulted and is_public cannot both be true/i);
  });

  it("allows update flow when merged visibility stays mutually exclusive", () => {
    expect(() =>
      validateBookmarkUpdateVisibility(
        { is_public: true, is_vaulted: false },
        { is_public: false, is_vaulted: true },
      ),
    ).not.toThrow();
  });
});
