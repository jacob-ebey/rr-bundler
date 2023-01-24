import * as fs from "node:fs";
import * as module from "node:module";
import * as path from "node:path";

import * as esbuild from "esbuild";

import { KnownError } from "./errors.mjs";
import { transformsRoutesFile } from "./ts-transforms.mjs";

const builtins = new Set(module.builtinModules);
const moduleExtensions = [".tsx", ".ts", ".jsx", ".js"];

export { KnownError };

/**
 *
 * @param {string[]} argv
 */
export async function run(argv) {
  const cwd = process.cwd();

  let watch = false;
  let port = 3000;
  let proxyParts;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (proxyParts) {
      proxyParts.push(arg);
      continue;
    }

    if (arg === "--watch") {
      watch = true;
    }

    if (arg === "--port") {
      port = Number(argv[++i]);
      if (Number.isNaN(port) || !Number.isSafeInteger(port)) {
        throw new KnownError(`Invalid port: ${argv[i]}`);
      }
    }

    if (arg === "--") {
      proxyParts = [];
    }
  }
  const proxyAddress = proxyParts ? proxyParts.join(" ") : undefined;

  let config;
  try {
    config = readConfig(cwd);
  } catch (cause) {
    if (cause && cause instanceof KnownError) {
      throw cause;
    }
    throw new KnownError("Failed to read config", { cause });
  }

  if (config.browser.entry) {
  }
  /** @type {esbuild.BuildContext} */
  let browserBuildContext;
  /** @type {esbuild.BuildResult} */
  let browserBuildResult;
  /** @type {esbuild.BuildContext} */
  let serverBuildContext;
  /** @type {import("chokidar").FSWatcher} */
  let watcher;

  if (watch) {
    port = await findPort(port);

    const chokidar = await import("chokidar");

    watcher = chokidar
      .watch(
        [config.browser.entry, config.server.output, config.routes].filter(
          Boolean
        ),
        {
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 100,
          },
        }
      )
      .on("error", (error) => console.error(error))
      .on("change", () => {
        if (!browserBuildContext || !serverBuildContext) {
          return;
        }
      });
  }

  try {
    const browserBuildOptions = createBrowserBuildOptions(cwd, config, watcher);
    browserBuildContext = await esbuild.context(browserBuildOptions);
    browserBuildResult = await browserBuildContext.rebuild();

    const serverBuildOptions = createServerBuildOptions(cwd, config, watcher);
    serverBuildContext = await esbuild.context(serverBuildOptions);
    await serverBuildContext.rebuild();
  } catch (reason) {
    if (browserBuildContext) {
      await browserBuildContext.dispose();
    }
    if (serverBuildContext) {
      await serverBuildContext.dispose();
    }
    throw reason;
  }

  if (watch) {
    await new Promise(async (resolve) => {
      /** @type {import("node:http").Server} */
      let server;
      if (proxyAddress) {
        const http = await import("node:http");
        const httpProxy = (await import("http-proxy")).default;
        const mimetype = (await import("mime-types")).lookup;
        const proxy = httpProxy.createProxy({ target: proxyAddress });

        server = http
          .createServer((req, res, next) => {
            console.log(req.url);
            if (browserBuildResult && browserBuildResult.metafile) {
              const outputMap = new Map(
                Object.keys(browserBuildResult.metafile.outputs).map(
                  (outfile) => [
                    config.browser.publicPath +
                      path.relative(
                        config.browser.output,
                        path.resolve(cwd, outfile)
                      ),
                    outfile,
                  ]
                )
              );

              if (outputMap.has(req.url)) {
                const outfile = outputMap.get(req.url);
                res.setHeader("Content-Type", mimetype(outfile));
                res.end(fs.readFileSync(path.resolve(cwd, outfile)));
                return;
              }
            }

            proxy.web(req, res, {}, next);
          })
          .listen(port);
      }

      process.once("SIGINT", async () => {
        if (watcher) {
          await watcher.close();
        }
        if (server) {
          server.close(() => {
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }

  await browserBuildContext.dispose();
  await serverBuildContext.dispose();
}

/**
 * @typedef {{
 *   routes: string;
 *   browser: {
 *     entry?: string;
 *     output: string;
 *     conditions: string[];
 *     mainFields: string[];
 *     externals?: string[];
 *     publicPath: string;
 *   };
 *   server: {
 *     entry: string;
 *     output: string;
 *     conditions?: string[];
 *     mainFields?: string[];
 *     externals?: string[];
 *     outputFormat: "cjs" | "esm";
 *     platform: "node" | "browser" | "neutral";
 *     bundleNodeModules: boolean;
 *   };
 * }} Config
 *
 * @param {string} cwd
 * @returns {Config}
 */
function readConfig(cwd) {
  const packageJsonPath = path.join(cwd, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  let serverModuleFormat = pkg.type === "module" ? "esm" : "cjs";

  const config = Object.assign(
    {
      browser: {},
      server: {},
    },
    pkg["rr-bundler"] || {}
  );

  const appDir = path.join(cwd, "app");

  const routes = config.routes
    ? path.resolve(cwd, config.routes)
    : findFile(appDir, "routes", moduleExtensions);

  if (!routes) {
    throw new KnownError(
      'No routes file found, please create one at `app/routes.ts` or configure it in `package.json` at `"rr-bundler".routes`.'
    );
  }

  const browserEntry = config.browser.entry
    ? path.resolve(cwd, config.browser.entry)
    : findFile(appDir, "entry.browser", moduleExtensions);
  const browserOutput = config.browser.output
    ? path.resolve(cwd, config.browser.output)
    : path.join(cwd, "public", "build");
  const browserConditions = config.browser.conditions;
  const browserMainFields = config.browser.mainFields;
  const browserExternals = config.browser.externals || undefined;
  const publicPath = config.browser.publicPath || "/build/";

  const serverEntry = config.server.entry
    ? path.resolve(cwd, config.server.entry)
    : findFile(appDir, "entry.server", moduleExtensions);
  const serverOutput = config.server.output
    ? path.resolve(cwd, config.server.output)
    : path.join(cwd, "build");
  const serverPlatform = config.server.platform || "node";
  const serverConditions = config.server.conditions;
  const serverMainFields = config.server.mainFields;
  const serverExternals = config.server.externals || undefined;
  const bundleNodeModules = config.server.bundleNodeModules || false;
  const serverOutputFormat = config.server.outputFormat || serverModuleFormat;

  if (!["node", "browser", "neutral"].includes(serverPlatform)) {
    throw new KnownError(
      `Invalid server platform "${serverPlatform}", expected "node", "browser" or "neutral".`,
      {
        location: {
          file: packageJsonPath,
        },
      }
    );
  }

  return {
    routes,
    browser: {
      entry: browserEntry,
      output: browserOutput,
      conditions: browserConditions,
      mainFields: browserMainFields,
      externals: browserExternals,
      publicPath,
    },
    server: {
      entry: serverEntry,
      output: serverOutput,
      conditions: serverConditions,
      mainFields: serverMainFields,
      externals: serverExternals,
      outputFormat: serverOutputFormat,
      platform: serverPlatform,
      bundleNodeModules,
    },
  };
}

/**
 * @param {string} cwd
 * @param {Config} config
 * @returns {import("esbuild").BuildOptions}
 */
function createServerBuildOptions(cwd, config, watcher) {
  /** @type {import("esbuild").Plugin[]} */
  const plugins = [
    watchPlugin(watcher),
    transformRoutesPlugin(config.routes, cwd, true),
  ];

  if (!config.server.bundleNodeModules) {
    plugins.push(nodeExternalsPlugin());
  }

  return {
    absWorkingDir: cwd,
    bundle: true,
    conditions: config.server.conditions,
    entryPoints: [path.relative(cwd, config.server.entry)],
    external: config.server.externals,
    format: config.server.outputFormat,
    mainFields: config.server.mainFields,
    platform: config.server.platform,
    outdir: config.server.output,
    plugins,
    sourcemap: "external",
  };
}

/**
 * @param {string} cwd
 * @param {Config} config
 * @param {boolean} sourceMap
 * @param {import("chokidar").FSWatcher} watcher
 * @returns {import("esbuild").BuildOptions}
 */
function createBrowserBuildOptions(cwd, config, sourceMap, watcher) {
  /** @type {import("esbuild").Plugin[]} */
  const plugins = [
    watchPlugin(watcher),
    transformRoutesPlugin(config.routes, cwd, sourceMap),
  ];

  return {
    absWorkingDir: cwd,
    bundle: true,
    conditions: config.browser.conditions,
    entryPoints: [path.relative(cwd, config.browser.entry)],
    external: config.browser.externals,
    format: "esm",
    mainFields: config.browser.mainFields,
    metafile: true,
    platform: "browser",
    outdir: config.browser.output,
    plugins,
    publicPath: config.browser.publicPath,
    splitting: true,
  };
}

/**
 * @returns {import("esbuild").Plugin}
 */
function nodeExternalsPlugin() {
  return {
    name: "external-modules",
    setup(build) {
      build.onResolve({ filter: /^node:/ }, (args) => ({
        path: args.path,
        external: true,
      }));
      build.onResolve({ filter: /.*/ }, (args) => {
        if (builtins.has(args.path)) {
          return {
            path: args.path,
            external: true,
          };
        }

        // TODO: make sure it's not an asset module type
        if (
          !args.path.startsWith(".") &&
          moduleExtensions.some((ext) => args.path.endsWith(ext))
        ) {
          return {
            path: args.path,
            external: true,
          };
        }
      });
    },
  };
}

/**
 * @param {string} routes
 * @param {boolean} removeServerExports
 * @returns {import("esbuild").Plugin}
 */
function transformRoutesPlugin(routes, cwd, sourceMap) {
  return {
    name: "transform-routes",
    setup(build) {
      build.onLoad({ filter: /.*/ }, async (args) => {
        if (args.path !== routes) {
          return undefined;
        }

        try {
          const sourceCode = fs.readFileSync(args.path, "utf8");

          const contents = transformsRoutesFile(
            sourceCode,
            args.path,
            cwd,
            sourceMap
          );

          return {
            contents,
            loader: path.extname(args.path).slice(1),
            resolveDir: path.dirname(args.path),
          };
        } catch (reason) {
          if (reason instanceof KnownError) {
            return {
              errors: [
                {
                  text: reason.message,
                  detail: reason.cause?.message,
                  location: reason.location,
                },
              ],
            };
          }

          return {
            errors: [
              {
                text: reason.message,
                detail: reason.stack,
              },
            ],
          };
        }
      });
    },
  };
}

/**
 * @param {import("chokidar").FSWatcher} watcher
 * @returns {esbuild.Plugin}
 */
function watchPlugin(watcher) {
  return {
    name: "watcher",
    setup(build) {
      if (watcher) {
        build.onLoad({ filter: /.*/ }, (args) => {
          if (fs.existsSync(args.path)) {
            watcher.add(args.path);
          }
        });
      }
    },
  };
}

/**
 *
 * @param {string} searchDir
 * @param {string} basename
 * @param {string[]} exts
 */
function findFile(searchDir, basename, exts) {
  for (const ext of exts) {
    const filename = path.join(searchDir, basename + ext);
    if (fs.existsSync(filename)) {
      return filename;
    }
  }
  return undefined;
}

/**
 *
 * @param {number} defaultPort
 */
async function findPort(defaultPort) {
  if (await canUsePort(defaultPort)) {
    return defaultPort;
  }

  for (let i = 0; i < 1000; i++) {
    const port = Math.floor(9999 * Math.random());
    if (await canUsePort(port)) {
      return port;
    }
  }
  throw new KnownError("Could not find a free port");
}

/**
 * @param {number} port
 */
async function canUsePort(port) {
  const net = await import("node:net");
  const server = net.createServer();

  const usable = await new Promise((resolve) => {
    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      resolve(true);
    });

    server.listen(port);
  });

  await new Promise((resolve, reject) => {
    server.close((reason) => {
      if (reason) reject(reason);
      else resolve();
    });
  });

  return usable;
}
