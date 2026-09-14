import test from "node:test";
import assert from "node:assert/strict";
import { MockClientPluginContext } from "@droposs/plugin-sdk";
import Plugin, {
  EpicScanner,
  collectEpicCandidates,
  parseEpicManifest,
  parseEpicManifests,
  parseLibraryEntries,
} from "../src/index.js";
import {
  absoluteExecutableManifest,
  duplicatePortalManifest,
  fortniteManifest,
  incompleteManifest,
  portalManifest,
} from "./fixtures/epic.js";

test("drop-store-epic registers a store scanner", async () => {
  const ctx = new MockClientPluginContext("drop-store-epic", ["client:library-scan"]);
  await new Plugin().init(ctx);
  assert.equal(ctx.storeScanners.length, 1);
  assert.equal(ctx.storeScanners[0].store, "epic");
});

test("drop-store-epic parses library entries", () => {
  const entries = parseLibraryEntries([{ appid: 570, name: "Dota 2", installdir: "/games/dota" }]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].externalId, "570");
});

test("drop-store-epic scanner maps candidates", async () => {
  const scanner = new EpicScanner(async () => [
    { externalId: "1", title: "Game", installPath: "/games/game" },
  ]);
  const games = await scanner.scan();
  assert.equal(games.length, 1);
  assert.equal(games[0].store, "epic");
});

test("parseEpicManifest parses raw .item JSON", () => {
  const candidate = parseEpicManifest(portalManifest);
  assert.deepEqual(candidate, {
    externalId: "EpicPortalApp",
    title: "Portal",
    installPath: "C:\\Program Files\\Epic Games\\Portal",
    executablePath:
      "C:\\Program Files\\Epic Games\\Portal\\Portal\\Binaries\\Win64\\Portal.exe",
  });
});

test("parseEpicManifest accepts already parsed objects", () => {
  const candidate = parseEpicManifest(JSON.parse(fortniteManifest) as unknown);
  assert.equal(candidate?.externalId, "Fortnite");
  assert.equal(candidate?.executablePath, "D:\\Epic\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe");
});

test("parseEpicManifest keeps absolute launch executables", () => {
  const candidate = parseEpicManifest(absoluteExecutableManifest);
  assert.equal(candidate?.executablePath, "D:\\Other\\relocated.exe");
});

test("parseEpicManifest skips incomplete installs", () => {
  assert.equal(parseEpicManifest(incompleteManifest), null);
});

test("parseEpicManifest rejects malformed manifests", () => {
  assert.equal(parseEpicManifest("not json"), null);
  assert.equal(parseEpicManifest(null), null);
  assert.equal(parseEpicManifest([1, 2]), null);
  assert.equal(parseEpicManifest({}), null);
});

test("parseEpicManifests skips malformed entries and duplicates", () => {
  const candidates = parseEpicManifests([
    portalManifest,
    "not json",
    duplicatePortalManifest,
    fortniteManifest,
  ]);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].externalId, "EpicPortalApp");
  assert.equal(candidates[0].title, "Portal");
  assert.equal(candidates[1].externalId, "Fortnite");
});

test("collectEpicCandidates falls back to pre-scanned entries", () => {
  const candidates = collectEpicCandidates({
    entries: [{ appid: 570, name: "Dota 2", installdir: "/games/dota" }],
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].externalId, "570");
});

test("collectEpicCandidates returns empty when host supplied nothing", () => {
  assert.deepEqual(collectEpicCandidates({}), []);
  assert.deepEqual(collectEpicCandidates({ manifests: [null, "bad"] }), []);
});

test("scan returns empty until the host populates manifests", async () => {
  const ctx = new MockClientPluginContext("drop-store-epic", ["client:library-scan"]);
  await new Plugin().init(ctx);
  const games = await ctx.storeScanners[0].scan();
  assert.deepEqual(games, []);
});

test("scanner consumes host-provided storage snapshot", async () => {
  const ctx = new MockClientPluginContext("drop-store-epic", ["client:library-scan"]);
  await ctx.storage.set("manifests", [portalManifest, incompleteManifest]);
  await new Plugin().init(ctx);
  const games = await ctx.storeScanners[0].scan();
  assert.equal(games.length, 1);
  assert.equal(games[0].externalId, "EpicPortalApp");
  assert.equal(
    games[0].executablePath,
    "C:\\Program Files\\Epic Games\\Portal\\Portal\\Binaries\\Win64\\Portal.exe",
  );
});
