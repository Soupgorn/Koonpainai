import { PersonalImport } from "@/components/my-timetable";
import { requireSharedAccess } from "@/lib/auth/access";
export default async function Page() {
  await requireSharedAccess();
  return <PersonalImport />;
}
