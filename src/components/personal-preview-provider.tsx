"use client";
import { createContext, useContext, useState } from "react";
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
}: {
  children: React.ReactNode;
  initialProfile?: PreviewProfile;
}) {
  const [profile, setProfile] = useState<PreviewProfile>(
    initialProfile ?? {
      nickname: "June",
      thaiName: "จูน",
      department: "Computer Engineering",
    },
  );
  const [timetable, setTimetable] = useState<Friend>({
    id: "private-import-preview",
    nickname: initialProfile?.nickname ?? "June",
    thaiName: initialProfile?.thaiName ?? "จูน",
    department: initialProfile?.department ?? "",
    initials: initialProfile?.nickname[0] ?? "J",
    avatar: 0,
    sessions: [],
    published: false,
    semester: { name: "", start: "", end: "" },
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
