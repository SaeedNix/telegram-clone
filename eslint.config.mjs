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
    // React 19: Add React Compiler ESLint rules
    rules: {
      // React Compiler optimizations
      'react-compiler/react-compiler': 'error',
      // Additional React 19 best practices
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unused-prop-types': 'warn',
    },
  },
];

export default eslintConfig;
