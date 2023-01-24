import * as React from "react";
import { html } from "htm/react";
import { isRouteErrorResponse } from "@remix-run/router";
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

  return html`
    <html>
      <head>
        <title>Remix Playground</title>
      </head>
      <body>
        <${Outlet} />
        <script
          type="importmap"
          dangerouslySetInnerHTML=${{
            __html: JSON.stringify({
              imports: {
                "@remix-run/router":
                  "https://esm.sh/v104/@remix-run/router@1.3.0",
                htm: "https://esm.sh/v104/htm@3.1.1",
                "htm/react": "https://esm.sh/v104/htm@3.1.1/react",
                "react-dom": "https://esm.sh/v104/react-dom@18.2.0",
                "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
                "react-router-dom":
                  "https://esm.sh/v104/react-router-dom@6.7.0",
                react: "https://esm.sh/v104/react@18.2.0",
                "rr-routes": "/copy-do-not-edit-rr-routes.js",
              },
              scopes: {
                "https://esm.sh/v104/": {
                  "loose-envify": "https://esm.sh/v104/loose-envify@1.4.0",
                  "react-router": "https://esm.sh/v104/react-router@6.7.0",
                  scheduler: "https://esm.sh/v104/scheduler@0.23.0",
                },
              },
            }),
          }}
        ></script>

        <link rel="modulepreload" href="/entry.browser.js" />
        <link rel="modulepreload" href="/routes.js" />
        <link rel="modulepreload" href="/routes/__root.js" />

        <link rel="modulepreload" href="/copy-do-not-edit-rr-routes.js" />

        <link rel="modulepreload" href="https://esm.sh/v104/react@18.2.0" />
        <link
          rel="modulepreload"
          href="https://esm.sh/react-dom@18.2.0/client"
        />
        <link
          rel="modulepreload"
          href="https://esm.sh/v104/react-router-dom@6.7.0"
        />
        <link
          rel="modulepreload"
          href="https://esm.sh/stable/react@18.2.0/es2022/react.js"
        />
        <link
          rel="modulepreload"
          href="https://esm.sh/v104/react-dom@18.2.0/es2022/client.js"
        />
        <link
          rel="modulepreload"
          href="https://esm.sh/v104/react-router-dom@6.7.0/es2022/react-router-dom.js"
        />
        <link
          rel="modulepreload"
          href="https://esm.sh/v104/scheduler@0.23.0/es2022/scheduler.js"
        />
        <link
          rel="modulepreload"
          href="https://esm.sh/v104/react-router@6.7.0/es2022/react-router.js"
        />
        <link
          rel="modulepreload"
          href="https://esm.sh/v104/@remix-run/router@1.3.0/es2022/router.js"
        />
        <link rel="modulepreload" href="https://esm.sh/v104/htm@3.1.1/react" />
        <link
          rel="modulepreload"
          href="https://esm.sh/v104/@remix-run/router@1.3.0"
        />
        <link
          rel="modulepreload"
          href="https://esm.sh/v104/htm@3.1.1/es2022/react.js"
        />
        <link
          rel="modulepreload"
          href="https://esm.sh/v104/htm@3.1.1/es2022/htm.js"
        />

        <script
          suppressHydrationWarnings
          dangerouslySetInnerHTML=${{ __html: hydrateScript }}
        ></script>
        <script type="module" src="/entry.browser.js"></script>
      </body>
    </html>
  `;
}

/**
 *
 * @param {import("@remix-run/router").StaticHandlerContext["errors"]} errors
 */
function serializeErrors(errors) {
  if (!errors) return null;
  let entries = Object.entries(errors);
  let serialized = {};
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
