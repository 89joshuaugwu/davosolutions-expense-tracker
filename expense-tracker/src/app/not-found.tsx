import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <main className="center-page"><div className="panel state-panel"><p className="eyebrow">404 · PAGE NOT FOUND</p><h1>This page isn’t here.</h1><p>Return to your dashboard to continue.</p><Link className="button primary" href="/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link></div></main>;
}
