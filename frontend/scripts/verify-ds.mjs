/**
 * Fails CI if the vendored design system drifts from _ds/.
 *
 * The DS is the pixel contract, so a silent edit to styles/ds/ would make
 * "matches the approved design" untrue without anyone noticing. Exactly one
 * difference is permitted: the commented-out Google Fonts @import in
 * colors_and_type.css, which next/font replaces.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const upstream = join(root, "..", "_ds", "localshouts-design-system-019dfd7a-459f-77bb-8f2b-d32d02b3ff35");

const FILES = [
  ["colors_and_type.css", "colors_and_type.css", true],
  ["loaders/loader.css", "loader.css", false],
  ["ui_kits/admin/admin.css", "admin.css", false],
];

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Inter";

let failed = false;
for (const [src, vendored, allowFontDelta] of FILES) {
  const a = readFileSync(join(upstream, src), "utf8").replace(/\r\n/g, "\n");
  let b = readFileSync(join(root, "styles", "ds", vendored), "utf8").replace(/\r\n/g, "\n");

  if (allowFontDelta) {
    // Re-apply the one sanctioned delta before comparing.
    b = b.replace(/\/\* VENDOR DELTA[\s\S]*?\*\//, (block) => {
      const line = block.split("\n").find((l) => l.startsWith(FONT_IMPORT));
      return line ?? block;
    });
  }

  if (a !== b) {
    console.error(`DS drift: styles/ds/${vendored} differs from _ds/${src}`);
    failed = true;
  } else {
    console.log(`ok  styles/ds/${vendored}`);
  }
}

if (failed) {
  console.error("\nThe vendored design system is the pixel contract. Re-sync it, or\nrecord the change as a deliberate delta in scripts/verify-ds.mjs.");
  process.exit(1);
}
console.log("Design system in sync.");
