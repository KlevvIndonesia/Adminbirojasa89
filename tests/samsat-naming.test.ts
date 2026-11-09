import { test } from "node:test";
import assert from "node:assert";
import { normalizeSamsatOfficeName as normalizeClient } from "../src/domain/pricing/samsatNaming";
import { normalizeSamsatOfficeName as normalizeServer } from "../server/src/utils/samsatNaming";

test("Samsat Naming Convention: City (Kota) formatting", () => {
  const cases = [
    { input: "Bogor", jenis: "Kota", expected: "Samsat Kota Bogor" },
    { input: "Samsat Bogor", jenis: "Kota", expected: "Samsat Kota Bogor" },
    { input: "Kota Bogor", jenis: "Kota", expected: "Samsat Kota Bogor" },
    { input: "Samsat Kota Bogor", jenis: "Kota", expected: "Samsat Kota Bogor" },
    { input: "Depok", jenis: "Kota", expected: "Samsat Kota Depok" },
    { input: "Samsat Depok", jenis: "Kota", expected: "Samsat Kota Depok" },
    { input: "Bekasi", jenis: "Kota", expected: "Samsat Kota Bekasi" },
    { input: "Samsat Bekasi", jenis: "Kota", expected: "Samsat Kota Bekasi" },
    { input: "Bandung", jenis: "Kota", expected: "Samsat Kota Bandung" },
    { input: "Tangerang", jenis: "Kota", expected: "Samsat Kota Tangerang" },
  ];

  for (const c of cases) {
    assert.strictEqual(normalizeClient(c.input, c.jenis), c.expected, `Client failed for ${c.input}`);
    assert.strictEqual(normalizeServer(c.input, c.jenis), c.expected, `Server failed for ${c.input}`);
  }
});

test("Samsat Naming Convention: Prevent duplicate prefixes", () => {
  const duplicates = [
    { input: "Samsat Kota Kota Bogor", jenis: "Kota", expected: "Samsat Kota Bogor" },
    { input: "Samsat Samsat Kota Depok", jenis: "Kota", expected: "Samsat Kota Depok" },
    { input: "Samsat Samsat Samsat Bekasi", jenis: "Kota", expected: "Samsat Kota Bekasi" },
    { input: "Kota Kota Depok", jenis: "Kota", expected: "Samsat Kota Depok" },
    { input: "Samsat Kota Samsat Depok", jenis: "Kota", expected: "Samsat Kota Depok" },
    { input: "Samsat Kabupaten Kabupaten Bogor", jenis: "Kabupaten", expected: "Samsat Kabupaten Bogor" },
    { input: "Kabupaten Kabupaten Bogor", jenis: "Kabupaten", expected: "Samsat Kabupaten Bogor" },
  ];

  for (const d of duplicates) {
    assert.strictEqual(normalizeClient(d.input, d.jenis), d.expected, `Client failed for ${d.input}`);
    assert.strictEqual(normalizeServer(d.input, d.jenis), d.expected, `Server failed for ${d.input}`);
  }
});

test("Samsat Naming Convention: Preserve Kabupaten and DKI Jakarta conventions", () => {
  const specials = [
    { input: "Bogor", jenis: "Kabupaten", expected: "Samsat Kabupaten Bogor" },
    { input: "Samsat Kabupaten Bogor", jenis: "Kabupaten", expected: "Samsat Kabupaten Bogor" },
    { input: "Kabupaten Bekasi", jenis: "Kabupaten", expected: "Samsat Kabupaten Bekasi" },
    { input: "Samsat Jakarta Timur", jenis: "Kota", expected: "Samsat Jakarta Timur" },
    { input: "Jakarta Selatan", jenis: "Kota", expected: "Samsat Jakarta Selatan" },
    { input: "Samsat Jakarta Pusat", jenis: "Kota", expected: "Samsat Jakarta Pusat" },
  ];

  for (const s of specials) {
    assert.strictEqual(normalizeClient(s.input, s.jenis), s.expected, `Client failed for ${s.input}`);
    assert.strictEqual(normalizeServer(s.input, s.jenis), s.expected, `Server failed for ${s.input}`);
  }
});
