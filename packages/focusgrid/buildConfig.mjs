import sharedConfig from "../../tsdown.config.mjs";

export default {
  ...sharedConfig,
  deps: {
    // Keep one runtime and declaration identity for each public entry point.
    // Repeating --deps.never-bundle on the CLI retains only the last value.
    neverBundle: [
      /^@andrewcyuan\/focusgrid\/(core|dom|react)$/,
      /^@andrewcyuan\/shortcut-engine(?:\/|$)/,
      /^react(?:-dom)?(?:\/|$)/,
    ],
  },
};
