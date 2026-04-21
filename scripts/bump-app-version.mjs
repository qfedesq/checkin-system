#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve("package.json");
const pkg = JSON.parse(readFileSync(file, "utf8"));
const current = Number(pkg.version);
if (!Number.isFinite(current)) {
  console.error(`Invalid version ${pkg.version}`);
  process.exit(1);
}
const next = (current + 0.01).toFixed(2);
pkg.version = next;
writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
console.log(`version: ${current.toFixed(2)} → ${next}`);
