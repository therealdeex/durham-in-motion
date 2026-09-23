import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Non-interactive CI gate (audit A09): keep informational, never prompts.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    ignores: ["out/**", "node_modules/**", "public/data/**", "data/**", "shots/**"],
  },
];

export default eslintConfig;
