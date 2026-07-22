import type { MetadataRoute } from "next";

// Dit à Google quoi explorer : on autorise les pages publiques, on exclut les
// pages applicatives (auth / dashboards) — inutiles à indexer et sources des
// "redirections" dans le rapport de couverture.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy"],
      disallow: [
        "/athlete",
        "/coach",
        "/login",
        "/signup",
        "/reset-password",
        "/update-password",
      ],
    },
    sitemap: "https://ngsportcoaching.com/sitemap.xml",
  };
}
