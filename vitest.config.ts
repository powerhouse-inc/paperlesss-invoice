import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    globals: true,
    // Hand-authored reducer suites live in `tests/reducers/**` because
    // `ph generate` rewrites every top-level `tests/<module>.test.ts` scaffold
    // from scratch on each run (it never loads the existing file), which would
    // wipe hand-written tests. The regenerated stubs are therefore excluded
    // from the run; the auto-generated `attachments.test.ts` stub is also
    // inherently broken (zocker can't mock the AttachmentRef `z.custom` schema).
    // `document-model.test.ts` is regenerated too but passes, so we keep it.
    include: [
      "document-models/**/tests/reducers/**/*.test.ts",
      "document-models/**/tests/document-model.test.ts",
      "document-models/**/tests/schema/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["document-models/**/src/reducers/**"],
      thresholds: {
        lines: 95,
        branches: 95,
        functions: 95,
        statements: 95,
      },
    },
  },
  plugins: [tsconfigPaths()],
});
