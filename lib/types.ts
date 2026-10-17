export type Band = "green" | "yellow" | "red";

export interface RecoveryResult {
  score: number | null;
  band: Band | null;
  calibrating: boolean;
  components: { hrv: number | null; rhr: number | null; sleep: number | null };
}

export interface HealthData {
  date: string;
  recovery: RecoveryResult & {
    hrv: number | null;
    hrvBaseline: number | null;
    rhr: number | null;
    rhrBaseline: number | null;
    /** Date the HRV/RHR readings came from (may be yesterday if today hasn't synced). */
    dataDate: string | null;
  };
  strain: {
    score: number;
    trimp: number;
    zones: number[]; // minutes in Z1..Z5 (% heart-rate reserve)
    avgHr: number | null;
    peakHr: number | null;
    minutesTracked: number;
  };
  sleep: {
    asleepMin: number;
    inBedMin: number;
    needMin: number;
    performance: number; // 0..1
    efficiency: number | null; // 0..1
    bedtime: string | null;
    wake: string | null;
    stages: { deep: number; light: number; rem: number; awake: number };
    segments: { type: string; start: string; end: string }[];
  } | null;
  steps: number | null;
  workouts: { name: string; start: string; minutes: number; kcal: number | null; avgHr: number | null }[];
  trend: { date: string; recovery: number | null; strain: number | null; sleepHours: number | null }[];
}

export interface TimelineItem {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  source: "calendar" | "tanda" | "timetable";
  location?: string;
}

export interface DueItem {
  id: string;
  title: string;
  due: string;
  source: "moodle" | "ontrack" | "notion" | "ed";
  course?: string;
  status?: string;
  url?: string;
}

export interface InboxData {
  unread: number;
  messages: { id: string; from: string; subject: string; url: string }[];
}

export interface DevItem {
  title: string;
  repo: string;
  number: number;
  url: string;
  draft?: boolean;
  updated: string;
}

export interface DevData {
  login: string;
  myPrs: DevItem[];
  reviewRequests: DevItem[];
  issues: DevItem[];
}

export interface EdData {
  announcements: { id: string; title: string; course: string; at: string; url: string }[];
}

export type SourceState = "ok" | "off" | "error" | "reconnect";

export interface SourceStatus {
  key: string;
  label: string;
  state: SourceState;
  message?: string;
}

export interface Coach {
  headline: string;
  lines: string[];
  tonight: { bedtime: string; wakeAt: string; needMin: number; reason: string } | null;
}

export interface DashboardData {
  generatedAt: string;
  demo: boolean;
  today: string;
  health: HealthData | null;
  coach: Coach | null;
  timeline: { today: TimelineItem[]; tomorrow: TimelineItem[] };
  due: DueItem[];
  inbox: InboxData | null;
  dev: DevData | null;
  ed: EdData | null;
  sources: SourceStatus[];
  google: { connected: boolean; refreshExpiresAt: string | null };
}
