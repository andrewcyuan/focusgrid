import { defineConfig } from "tsdown";

export default defineConfig({
  cwd: process.cwd(),
  sourcemap: false,
  dts: {
    sourcemap: false,
    compilerOptions: {
      declarationMap: false,
    },
  },
  fixedExtension: false,
  outExtensions({ format }) {
    if (format === "cjs") {
      return {
        js: ".cjs",
        dts: ".d.cts",
      };
    }

    return {
      js: ".js",
      dts: ".d.ts",
    };
  },
});
