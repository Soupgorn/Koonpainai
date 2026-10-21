import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getFriends } from "@/lib/friends-repository";
import { isUiPreviewEnabled } from "@/lib/preview";
export const metadata: Metadata = { title: "Admin" };
export default async function AdminPage() {
  const friends = await getFriends();
  return isUiPreviewEnabled() ? <AdminDashboard initialFriends={friends} /> : (
    <main id="main" className="main-container admin-page">
      <h1>Timetables</h1>
      <div className="directory-empty">
        <h2>No shared timetables yet</h2>
        <p>Shared timetable storage is not connected. Account access management remains available.</p>
      </div>
    </main>
  );
}
