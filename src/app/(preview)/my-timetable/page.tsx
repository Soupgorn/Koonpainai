import { MyTimetable } from "@/components/my-timetable";
import { getMyTimetable } from "@/lib/friends-repository";
import { isUiPreviewEnabled } from "@/lib/preview";
export default async function Page() {
  return (
    <MyTimetable
      friend={await getMyTimetable()}
      sample={isUiPreviewEnabled()}
    />
  );
}
