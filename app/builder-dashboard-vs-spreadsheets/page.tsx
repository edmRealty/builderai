import SeoAuthorityPage from "@/components/seo-authority-page";
import { pageMetadata, seoPages } from "@/lib/seo-pages";
const page = seoPages["builder-dashboard-vs-spreadsheets"];
export const metadata = pageMetadata(page);
export default function Page() { return <SeoAuthorityPage page={page} />; }
