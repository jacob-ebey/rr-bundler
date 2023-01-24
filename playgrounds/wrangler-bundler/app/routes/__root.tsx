import * as React from "react";
import {
  isRouteErrorResponse,
  type StaticHandlerContext,
} from "@remix-run/router";
import { Outlet, UNSAFE_DataRouterContext } from "react-router-dom";

export default function Root() {
  const context = React.useContext(UNSAFE_DataRouterContext);

  let hydrateScript = "";
  if (context) {
    if (context.staticContext) {
      const data = {
        loaderData: context.staticContext.loaderData,
        actionData: context.staticContext.actionData,
        errors: serializeErrors(context.staticContext.errors),
      };
      // Use JSON.parse here instead of embedding a raw JS object here to speed
      // up parsing on the client.  Dual-stringify is needed to ensure all quotes
      // are properly escaped in the resulting string.  See:
      //   https://v8.dev/blog/cost-of-javascript-2019#json
      const json = JSON.stringify(JSON.stringify(data));
      hydrateScript = `window.__staticRouterHydrationData = JSON.parse(${json});`;
    }
  }

  return (
    <html>
      <head>
        <title>Remix Playground</title>
      </head>
      <body>
        <Outlet />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: hydrateScript }}
        />
        <script type="module" src="/build/entry.browser.js" />
      </body>
    </html>
  );
}

function serializeErrors(
  errors: StaticHandlerContext["errors"]
): StaticHandlerContext["errors"] {
  if (!errors) return null;
  let entries = Object.entries(errors);
  let serialized: StaticHandlerContext["errors"] = {};
  for (let [key, val] of entries) {
    // Hey you!  If you change this, please change the corresponding logic in
    // deserializeErrors in react-router-dom/index.tsx :)
    if (isRouteErrorResponse(val)) {
      serialized[key] = { ...val, __type: "RouteErrorResponse" };
    } else if (val instanceof Error) {
      // Do not serialize stack traces from SSR for security reasons
      serialized[key] = {
        message: val.message,
        __type: "Error",
      };
    } else {
      serialized[key] = val;
    }
  }
  return serialized;
}
