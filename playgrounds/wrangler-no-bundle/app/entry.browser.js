import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import routes from "./routes.js";

const router = createBrowserRouter(routes);

ReactDOM.hydrateRoot(
  document,
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(RouterProvider, { router, fallbackElement: null })
  )
);
