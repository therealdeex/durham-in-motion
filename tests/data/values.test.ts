import { test } from "node:test";
import assert from "node:assert/strict";
import { parseValue } from "../../scripts/lib/values.ts";

test('"*" is suppressed with null value — never zero', () => {
  const v = parseValue("*");
  assert.equal(v.status, "suppressed");
  assert.equal(v.value, null);
});

test('"N/A" is not_available, distinct from suppression', () => {
  const v = parseValue("N/A");
  assert.equal(v.status, "not_available");
  assert.equal(v.value, null);
  assert.notEqual(v.status, "suppressed");
});

test("empty cell is missing", () => {
  assert.equal(parseValue("").status, "missing");
  assert.equal(parseValue(undefined).status, "missing");
});

test("numbers parse, including thousands separators", () => {
  assert.deepEqual(parseValue("247055"), { value: 247055, status: "observed" });
  assert.deepEqual(parseValue(" 1,237 "), { value: 1237, status: "observed" });
});

test("malformed text is missing, not zero", () => {
  assert.equal(parseValue("n/a?").status, "missing");
  assert.equal(parseValue("12O5").status, "missing");
});
