import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

const dir = path.dirname(fileURLToPath(import.meta.url));
const cacheTemplates = process.env.NODE_ENV === "production";

const brand = {
  name: "LawFlow",
  tagline: "Smart Case Filing System",
  color: "#01411c",
  supportLine: "This is an automated LawFlow security email. Do not share OTPs or passwords with anyone."
};

const compiled = new Map();

function compileTemplate(name) {
  const source = fs.readFileSync(path.join(dir, `${name}.html`), "utf8");
  return Handlebars.compile(source);
}

function getTemplate(name) {
  if (cacheTemplates && compiled.has(name)) return compiled.get(name);
  const fn = compileTemplate(name);
  if (cacheTemplates) compiled.set(name, fn);
  return fn;
}

export function renderEmail(name, vars = {}) {
  const template = getTemplate(name);
  return template({
    ...vars,
    brand: { ...brand, logoUrl: process.env.EMAIL_LOGO_URL?.trim() || null }
  });
}
