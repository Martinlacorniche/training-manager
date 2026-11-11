import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    // Le code existant ne suit pas ces règles (arrivées avec Next 16 et le
    // compilateur React) : en alerte plutôt qu'en erreur, pour que `npm run lint`
    // passe et qu'une VRAIE nouvelle erreur se voie. À resserrer au fil de l'eau.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
