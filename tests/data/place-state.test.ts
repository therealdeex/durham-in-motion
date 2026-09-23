/**
 * Pure URL-state behaviour for the shared `?place=` owner (lib/place-state.ts).
 * DOM-free — the browser-side store is exercised in the manual/browser
 * verification pass.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlaceUrl, validatePlace, type PlaceRegistry } from "../../lib/place-state.ts";

const REGISTRY: PlaceRegistry = {
  regions: ["durham"],
  municipalities: ["ajax", "whitby", "oshawa"],
  wards: [
    { id: "oshawa-ward-1", municipality: "oshawa" },
    { id: "whitby-ward-3", municipality: "whitby" },
  ],
};

test("validatePlace: region, municipality and ward all resolve", () => {
  assert.deepEqual(validatePlace("durham", REGISTRY), { id: "durham", kind: "region" });
  assert.deepEqual(validatePlace("whitby", REGISTRY), { id: "whitby", kind: "municipality" });
  assert.deepEqual(validatePlace("whitby-ward-3", REGISTRY), {
    id: "whitby-ward-3",
    kind: "ward",
    municipality: "whitby",
  });
});

test("validatePlace: ?place=durham is valid — never silently substituted (A06)", () => {
  const sel = validatePlace("durham", REGISTRY);
  assert.ok(sel);
  assert.equal(sel.kind, "region");
});

test("validatePlace: invalid and missing values yield null, not a fallback", () => {
  assert.equal(validatePlace(null, REGISTRY), null);
  assert.equal(validatePlace("", REGISTRY), null);
  assert.equal(validatePlace("toronto", REGISTRY), null);
  assert.equal(validatePlace("ajax-ward-9", REGISTRY), null);
});

test("buildPlaceUrl: preserves unrelated parameters and the anchor", () => {
  const url = buildPlaceUrl("/", "tab=map&place=ajax", "#your-durham", "whitby");
  assert.equal(url, "/?tab=map&place=whitby#your-durham");
});

test("buildPlaceUrl: clearing removes only place", () => {
  const url = buildPlaceUrl("/index.html", "place=ajax&x=1", "", null);
  assert.equal(url, "/index.html?x=1");
});

test("buildPlaceUrl: no search at all", () => {
  assert.equal(buildPlaceUrl("/", "", "", "ajax"), "/?place=ajax");
  assert.equal(buildPlaceUrl("/", "", "#top", null), "/#top");
});
