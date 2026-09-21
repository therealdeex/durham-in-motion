import { test } from "node:test";
import assert from "node:assert/strict";
import { FILE_SPECS, parseWardHeader, readFile } from "../../scripts/lib/read-files.ts";

test('ward headers parse, including the "Ward 15of Scugog" typo', () => {
  assert.deepEqual(parseWardHeader("Ward 4 of Oshawa"), { municipality: "oshawa", wardNumber: 4 });
  assert.deepEqual(parseWardHeader("WARD 1 OF BROCK"), { municipality: "brock", wardNumber: 1 });
  assert.deepEqual(parseWardHeader("Ward 15of Scugog"), { municipality: "scugog", wardNumber: 5 });
  assert.equal(parseWardHeader("Region of Durham"), null);
  assert.equal(parseWardHeader("Pickering"), null);
});

test("every data label in every archived file resolves (coverage)", () => {
  const failures: string[] = [];
  for (const spec of FILE_SPECS) {
    const { unresolved } = readFile(spec);
    for (const label of unresolved) failures.push(`${spec.path}: ${label}`);
  }
  assert.deepEqual(failures, []);
});

test("expected geographies per file", () => {
  for (const spec of FILE_SPECS) {
    const { geography } = readFile(spec);
    const region = geography.find((g) => g.type === "region");
    assert.ok(region, `${spec.path} missing region column`);
    if (spec.geographyType === "municipality") {
      assert.equal(geography.length, 9, `${spec.path}: region + 8 municipalities`);
    } else {
      assert.ok(geography.length > 20, `${spec.path}: expected many wards`);
      for (const g of geography) {
        if (g.type === "ward") assert.ok(g.id.match(/-ward-\d+$/), `bad ward id ${g.id}`);
      }
    }
  }
});
