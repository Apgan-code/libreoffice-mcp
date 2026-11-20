const path = require("node:path");
require("esbuild-wasm").buildSync({
  entryPoints: [path.join(__dirname, "source.cjs")],
  nodePaths: require.resolve.paths("zod"),
  outfile: path.join(__dirname, "..", "server.cjs"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  legalComments: "eof"
});
