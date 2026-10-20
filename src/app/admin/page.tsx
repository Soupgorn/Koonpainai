import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getFriends } from "@/lib/friends-repository";
export const metadata: Metadata = { title: "Manage timetables" };
export default async function AdminPage() {
  return <AdminDashboard initialFriends={await getFriends()} />;
}
