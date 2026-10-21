export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export interface ClassSession {
  id: string;
  code: string;
  name: string;
  section: string;
  day: Day;
  start: string;
  end: string;
  room: string;
  color: number;
}
export interface Semester {
  name: string;
  start: string;
  end: string;
}
export interface Friend {
  id: string;
  nickname: string;
  thaiName: string;
  initials: string;
  department: string;
  avatar: number;
  semester: Semester | null;
  sessions: ClassSession[];
  published: boolean;
  timetable?: { revision: number; updatedAt: string | null; storageReady: boolean };
}
export type AvailabilityKind =
  "in-class" | "free" | "upcoming" | "no-schedule" | "out-of-term";
export interface Occurrence {
  session: ClassSession;
  date: string;
  startsAt: number;
  endsAt: number;
}
export interface Availability {
  kind: AvailabilityKind;
  current: ClassSession[];
  next: Occurrence | null;
  freeAt: string | null;
}
