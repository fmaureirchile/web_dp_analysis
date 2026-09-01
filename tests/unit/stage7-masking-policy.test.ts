import { describe, expect, it } from "vitest";

import { requiresMaskingByLabel } from "../../packages/security/src";

describe("stage7 masking policy", () => {
  it("marca labels sensibles con requiresMasking=true", () => {
    expect(requiresMaskingByLabel("HEALTH_DATA")).toBe(true);
    expect(requiresMaskingByLabel("AUTH_SECRET")).toBe(true);
    expect(requiresMaskingByLabel("GOV_IDENTIFIER")).toBe(true);
    expect(requiresMaskingByLabel("CONTACT_DATA")).toBe(true);
    expect(requiresMaskingByLabel("FINANCIAL_DATA")).toBe(true);
  });

  it("mantiene labels no sensibles con requiresMasking=false", () => {
    expect(requiresMaskingByLabel("BEHAVIORAL_DATA")).toBe(false);
    expect(requiresMaskingByLabel("TECHNICAL_DATA")).toBe(false);
    expect(requiresMaskingByLabel("UNCLASSIFIED")).toBe(false);
  });
});
