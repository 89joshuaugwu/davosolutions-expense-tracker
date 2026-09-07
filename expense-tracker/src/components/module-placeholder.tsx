import Link from "next/link";
import { ArrowLeft, Construction, LockKeyhole } from "lucide-react";
import { navigation, type Section } from "@/lib/navigation";

export function ModulePlaceholder({ section, preview = false }: { section: Section; preview?: boolean }) {
  const item = navigation.find((entry) => entry.key === section)!;
  return <><div className="page-heading"><div><p className="eyebrow">{item.group}</p><h1>{item.label}</h1><p>{item.description}</p></div></div><section className="panel module-placeholder"><span className="empty-icon"><Construction size={28} /></span><span className="badge neutral">Foundation ready</span><h2>This workspace is ready to build on.</h2><p>{preview ? "The visual preview covers the overview and expense register. This module is scheduled in the implementation roadmap." : "Your access has been verified. This module’s forms and data connections are part of the next implementation phases."}</p><div className="placeholder-note"><LockKeyhole size={17} /><span>{preview ? "Sample data is kept separate from your company records." : "No financial data has been loaded or recorded on this page."}</span></div><Link className="button secondary" href={preview ? "/preview" : "/dashboard"}><ArrowLeft size={16} /> Back to overview</Link></section></>;
}
