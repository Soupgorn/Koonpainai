import type { Metadata } from "next";
import { ImportWorkflow } from "@/components/import-workflow";
export const metadata: Metadata = { title: "Import a timetable" };
export default function ImportPage() {
  return <ImportWorkflow />;
}
