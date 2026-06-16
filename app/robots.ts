import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/seo-pages";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/api/"] }], sitemap: `${appBaseUrl}/sitemap.xml` };
}
