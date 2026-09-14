const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  Module = require("node:module");
module.exports = function loader(overrides = {}) {
  const loaded = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename, module);
    mod.paths = module.paths;
    loaded.set(filename, mod);
    mod.require = (id) => {
      if (id in overrides) return overrides[id];
      if (id.startsWith("@/"))
        return load(path.join("src", id.slice(2)) + ".ts");
      if (id.startsWith("."))
        return load(path.resolve(path.dirname(filename), id) + ".ts");
      return require(id);
    };
    mod._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      }).outputText,
      filename,
    );
    return mod.exports;
  }
  return load;
};
