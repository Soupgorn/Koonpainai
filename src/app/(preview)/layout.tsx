import { requireMember } from "@/lib/auth/access";
import { isUiPreviewEnabled } from "@/lib/preview";
export const dynamic = "force-dynamic";
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isUiPreviewEnabled()) await requireMember();
  return children;
}
