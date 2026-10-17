// All configuration comes from environment variables (see .env.example).
// Every source is optional: if its variables are missing, that card just shows "not set up".

const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() !== "" ? v.trim() : undefined;
};
const num = (k: string, d: number) => {
  const v = env(k);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
};
const list = (k: string) =>
  (env(k) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const age = num("AGE", 19);

export const cfg = {
  appName: env("APP_NAME") ?? "Pulse",
  ownerName: env("OWNER_NAME") ?? "Jamie",
  tz: env("TIMEZONE") ?? "Australia/Melbourne",
  appUrl: (env("APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  demo: env("DEMO_MODE") === "1",

  // Access control: one password, one person.
  password: env("DASHBOARD_PASSWORD"),
  sessionSecret: env("SESSION_SECRET"),

  // Body numbers used by the strain model.
  body: {
    age,
    hrMax: num("HR_MAX", Math.round(208 - 0.7 * age)), // Tanaka formula unless you know your real max
    sex: (env("SEX") ?? "male").toLowerCase() === "female" ? ("female" as const) : ("male" as const),
    baseSleepNeedMin: num("SLEEP_NEED_MIN", 480),
    defaultWake: env("DEFAULT_WAKE") ?? "07:30",
  },

  google: {
    clientId: env("GOOGLE_CLIENT_ID"),
    clientSecret: env("GOOGLE_CLIENT_SECRET"),
    calendarIds: list("GOOGLE_CALENDAR_IDS").length ? list("GOOGLE_CALENDAR_IDS") : ["primary"],
  },

  tanda: {
    token: env("TANDA_TOKEN"),
    base: (env("TANDA_BASE") ?? "https://my.tanda.co/api/v2").replace(/\/$/, ""),
  },

  moodle: { icsUrl: env("MOODLE_ICS_URL") },
  timetable: { icsUrl: env("TIMETABLE_ICS_URL") },

  ed: {
    token: env("ED_TOKEN"),
    base: (env("ED_BASE") ?? "https://au.edstem.org/api").replace(/\/$/, ""),
    web: (env("ED_WEB") ?? "https://edstem.org/au").replace(/\/$/, ""),
    courseIds: list("ED_COURSE_IDS"),
  },

  ontrack: {
    base: env("ONTRACK_BASE")?.replace(/\/$/, ""),
    username: env("ONTRACK_USERNAME"),
    token: env("ONTRACK_AUTH_TOKEN"),
  },

  notion: {
    token: env("NOTION_TOKEN"),
    databaseId: env("NOTION_DATABASE_ID"),
    dateProp: env("NOTION_DATE_PROP") ?? "Due",
    statusProp: env("NOTION_STATUS_PROP") ?? "Status",
    doneValues: (list("NOTION_DONE_VALUES").length ? list("NOTION_DONE_VALUES") : ["Done", "Complete", "Completed"]).map(
      (s) => s.toLowerCase(),
    ),
  },

  github: {
    token: env("GITHUB_TOKEN"),
    repos: list("GITHUB_REPOS"),
  },

  redis: {
    url: env("UPSTASH_REDIS_REST_URL") ?? env("KV_REST_API_URL"),
    token: env("UPSTASH_REDIS_REST_TOKEN") ?? env("KV_REST_API_TOKEN"),
  },
};

export const isProd = process.env.NODE_ENV === "production";
