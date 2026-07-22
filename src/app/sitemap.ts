import type { MetadataRoute } from "next";

// Déclare à Google les pages PUBLIques à indexer (les seules qui ont du sens en
// recherche). Les pages appli (login/dashboards) sont volontairement exclues via robots.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://ngsportcoaching.com";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
