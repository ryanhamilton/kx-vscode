import { context, build } from "esbuild";

const minify = process.argv.includes("--minify");
const sourcemap = process.argv.includes("--sourcemap");
const keepNames = process.argv.includes("--keep-names");
const watch = process.argv.includes("--watch");

const baseConfig = {
  minify,
  sourcemap,
  keepNames,
  bundle: true,
};

const webviewConfig = {
  ...baseConfig,
  entryPoints: ["./src/webview/main.ts"],
  outfile: "./out/webview.js",
  format: "esm",
  target: "es2020",
  external: ["vscode"],
};

const serverConfig = {
  ...baseConfig,
  entryPoints: ["./server/src/server.ts"],
  outfile: "./out/server.js",
  format: "cjs",
  platform: "node",
  external: ["vscode"],
};

const extensionConfig = {
  ...baseConfig,
  entryPoints: ["./src/extension.ts"],
  outfile: "./out/extension.js",
  format: "cjs",
  platform: "node",
  external: ["vscode"],
};

if (watch) {
  console.log("esbuild:started");
  Promise.all([
    context(webviewConfig),
    context(serverConfig),
    context(extensionConfig),
  ])
    .then((contexts) =>
      Promise.all(contexts.map((ctx) => ctx.rebuild())).finally(() =>
        Promise.all(contexts.map((ctx) => ctx.watch({ delay: 500 })))
          .then(() => console.log("esbuild:watching"))
          .catch((error) => {
            console.error(error);
            process.exit(1);
          }),
      ),
    )
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  Promise.all([
    build(webviewConfig),
    build(serverConfig),
    build(extensionConfig),
  ]).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
