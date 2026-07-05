// Tiny JSON templating engine.
//
// Any string in a JSON file may contain `${ <expression> }` placeholders which
// are evaluated and substituted in place. Inside an expression you can use:
//
//   this            - the object that directly contains this string
//   super           - the parent of `this`
//   sha1(path)      - sha1 hex digest of the file the given path points at
//
// A path starting with `/` is resolved from the root of the data folder (the
// built site root). `this` / `super` resolve *sibling* values lazily, so
// `${sha1(this.path)}` hashes whatever the neighbouring `path` field points to.
//
// Adding a new variable or function is a one-liner in `buildScope` below.
//
// Usage:
//   node scripts/template.js <siteRoot>   # process every *.json under siteRoot
//
// It is idempotent: strings without `${...}` are left untouched.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function buildScope(opts) {
  const { siteRoot } = opts;

  // Resolve a `/`-rooted path against the data/site root and return the sha1
  // hex digest of that file.
  function sha1(target) {
    const rel = String(target).replace(/^\/+/, "");
    const file = path.join(siteRoot, rel);
    return crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
  }

  // Variables are plain values; functions are, well, functions. Extend freely.
  return {
    vars: {},
    fns: { sha1 },
  };
}

// Resolve every `${...}` in a single string. `self` is the enclosing object
// (exposed as `this`), `parent` is its parent (exposed as `super`).
function resolveString(str, self, parent, scope) {
  return str.replace(/\$\{([\s\S]*?)\}/g, (_, expr) => {
    // `this` and `super` are reserved words, so evaluate against safe aliases.
    const code = expr
      .replace(/\bthis\b/g, "__this")
      .replace(/\bsuper\b/g, "__super");
    const names = ["__this", "__super", ...Object.keys(scope.vars), ...Object.keys(scope.fns)];
    const values = [self, parent, ...Object.values(scope.vars), ...Object.values(scope.fns)];
    // eslint-disable-next-line no-new-func
    const fn = new Function(...names, `"use strict"; return (${code});`);
    const result = fn(...values);
    return result === undefined || result === null ? "" : String(result);
  });
}

// Wrap a node in a Proxy so that reading a property lazily resolves that
// child's templates, giving `this.x` / `super.x` access to resolved siblings.
function wrap(node, parent, scope) {
  if (node === null || typeof node !== "object") return node;
  const proxy = new Proxy(node, {
    get(target, prop) {
      const val = target[prop];
      if (typeof val === "string") return resolveString(val, proxy, parent, scope);
      if (val !== null && typeof val === "object") return wrap(val, proxy, scope);
      return val;
    },
  });
  return proxy;
}

// Produce a fully-resolved plain copy of `node`.
function materialize(node, parent, scope) {
  if (node === null || typeof node !== "object") return node;
  const self = wrap(node, parent, scope);
  const each = (val) =>
    typeof val === "string"
      ? resolveString(val, self, parent, scope)
      : val !== null && typeof val === "object"
        ? materialize(val, self, scope)
        : val;

  if (Array.isArray(node)) return node.map(each);
  const out = {};
  for (const key of Object.keys(node)) out[key] = each(node[key]);
  return out;
}

function processFile(file, opts) {
  const scope = buildScope(opts);
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  const resolved = materialize(data, null, scope);
  fs.writeFileSync(file, JSON.stringify(resolved, null, 4) + "\n");
}

function walkJson(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJson(full, out);
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

module.exports = { processFile, materialize, buildScope };

if (require.main === module) {
  const siteRoot = process.argv[2];
  if (!siteRoot) {
    console.error("Usage: node scripts/template.js <siteRoot>");
    process.exit(1);
  }
  const opts = { siteRoot };
  for (const file of walkJson(siteRoot)) {
    console.log(`Templating ${file}`);
    processFile(file, opts);
  }
}
