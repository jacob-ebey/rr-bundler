import * as React from "react";

/** @type {import("./rr-routes").defineRoutes} */
export function defineRoutes(routes) {
  const result = routes.map(defineRoute);
  return result;
}

const defaultExportsToUse = new Set([
  "action",
  "default",
  "ErrorBoundary",
  "handle",
  "loader",
  "shouldRevalidate",
]);

/**
 * @param {import("./rr-routes").RouteDefinition} route
 */
function defineRoute(route) {
  const exportsToUse = route._ex ? new Set(route._ex) : defaultExportsToUse;

  /** @type {import("@remix-run/router").AgnosticDataRouteObject} */
  const result = {
    ...route,
    id: route.id,
    path: route.path,
    caseSensitive: route.caseSensitive,
    hasErrorBoundary: exportsToUse.has("ErrorBoundary"),
    index: undefined,
    children: undefined,
    shouldRevalidate: undefined,
    handle: undefined,
  };
  if (route.index) {
    result.index = true;
  } else if (route.children) {
    result.children = route.children.map(defineRoute);
  }

  if (route.module) {
    if (exportsToUse.has("action")) {
      result.action = async (args) => {
        const { action } = await route.module();
        return action(args);
      };
    }

    if (exportsToUse.has("default")) {
      const Component = React.lazy(() => route.module());
      result.element = React.createElement(
        React.Suspense,
        { fallback: null },
        React.createElement(Component)
      );
    }

    if (exportsToUse.has("ErrorBoundary")) {
      const Component = React.lazy(async () => {
        const mod = route.module();
        return { default: mod.ErrorBoundary };
      });
      result.errorElement = React.createElement(
        React.Suspense,
        { fallback: null },
        React.createElement(Component)
      );
    }

    if (
      route.module &&
      (exportsToUse.has("default") ||
        exportsToUse.has("ErrorBoundary") ||
        exportsToUse.has("handle") ||
        exportsToUse.has("loader") ||
        exportsToUse.has("shouldRevalidate"))
    ) {
      result.loader = async (args) => {
        const mod = await route.module();

        if (!result.element && mod.default) {
          result.element = React.createElement(
            React.Suspense,
            { fallback: null },
            React.createElement(mod.default)
          );
        }
        if (!result.errorElement && mod.ErrorBoundary) {
          result.errorElement = React.createElement(
            React.Suspense,
            { fallback: null },
            React.createElement(mod.ErrorBoundary)
          );
        }

        result.handle = mod.handle;
        result.shouldRevalidate = mod.shouldRevalidate;

        return mod.loader ? mod.loader(args) : null;
      };
    }
  }

  return result;
}

/** @type {import("./rr-routes").Scripts} */
export function Scripts() {
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

  return hydrateScript
    ? React.createElement("script", {
        dangerouslySetInnerHTML: { __html: hydrateScript },
        suppressHydrationWarning: true,
      })
    : null;
}
