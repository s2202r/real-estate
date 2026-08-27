import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint flat config.
 *
 * `eslint-config-next` v16 ships flat configs, so they are imported directly
 * rather than bridged through FlatCompat.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "coverage/**",
      "next-env.d.ts",
      "supabase/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // The domain layer must stay free of I/O so that it remains deterministic
    // and testable. Enforced here, not merely documented in ARCHITECTURE.md.
    files: ["src/lib/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react",
                "@/lib/supabase/*",
                "@/lib/providers/*",
                "@/lib/services/*",
                "server-only",
              ],
              message:
                "lib/domain must stay pure: no framework, database or provider imports.",
            },
          ],
        },
      ],
    },
  },
  {
    // Tests may reach for anything.
    files: ["src/**/__tests__/**/*.ts", "src/**/*.test.ts"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default eslintConfig;
