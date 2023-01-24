import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import { createStaticHandler } from "@remix-run/router";
import {
  createStaticRouter,
  StaticRouterProvider,
} from "react-router-dom/server";

import routes from "../app/routes.js";

const staticHandler = createStaticHandler(routes);

/** @type {import("@cloudflare/workers-types").PagesFunction<{}>} */
async function onRequest({ request }) {
  let context = await staticHandler.query(request);

  if (context instanceof Response) {
    return context;
  }

  const router = createStaticRouter(routes, context);

  const body = await renderToReadableStream(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(StaticRouterProvider, {
        context,
        hydrate: false,
        router,
      })
    )
  );

  const headers = new Headers();
  headers.set("Content-Type", "text/html");

  return new Response(body, { status: context.statusCode, headers });
}

export { onRequest };
