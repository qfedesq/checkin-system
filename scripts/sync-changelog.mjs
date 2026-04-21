#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve("src/content/changelog.mdx");
const out = resolve("CHANGELOG.md");
const raw = readFileSync(src, "utf8");
// Strip export statements / imports so CHANGELOG.md renders clean on GitHub
const cleaned = raw.replace(/^(import|export)[^\n]*\n?/gm, "").trimStart();
writeFileSync(out, cleaned);
console.log(`CHANGELOG.md regenerado desde ${src}`);
