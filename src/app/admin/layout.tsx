import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only a browser-memory demonstration. A future API must authorize every write on the server.
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.ENABLE_ADMIN_DEMO !== "true"
  )
    notFound();
  return children;
}
