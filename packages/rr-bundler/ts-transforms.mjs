import * as path from "node:path";

import * as esbuild from "esbuild";
import ts from "typescript";

/**
 *
 * @param {string} sourceCode
 */
export function transformsRoutesFile(sourceCode, filePath, cwd, sourceMap) {
  const { outputText, sourceMapText } = ts.transpileModule(sourceCode, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
    transformers: {
      before: [
        (context) => {
          let definesRouteNode;

          /** @type {ts.Visitor} */
          const visit = (node) => {
            if (
              ts.isImportDeclaration(node) &&
              node.moduleSpecifier.text === "rr-routes"
            ) {
              for (const e of node.importClause.namedBindings.elements) {
                const name = e.propertyName || e.name;
                if (name && name.escapedText === "defineRoutes") {
                  definesRouteNode = e;
                  break;
                }
              }

              return node;
            }

            if (
              definesRouteNode &&
              ts.isCallExpression(node) &&
              node.expression.escapedText ===
                definesRouteNode.symbol.escapedName
            ) {
              if (
                node.arguments.length !== 1 ||
                !ts.isArrayLiteralExpression(node.arguments[0])
              ) {
                const { character, line } = node
                  .getSourceFile()
                  .getLineAndCharacterOfPosition(node.getStart());
                throw new KnownError(
                  `defineRoutes must have one argument that is an array of route definitions.\n\n file:${filePath}`,
                  {
                    location: {
                      file: filePath,
                      line,
                      column: character,
                    },
                  }
                );
              }

              return ts.factory.createCallExpression(
                node.expression,
                node.typeArguments,
                node.arguments.map((arg) => {
                  return ts.factory.createArrayLiteralExpression(
                    transformRoutes(arg.elements, cwd, filePath)
                  );
                })
              );
            }

            // This is not the appropriate place for this. Create a new
            // transform for this in this file and call it somewhere in
            // rr-bundler.
            // if (
            //   removeServerExports &&
            //   (ts.isExportDeclaration(node) ||
            //     ts.isExportAssignment(node) ||
            //     ts.isExportSpecifier(node))
            // ) {
            //   // TODO: Implement removal of server exports
            //   // console.log(node);
            // }

            return ts.visitEachChild(node, (child) => visit(child), context);
          };

          return (node) => ts.visitNode(node, visit);
        },
      ],
    },
    sourceMap,
    mapRoot: cwd,
  });

  return outputText + (sourceMapText || "");
}

/**
 *
 * @param {ts.NodeArray<ts.Expression>} elements
 */
function transformRoutes(elements, projectRoot, filePath) {
  const results = [];

  for (const element of elements) {
    if (!ts.isObjectLiteralExpression(element)) {
      const { character, line } = element
        .getSourceFile()
        .getLineAndCharacterOfPosition(element.getStart());
      throw new KnownError("Route definition must be an object literal", {
        location: {
          file: args.path,
          line,
          column: character,
        },
      });
    }

    const moduleProperty = element.properties.find(
      (p) => p.name.escapedText === "module"
    );
    const properties = [];
    for (const property of element.properties) {
      switch (property.name.escapedText) {
        case "children":
          if (!ts.isPropertyAssignment(property)) {
            const { character, line } = property
              .getSourceFile()
              .getLineAndCharacterOfPosition(property.getStart());
            throw new KnownError(
              "children must be a property assignment if defined",
              {
                location: {
                  file: filePath,
                  line,
                  column: character,
                },
              }
            );
          }

          if (!ts.isArrayLiteralExpression(property.initializer)) {
            const { character, line } = property.initializer
              .getSourceFile()
              .getLineAndCharacterOfPosition(property.initializer.getStart());
            throw new KnownError("children must be an array if defined", {
              location: {
                file: filePath,
                line,
                column: character,
              },
            });
          }

          properties.push(
            ts.factory.createPropertyAssignment(
              "children",
              ts.factory.createArrayLiteralExpression(
                transformRoutes(
                  property.initializer.elements,
                  projectRoot,
                  filePath
                )
              )
            )
          );
          break;
        default:
          properties.push(property);
          break;
      }
    }

    if (moduleProperty) {
      if (!ts.isPropertyAssignment(moduleProperty)) {
        const { character, line } = moduleProperty
          .getSourceFile()
          .getLineAndCharacterOfPosition(moduleProperty.getStart());
        throw new KnownError(
          "a route module must be a property assignment if defined",
          {
            location: {
              file: filePath,
              line,
              column: character,
            },
          }
        );
      }

      if (
        !ts.isArrowFunction(moduleProperty.initializer) ||
        !ts.isCallExpression(moduleProperty.initializer.body) ||
        moduleProperty.initializer.body.expression.kind !==
          ts.SyntaxKind.ImportKeyword ||
        !ts.isStringLiteral(moduleProperty.initializer.body.arguments[0])
      ) {
        const i = moduleProperty.initializer;
        const b = i && i.body;
        const n = b && b.expression;
        const a = b && b.arguments && b.arguments[0];
        const e = a || n || b || i;
        const { character, line } = e
          .getSourceFile()
          .getLineAndCharacterOfPosition(e.getStart());
        throw new KnownError(
          "a route module must be an inline arrow like `() => import('...')` if defined",
          {
            location: {
              file: filePath,
              line,
              column: character,
            },
          }
        );
      }
      const moduleStringLiteral = moduleProperty.initializer.body.arguments[0];

      const buildResult = esbuild.buildSync({
        write: false,
        absWorkingDir: projectRoot,
        entryPoints: {
          entry: path.resolve(path.dirname(filePath), moduleStringLiteral.text),
        },
        bundle: false,
        format: "esm",
        target: "esnext",
        platform: "neutral",
        metafile: true,
      });

      properties.push(
        ts.factory.createPropertyAssignment(
          "_ex",
          ts.factory.createArrayLiteralExpression(
            buildResult.metafile.outputs["entry.js"].exports.map((e) =>
              ts.factory.createStringLiteral(e)
            )
          )
        )
      );
    }

    results.push(ts.factory.createObjectLiteralExpression(properties));
  }

  return results;
}
