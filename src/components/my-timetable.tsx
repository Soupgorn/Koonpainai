"use client";
import { usePersonalPreview } from "./personal-preview-provider";
import { FriendProfile } from "./friend-profile";
import { ImportWorkflow } from "./import-workflow";
export function MyTimetable() {
  const { timetable, profile } = usePersonalPreview();
  return (
    <FriendProfile
      friend={{
        ...timetable,
        ...profile,
        initials: profile.nickname[0]?.toUpperCase() || "?",
      }}
      personal
      sample={timetable.id !== "private-import-preview"}
    />
  );
}
export function PersonalImport() {
  const { setTimetable, setProfile, profile } = usePersonalPreview();
  return (
    <ImportWorkflow
      personal
      onUsePreview={(friend) => {
        setTimetable(friend);
        setProfile({ ...profile, nickname: friend.nickname });
      }}
    />
  );
}
