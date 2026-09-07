import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><span className="brand-mark"><Image src="/brand/davo-mark.svg" width={34} height={23} alt="" priority /></span>{!compact && <span><strong>Davo<span className="brand-word">Solutions</span></strong><small>EXPENSES & PROFIT</small></span>}</div>;
}
