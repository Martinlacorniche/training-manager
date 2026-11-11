/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le commit mis en ligne (Netlify le donne au build), joint aux rapports
  // d'erreur (src/lib/erreurs.ts) pour savoir quelle version a planté.
  env: { NEXT_PUBLIC_BUILD_ID: (process.env.COMMIT_REF ?? "local").slice(0, 7) },
};

export default nextConfig;
