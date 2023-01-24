/// <reference types="@cloudflare/workers-types" />

import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import { createStaticHandler } from "@remix-run/router";
import {
  createStaticRouter,
  StaticRouterProvider,
} from "react-router-dom/server";

import {
  getAssetFromKV,
  NotFoundError,
  MethodNotAllowedError,
} from "@cloudflare/kv-asset-handler";
// @ts-expect-error
import manifestJSON from "__STATIC_CONTENT_MANIFEST";

import routes from "./routes";

const assetManifest = JSON.parse(manifestJSON);

const staticHandler = createStaticHandler(routes);

export default {
  async fetch(request, env, ctx) {
    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      if (e instanceof NotFoundError) {
      } else if (e instanceof MethodNotAllowedError) {
      } else {
        return new Response("An unexpected error occurred", { status: 500 });
      }
    }

    let context = await staticHandler.query(request as unknown as Request);

    if (context instanceof Response) {
      return context;
    }

    const router = createStaticRouter(routes, context);

    const body = await renderToReadableStream(
      <React.StrictMode>
        <StaticRouterProvider
          context={context}
          hydrate={false}
          router={router}
        />
      </React.StrictMode>
    );

    const headers = new Headers();
    headers.set("Content-Type", "text/html");
    return new Response(body, { status: context.statusCode, headers });
  },
} satisfies ExportedHandler<{ __STATIC_CONTENT: unknown }>;
