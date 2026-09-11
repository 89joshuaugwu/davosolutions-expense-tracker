import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", ".next-e2e/**", "out/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
  {
    rules: {
      // Downgrade to warning: `any` is used extensively in catch clauses and
      // Firestore boundary code. Fixing all ~80 occurrences requires typed
      // error helpers that can be done incrementally.
      "@typescript-eslint/no-explicit-any": "warn",
      // Unused vars prefixed with _ are intentional (destructuring discards, catch params).
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
      // useCallback+useEffect data loading pattern is used across ~8 components.
      // Functionally correct; migrating to React 19 `use()` is future work.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
