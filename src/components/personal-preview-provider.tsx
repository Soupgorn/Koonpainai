"use client";
import { createContext, useContext, useState } from "react";
import { friends } from "@/lib/data";
import type { Friend } from "@/lib/types";

type PreviewProfile = {
  nickname: string;
  thaiName: string;
  department: string;
};
type PreviewState = {
  profile: PreviewProfile;
  setProfile: (profile: PreviewProfile) => void;
  profileCompleted: boolean;
  setProfileCompleted: (completed: boolean) => void;
  timetable: Friend;
  setTimetable: (friend: Friend) => void;
  policyAccepted: boolean;
  setPolicyAccepted: (accepted: boolean) => void;
};
const Context = createContext<PreviewState | null>(null);
export function PersonalPreviewProvider({
  children,
  initialProfile,
  fictional = true,
}: {
  children: React.ReactNode;
  initialProfile?: PreviewProfile;
  fictional?: boolean;
}) {
  const [profile, setProfile] = useState<PreviewProfile>(
    initialProfile ?? {
      nickname: "June",
      thaiName: "จูน",
      department: "Computer Engineering",
    },
  );
  const [timetable, setTimetable] = useState<Friend>({
    ...friends[0],
    id: "my-preview",
    nickname: "June",
    thaiName: "จูน",
    initials: "J",
    ...(!fictional
      ? { id: "private-import-preview", sessions: [], published: false }
      : {}),
  });
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);
  return (
    <Context.Provider
      value={{
        profile: initialProfile ?? profile,
        setProfile,
        profileCompleted,
        setProfileCompleted,
        timetable,
        setTimetable,
        policyAccepted,
        setPolicyAccepted,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePersonalPreview() {
  const value = useContext(Context);
  if (!value) throw new Error("Personal preview provider is missing");
  return value;
}
