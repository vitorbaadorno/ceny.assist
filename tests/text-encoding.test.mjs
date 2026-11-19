import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
test("application messages have valid UTF-8 without double encoding", () => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const walk = (root) =>
    fs.readdirSync(root, { withFileTypes: true }).flatMap((e) => {
      const file = path.join(root, e.name);
      return e.isDirectory() ? walk(file) : /\.(ts|tsx)$/.test(file) ? [file] : [];
    });
  for (const file of [...walk("src"), ...walk("supabase/functions")]) {
    const text = decoder.decode(fs.readFileSync(file));
    assert.ok(
      !/Ã(?:ƒ|[\u0080-\u00bf])|Â[\u0080-\u00bf]|â€|\uFFFD/.test(text),
      `Invalid message encoding: ${file}`,
    );
  }
});
