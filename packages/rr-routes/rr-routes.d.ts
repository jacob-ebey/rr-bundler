import { type ComponentType } from "react";
import {
  type ActionFunction,
  type AgnosticDataRouteObject,
  type LoaderFunction,
  type ShouldRevalidateFunction,
} from "@remix-run/router";
import { type DataRouteObject } from "react-router-dom";

interface RouteModule {
  action?: ActionFunction;
  default?: ComponentType;
  ErrorBoundary?: ComponentType;
  handle?: unknown;
  loader?: LoaderFunction;
  shouldRevalidate?: ShouldRevalidateFunction;
}

export type RouteDefinition =
  | ({
      id: string;
      module: () => Promise<RouteModule>;
      path?: string;
      caseSensitive?: boolean;
      " _ex"?: [];
    } & (
      | {
          index: true;
          children?: undefined;
        }
      | {
          children?: RouteDefinition[];
        }
    ))
  | (Omit<DataRouteObject, "children"> & {
      children?: RouteDefinition[];
    });

export function defineRoutes(
  routes: RouteDefinition[]
): AgnosticDataRouteObject[];
