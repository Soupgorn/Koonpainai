import { requireAdmin } from "@/lib/auth/access";
import { isUiPreviewEnabled } from "@/lib/preview";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isUiPreviewEnabled()) await requireAdmin();
  return children;
}
