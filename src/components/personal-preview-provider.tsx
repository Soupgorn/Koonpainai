"use client";
import { createContext, useContext, useState } from "react";

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
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);
  return (
    <Context.Provider
      value={{
        profile: initialProfile ?? profile,
        setProfile,
        profileCompleted,
        setProfileCompleted,
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
