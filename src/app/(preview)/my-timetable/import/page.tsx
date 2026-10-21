import type { Metadata } from "next";
import { PersonalImport } from "@/components/my-timetable";
import { requireSharedAccess } from "@/lib/auth/access";
export const metadata: Metadata = { title: "Update timetable" };
export default async function Page() {
  await requireSharedAccess();
  return <PersonalImport />;
}
