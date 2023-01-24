import * as React from "react";
import { defineRoutes } from "rr-routes";

import * as root from "./routes/__root";

export default defineRoutes([
  {
    id: "root",
    element: React.createElement(root.default),
    children: [
      {
        id: "home",
        index: true,
        module: () => import("./routes/_home"),
      },
      {
        id: "about",
        path: "about",
        module: () => import("./routes/about"),
      },
    ],
  },
]);
