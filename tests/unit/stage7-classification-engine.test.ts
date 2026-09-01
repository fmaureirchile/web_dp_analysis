import { describe, expect, it } from "vitest";

import { classifyDataPoint } from "../../packages/classification/src";

describe("stage7 classification engine", () => {
  it("clasifica dato de salud como HEALTH_DATA", () => {
    const result = classifyDataPoint({
      source: "FORM_FIELD",
      key: "healthCondition",
      valueSample: "diabetes"
    });

    expect(result.label).toBe("HEALTH_DATA");
    expect(result.requiresMasking).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("clasifica secreto de autenticacion como AUTH_SECRET", () => {
    const result = classifyDataPoint({
      source: "COOKIE",
      key: "session_token",
      valueSample: "abc123"
    });

    expect(result.label).toBe("AUTH_SECRET");
    expect(result.requiresMasking).toBe(true);
  });

  it("clasifica contacto como CONTACT_DATA", () => {
    const result = classifyDataPoint({
      source: "FORM_FIELD",
      key: "email",
      valueSample: "john@example.com"
    });

    expect(result.label).toBe("CONTACT_DATA");
    expect(result.requiresMasking).toBe(true);
  });

  it("deja tecnico sin regla como UNCLASSIFIED", () => {
    const result = classifyDataPoint({
      source: "NETWORK_HEADER",
      key: "x-request-id",
      valueSample: "req-1"
    });

    expect(result.label).toBe("UNCLASSIFIED");
    expect(result.requiresMasking).toBe(false);
  });
});
