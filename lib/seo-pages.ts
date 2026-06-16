import type { Metadata } from "next";

export const appBaseUrl = "https://builder.housingpa.com";

export type SeoPage = {
  slug: string;
  metaTitle: string;
  description: string;
  h1: string;
  directAnswer: string;
  audience: string[];
  problems: string[];
  features: string[];
  workflow: string[];
  faqs: Array<{ question: string; answer: string }>;
  comparison: Array<{ label: string; manual: string; app: string }>;
};

const faqs = [
  ["What is the Contractor / Builder app?", "The Contractor / Builder app is construction operations software for project tracking, draw requests, permits, inspections, vendors, field coordination, and real estate development workflows."],
  ["Who is it built for?", "It is built for general contractors, builders, real estate developers, project managers, lenders, owners, and construction operations teams."],
  ["How does it connect to Housing Pro Assets?", "It is part of Housing Pro Assets, the ecosystem for real estate AI, automation, maintenance, valuation, offers, brokerage, and construction operations."],
  ["Does it replace a project manager?", "No. It supports structured workflows and reporting while project managers and owners stay in control."],
  ["Can it handle draw requests?", "Yes. The system is designed around project records, vendors, banks, reports, and draw-request coordination."],
  ["Can it help with permits and inspections?", "Yes. It can organize permit, inspection, field status, and documentation workflows."],
  ["Is it for real estate developers?", "Yes. It supports real estate construction and renovation teams that need project visibility and operational control."],
  ["How do I get started?", "Request a demo, open the builder dashboard if you have access, or contact Housing Pro Assets."],
].map(([question, answer]) => ({ question, answer }));

export const seoPages: Record<string, SeoPage> = {
  contractor: {
    slug: "contractor",
    metaTitle: "Contractor Builder Software | Housing Pro Assets",
    description: "Construction project tracking, draw requests, permits, inspections, vendors, and field coordination for real estate teams.",
    h1: "Contractor and builder operations software for real estate projects",
    directAnswer: "The Contractor / Builder app helps real estate construction teams organize projects, vendors, draw requests, permits, inspections, reports, and field coordination in a structured workflow.",
    audience: ["General contractors", "Builders", "Real estate developers", "Project managers", "Construction lenders", "Owners"],
    problems: ["Spreadsheet project tracking", "Draw request confusion", "Permit and inspection gaps", "Vendor coordination delays", "Weak owner reporting"],
    features: ["Project dashboard", "Vendor management", "Bank and draw workflows", "Reports", "Project status controls", "Field coordination"],
    workflow: ["Create a project.", "Add vendors, banks, and stakeholders.", "Track project status.", "Manage draw and report workflow.", "Coordinate permits and inspections.", "Review progress."],
    faqs,
    comparison: [
      { label: "Projects", manual: "Spreadsheet tabs", app: "Project dashboard" },
      { label: "Draws", manual: "Email and attachments", app: "Structured draw workflow" },
      { label: "Vendors", manual: "Separate contact lists", app: "Vendor records and actions" },
    ],
  },
  "builder-dashboard-vs-spreadsheets": {
    slug: "builder-dashboard-vs-spreadsheets",
    metaTitle: "Builder Dashboard vs Spreadsheets",
    description: "Compare construction project dashboards with spreadsheet-based real estate development tracking.",
    h1: "Builder dashboard vs spreadsheets",
    directAnswer: "A builder dashboard centralizes project status, vendors, banks, reports, and draw workflows, while spreadsheets require manual updates and are harder to govern.",
    audience: ["Builders", "Developers", "Project managers", "Owners"],
    problems: ["Version confusion", "Manual reporting", "No role-based workflow", "Hard-to-track draws"],
    features: ["Dashboard", "Project status", "Vendor workflow", "Bank workflow", "Reports"],
    workflow: ["Set up project.", "Add stakeholders.", "Track status.", "Generate reports.", "Coordinate draws."],
    faqs,
    comparison: [
      { label: "Visibility", manual: "Depends on latest spreadsheet", app: "Live dashboard" },
      { label: "Draws", manual: "Manual email chain", app: "Structured workflow" },
      { label: "Roles", manual: "Everyone edits files", app: "Controlled access" },
    ],
  },
  "contractor/philadelphia": {
    slug: "contractor/philadelphia",
    metaTitle: "Philadelphia Contractor Project Software",
    description: "Contractor and builder software for Philadelphia-area real estate construction, renovation, draw, permit, and inspection workflows.",
    h1: "Philadelphia contractor project management for real estate teams",
    directAnswer: "The Builder app supports Philadelphia-area contractors, builders, and developers with project tracking, vendor coordination, draw requests, permits, inspections, and owner reporting.",
    audience: ["Philadelphia contractors", "Developers", "Construction project managers", "Real estate owners"],
    problems: ["Local permit coordination", "Inspection tracking", "Vendor scheduling", "Draw documentation"],
    features: ["Project dashboard", "Permit workflow", "Inspection notes", "Vendor records", "Bank reports"],
    workflow: ["Create local project.", "Add vendors and banks.", "Track permits and inspections.", "Manage reports and draws.", "Review project progress."],
    faqs,
    comparison: [
      { label: "Local projects", manual: "Manual folders", app: "Structured project records" },
      { label: "Inspections", manual: "Calendar notes", app: "Project workflow" },
      { label: "Reports", manual: "One-off PDFs", app: "Dashboard reporting" },
    ],
  },
};

export const ecosystemLinks = [
  ["Housing Pro Assets", "https://housingpa.com/"],
  ["Solutions", "https://housingpa.com/solutions/"],
  ["Automation audit", "https://housingpa.com/automation-audit/"],
  ["Contact", "https://housingpa.com/contact/"],
  ["Contractor", "https://housingpa.com/contractor/"],
  ["Real estate operations", "https://housingpa.com/real-estate-operations/"],
  ["Vendor management", "https://housingpa.com/vendor-management/"],
].map(([label, href]) => ({ label, href }));

export function pageMetadata(page: SeoPage): Metadata {
  const canonical = `${appBaseUrl}/${page.slug}`;
  return { title: { absolute: page.metaTitle }, description: page.description, alternates: { canonical }, openGraph: { title: page.metaTitle, description: page.description, url: canonical, siteName: "Builder by Housing Pro Assets", type: "website" }, twitter: { card: "summary_large_image", title: page.metaTitle, description: page.description } };
}

export function schemaForPage(page: SeoPage) {
  const url = `${appBaseUrl}/${page.slug}`;
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": "https://housingpa.com/#organization", name: "Housing Pro Assets", alternateName: "HousingPA", url: "https://housingpa.com/" },
    { "@type": ["SoftwareApplication", "WebApplication", "Product"], "@id": `${appBaseUrl}/#builder`, name: "Contractor / Builder", applicationCategory: "BusinessApplication", operatingSystem: "Web", provider: { "@id": "https://housingpa.com/#organization" }, description: page.directAnswer },
    { "@type": "ProfessionalService", "@id": `${url}#service`, name: page.h1, provider: { "@id": "https://housingpa.com/#organization" }, description: page.directAnswer },
    { "@type": "WebPage", "@id": `${url}#webpage`, url, name: page.metaTitle, description: page.description, about: { "@id": `${appBaseUrl}/#builder` } },
    { "@type": "FAQPage", "@id": `${url}#faq`, mainEntity: page.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) },
    { "@type": "HowTo", "@id": `${url}#howto`, name: `How ${page.h1} works`, step: page.workflow.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })) }
  ] };
}
