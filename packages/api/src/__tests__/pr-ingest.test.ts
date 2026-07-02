process.env.DATABASE_URL = "postgres://dummy/dummy";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { parseClaireRequestId } = await import("../lib/pr-ingest");

describe("parseClaireRequestId helper", () => {
  it("extracts a valid feature request ID", () => {
    const body = "This PR implements claire-request-12345 to fix alignment issues.";
    assert.equal(parseClaireRequestId(body), 12345);
  });

  it("returns null if no match is found", () => {
    const body = "This is a normal PR body with no special tags.";
    assert.equal(parseClaireRequestId(body), null);
  });

  it("handles empty or null/undefined inputs", () => {
    assert.equal(parseClaireRequestId(""), null);
    assert.equal(parseClaireRequestId(null), null);
    assert.equal(parseClaireRequestId(undefined), null);
  });

  it("extracts the first matching ID if multiple matches exist", () => {
    const body = "Fixes claire-request-12 and claire-request-34.";
    assert.equal(parseClaireRequestId(body), 12);
  });
});

console.log("✅ All API PR ingest tests passed.");
