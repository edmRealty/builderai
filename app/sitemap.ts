import type { MetadataRoute } from "next";
import { appBaseUrl, seoPages } from "@/lib/seo-pages";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", ...Object.values(seoPages).map((page) => `/${page.slug}`)].map((route) => ({ url: `${appBaseUrl}${route}`, lastModified: new Date(), changeFrequency: "monthly", priority: route === "" ? 1 : 0.8 }));
}
