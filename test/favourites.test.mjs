import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute, pruneFavourites, toggleFavourite } from "../src/core.ts";

test("parseRoute reads the canonical view names", () => {
  assert.deepEqual(parseRoute("#predict"), { view: "predict", arg: "" });
  assert.deepEqual(parseRoute("#institutes"), { view: "institutes", arg: "" });
  assert.deepEqual(parseRoute("#institute/iit-bombay"), { view: "institute", arg: "iit-bombay" });
  assert.deepEqual(parseRoute("#syllabus"), { view: "syllabus", arg: "" });
  assert.deepEqual(parseRoute("#ranks/pwd"), { view: "ranks", arg: "pwd" });
});

test("parseRoute accepts the short forms the tabs actually write", () => {
  /* these two used to fall through to the predictor and render nothing */
  assert.deepEqual(parseRoute("#syl"), { view: "syllabus", arg: "" });
  assert.deepEqual(parseRoute("#inst"), { view: "institutes", arg: "" });
  assert.deepEqual(parseRoute("#rank"), { view: "ranks", arg: "" });
});

test("an empty or unknown hash lands on the syllabus front page", () => {
  assert.deepEqual(parseRoute(""), { view: "syllabus", arg: "" });
  assert.deepEqual(parseRoute("#"), { view: "syllabus", arg: "" });
  assert.deepEqual(parseRoute("#nonsense"), { view: "syllabus", arg: "" });
});

test("parseRoute decodes a slug with percent escapes", () => {
  assert.deepEqual(parseRoute("#institute/a%20b"), { view: "institute", arg: "a b" });
});

test("toggleFavourite adds, then removes, without touching other entries", () => {
  const one = toggleFavourite([], "IIT Bombay");
  assert.deepEqual(one.map(f => f.name), ["IIT Bombay"]);
  const two = toggleFavourite(one, "NIT Trichy");
  assert.deepEqual(two.map(f => f.name), ["IIT Bombay", "NIT Trichy"]);
  assert.deepEqual(toggleFavourite(two, "IIT Bombay").map(f => f.name), ["NIT Trichy"]);
});

test("toggleFavourite refuses past the cap of 20", () => {
  const full = Array.from({ length: 20 }, (_, i) => ({ name: "I" + i, addedAt: i }));
  assert.equal(toggleFavourite(full, "one more").length, 20);
});

test("pruneFavourites drops names the dataset no longer has", () => {
  const { kept, removed } = pruneFavourites(
    [{ name: "Gone Institute" }, { name: "IIT Bombay" }], new Set(["IIT Bombay"]));
  assert.deepEqual(kept.map(f => f.name), ["IIT Bombay"]);
  assert.deepEqual(removed, ["Gone Institute"]);
});
