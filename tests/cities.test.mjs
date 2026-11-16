import test from "node:test";
import assert from "node:assert/strict";
import { searchCities, cityById } from "../src/lib/cities.ts";
test("IBGE autocomplete resolves accents, states and new regional structure without external calls", (t) => {
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw Error("network forbidden");
  });
  assert.ok(searchCities("sao paulo").some((row) => row.label === "São Paulo - SP"));
  assert.deepEqual(cityById("ibge:3550308"), { city: "São Paulo - SP" });
  assert.ok(searchCities("Boa Esperança do Norte").some((row) => row.label.endsWith("MT")));
  assert.equal(searchCities("s").length, 0);
  assert.ok(searchCities("sao").length <= 8);
  assert.throws(() => cityById("https://malicious.invalid"));
  assert.equal(network.mock.callCount(), 0);
});
