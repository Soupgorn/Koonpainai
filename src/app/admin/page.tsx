import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getFriends } from "@/lib/friends-repository";
import { isUiPreviewEnabled } from "@/lib/preview";
export const metadata: Metadata = { title: "Admin" };
export default async function AdminPage() {
  return (
    <AdminDashboard
      initialFriends={await getFriends()}
      sample={isUiPreviewEnabled()}
    />
  );
}
