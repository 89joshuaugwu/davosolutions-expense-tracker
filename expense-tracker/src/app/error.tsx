"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="center-page"><div className="panel state-panel"><p className="eyebrow">SOMETHING WENT WRONG</p><h1>We couldn’t load this page.</h1><p>Try again. If this continues, contact your administrator.</p><button className="button primary" onClick={reset}>Try again</button></div></main>;
}
