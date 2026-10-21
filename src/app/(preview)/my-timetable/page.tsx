import type { Metadata } from "next";
import { MyTimetable } from "@/components/my-timetable";
import { requireSharedAccess } from "@/lib/auth/access";
export const metadata: Metadata = { title: "My Timetable" };
export default async function Page() {
  await requireSharedAccess();
  return <MyTimetable />;
}
