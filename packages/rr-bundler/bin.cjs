#!/usr/bin/env node

let start = process.hrtime();
let KnownError;
import("./rr-bundler.mjs")
  .then((mod) => {
    KnownError = mod.KnownError;
    const end = process.hrtime(start);
    const time = (end[0] > 0 ? `${end[0]}s ` : "") + `${end[1] / 1000000}ms`;
    console.info(`initialized ${time}`);

    start = process.hrtime();
    return mod;
  })
  .then((mod) => mod.run(process.argv.slice(2)))
  .then(() => {
    const end = process.hrtime(start);
    const time = (end[0] > 0 ? `${end[0]}s ` : "") + `${end[1] / 1000000}ms`;
    console.info(`executed in ${time}`);
  })
  .catch((reason) => {
    if (KnownError && reason && reason instanceof KnownError) {
      console.error(reason.message);
    } else {
      console.error(reason);
    }
    process.exit(1);
  });
