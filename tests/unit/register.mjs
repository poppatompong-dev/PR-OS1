// Lets `node --test` load the app's TypeScript modules directly: Node 22
// strips the types, and this hook resolves the "@/..." path alias from
// tsconfig.json to src/ (adding the .ts extension Node needs).
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { pathToFileURL } from "node:url";
      import { existsSync } from "node:fs";
      import path from "node:path";
      const src = path.resolve(process.cwd(), "src");
      export async function resolve(specifier, context, next) {
        if (specifier.startsWith("@/")) {
          const base = path.join(src, specifier.slice(2));
          for (const candidate of [base + ".ts", base + ".tsx", path.join(base, "index.ts")]) {
            if (existsSync(candidate)) return next(pathToFileURL(candidate).href, context);
          }
        }
        return next(specifier, context);
      }
    `),
  import.meta.url,
);
