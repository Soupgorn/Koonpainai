import Image from "next/image";

export function BrandMark({ className = "" }: { className?: string }) {
  return <Image className={`brand-mark ${className}`} data-brand="penguin" src="/brand/koonpinai-mark.svg" alt="" aria-hidden="true" width={80} height={40} unoptimized />;
}

export function BrandLogo() {
  return <span className="brand-logo" translate="no"><BrandMark /><span>Koonpinai</span></span>;
}

export function AppIcon({ size = 48 }: { size?: number }) {
  return <Image src="/brand/koonpinai-app-icon.svg" alt="Koonpinai" width={size} height={size} unoptimized />;
}
