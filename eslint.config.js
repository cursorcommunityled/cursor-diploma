//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  { ignores: [".output/**", ".vercel/**", "node_modules/**", "dist/**"] },
  ...tanstackConfig,
];
