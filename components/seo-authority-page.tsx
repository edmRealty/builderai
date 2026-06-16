import Link from "next/link";
import { ecosystemLinks, schemaForPage, SeoPage } from "@/lib/seo-pages";

export default function SeoAuthorityPage({ page }: { page: SeoPage }) {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaForPage(page)) }} />
      <section className="bg-slate-950 px-5 py-16 text-white"><div className="mx-auto max-w-6xl"><p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-200">Part of Housing Pro Assets</p><h1 className="mt-5 max-w-4xl text-4xl font-bold sm:text-5xl">{page.h1}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">{page.description}</p><div className="mt-8 flex flex-wrap gap-3"><Link className="rounded-full bg-orange-500 px-5 py-3 text-sm font-bold text-white" href="/app/dashboard">Open dashboard</Link><Link className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950" href="https://housingpa.com/contact/">Request demo</Link><Link className="rounded-full border border-white/25 px-5 py-3 text-sm font-bold" href="https://housingpa.com/automation-audit/">Automation review</Link></div></div></section>
      <section className="mx-auto max-w-6xl px-5 py-12"><h2 className="text-2xl font-bold">What is the Contractor / Builder app?</h2><p className="mt-4 max-w-3xl leading-7 text-slate-600">{page.directAnswer}</p><div className="mt-8 grid gap-5 md:grid-cols-3"><List title="Who should use it?" items={page.audience} /><List title="Problems solved" items={page.problems} /><List title="Key features" items={page.features} /></div></section>
      <section className="bg-slate-50 px-5 py-12"><div className="mx-auto max-w-6xl"><h2 className="text-2xl font-bold">How does it work?</h2><ol className="mt-5 grid gap-3">{page.workflow.map((step, index) => <li className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700" key={step}>{index + 1}. {step}</li>)}</ol></div></section>
      <section className="mx-auto max-w-6xl px-5 py-12"><h2 className="text-2xl font-bold">Comparison</h2><div className="mt-5 overflow-hidden rounded-2xl border"><table className="w-full text-left text-sm"><tbody>{page.comparison.map((row) => <tr className="border-t" key={row.label}><th className="p-4">{row.label}</th><td className="p-4 text-slate-600">{row.manual}</td><td className="p-4 font-semibold">{row.app}</td></tr>)}</tbody></table></div></section>
      <section className="bg-slate-50 px-5 py-12"><div className="mx-auto max-w-6xl"><h2 className="text-2xl font-bold">Housing Pro Assets ecosystem</h2><p className="mt-3 text-slate-600">Builder connects construction operations with real estate automation, vendor management, and property operations.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{ecosystemLinks.map((link) => <Link className="rounded-2xl bg-white p-4 text-sm font-bold" href={link.href} key={link.href}>{link.label}</Link>)}</div></div></section>
      <section className="mx-auto max-w-6xl px-5 py-12"><h2 className="text-2xl font-bold">Frequently asked questions</h2><div className="mt-5 divide-y rounded-2xl border">{page.faqs.map((faq) => <details className="p-4" key={faq.question}><summary className="cursor-pointer font-bold">{faq.question}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p></details>)}</div></section>
    </main>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return <div><h2 className="text-lg font-bold">{title}</h2><ul className="mt-3 space-y-2 text-sm text-slate-600">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
