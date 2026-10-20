import { notFound } from "next/navigation";
import { isUiPreviewEnabled } from "@/lib/preview";
export const dynamic = "force-dynamic";
export default function PreviewLayout({children}:{children:React.ReactNode}) {
  if (!isUiPreviewEnabled()) notFound();
  return children;
}
