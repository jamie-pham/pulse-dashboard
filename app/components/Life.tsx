import { fmtTime, relDue } from "@/lib/time";
import type { DevData, DueItem, EdData, InboxData, SourceStatus, TimelineItem } from "@/lib/types";

const SRC_COLOR: Record<string, string> = {
  calendar: "var(--strain)",
  tanda: "var(--orange)",
  timetable: "var(--green)",
  moodle: "var(--orange)",
  ontrack: "var(--red)",
  notion: "var(--text)",
  ed: "var(--sleep)",
};
const SRC_NAME: Record<string, string> = {
  calendar: "Calendar",
  tanda: "Tanda",
  timetable: "Class",
  moodle: "Moodle",
  ontrack: "OnTrack",
  notion: "Notion",
  ed: "Ed",
};

export function Timeline({ today, tomorrow, now }: { today: TimelineItem[]; tomorrow: TimelineItem[]; now: string }) {
  const nowMs = Date.parse(now);
  const row = (e: TimelineItem) => {
    const live = !e.allDay && Date.parse(e.start) <= nowMs && Date.parse(e.end) > nowMs;
    const past = !e.allDay && Date.parse(e.end) <= nowMs;
    return (
      <li key={e.id} className={`${past ? "past" : ""} ${live ? "live" : ""}`}>
        <div className="time">
          {e.allDay ? "all day" : fmtTime(e.start)}
          {!e.allDay && <div className="muted">{fmtTime(e.end)}</div>}
        </div>
        <span className="bar" style={{ background: SRC_COLOR[e.source] }} />
        <div className="li-main">
          <div className="li-title">
            {e.title}
            {live && <span className="pill live-pill">now</span>}
          </div>
          <div className="muted small">
            {SRC_NAME[e.source]}
            {e.location ? ` · ${e.location}` : ""}
          </div>
        </div>
      </li>
    );
  };
  return (
    <section className="card">
      <div className="card-head">
        <h3>Today</h3>
      </div>
      {today.length ? <ul className="timeline">{today.map(row)}</ul> : <p className="muted">Nothing scheduled. Enjoy it.</p>}
      {tomorrow.length > 0 && (
        <>
          <div className="subhead">Tomorrow</div>
          <ul className="timeline">{tomorrow.slice(0, 4).map(row)}</ul>
        </>
      )}
    </section>
  );
}

export function DueCard({ due, now }: { due: DueItem[]; now: string }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>Due soon</h3>
        <span className="muted small">{due.length ? `${due.length} item${due.length > 1 ? "s" : ""}` : ""}</span>
      </div>
      {due.length === 0 ? (
        <p className="muted">Nothing due in the next few weeks.</p>
      ) : (
        <ul className="list">
          {due.map((d) => {
            const r = relDue(d.due, new Date(now));
            const inner = (
              <>
                <span className="dot" style={{ background: SRC_COLOR[d.source] }} />
                <div className="li-main">
                  <div className="li-title">{d.title}</div>
                  <div className="muted small">
                    {[d.course, SRC_NAME[d.source], d.status].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className={`due ${r.urgency}`}>{r.label}</span>
              </>
            );
            return <li key={d.id}>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">{inner}</a> : inner}</li>;
          })}
        </ul>
      )}
    </section>
  );
}

export function InboxCard({ inbox }: { inbox: InboxData }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>Inbox</h3>
        <a className="muted small" href="https://mail.google.com" target="_blank" rel="noreferrer">
          {inbox.unread} unread →
        </a>
      </div>
      {inbox.messages.length === 0 ? (
        <p className="muted">Inbox zero in Primary.</p>
      ) : (
        <ul className="list">
          {inbox.messages.map((m) => (
            <li key={m.id}>
              <a href={m.url} target="_blank" rel="noreferrer">
                <div className="li-main">
                  <div className="li-title">{m.subject}</div>
                  <div className="muted small">{m.from}</div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DevCard({ dev }: { dev: DevData }) {
  const groups = [
    { name: "Review requested", items: dev.reviewRequests, color: "var(--yellow)" },
    { name: "Your PRs", items: dev.myPrs, color: "var(--green)" },
    { name: "Assigned issues", items: dev.issues, color: "var(--muted)" },
  ].filter((g) => g.items.length);
  return (
    <section className="card">
      <div className="card-head">
        <h3>Anchor dev</h3>
        <span className="muted small">@{dev.login}</span>
      </div>
      {groups.length === 0 ? (
        <p className="muted">No open PRs, reviews or assigned issues.</p>
      ) : (
        groups.map((g) => (
          <div key={g.name}>
            <div className="subhead">{g.name}</div>
            <ul className="list">
              {g.items.slice(0, 4).map((i) => (
                <li key={i.url}>
                  <a href={i.url} target="_blank" rel="noreferrer">
                    <span className="dot" style={{ background: g.color }} />
                    <div className="li-main">
                      <div className="li-title">{i.title}</div>
                      <div className="muted small">
                        {i.repo.split("/")[1] ?? i.repo} #{i.number}
                        {i.draft ? " · draft" : ""}
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

export function EdCard({ ed }: { ed: EdData }) {
  if (!ed.announcements.length) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h3>Ed announcements</h3>
        <span className="muted small">last 7 days</span>
      </div>
      <ul className="list">
        {ed.announcements.map((a) => (
          <li key={a.id}>
            <a href={a.url} target="_blank" rel="noreferrer">
              <span className="dot" style={{ background: "var(--sleep)" }} />
              <div className="li-main">
                <div className="li-title">{a.title}</div>
                <div className="muted small">{a.course}</div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SourcesStrip({ sources, googleExpires }: { sources: SourceStatus[]; googleExpires: string | null }) {
  const daysLeft = googleExpires ? Math.floor((Date.parse(googleExpires) - Date.now()) / 86400e3) : null;
  return (
    <section className="sources">
      <div className="pills">
        {sources
          .filter((s) => s.state !== "off")
          .map((s) => (
            <span key={s.key} className={`src ${s.state}`} title={s.message}>
              <i />
              {s.label}
            </span>
          ))}
      </div>
      {sources
        .filter((s) => s.state === "error" || s.state === "reconnect")
        .map((s) => (
          <p key={s.key} className="src-msg">
            <b>{s.label}:</b> {s.message}
          </p>
        ))}
      {sources.some((s) => s.state === "off") && (
        <p className="muted small">
          Not set up: {sources.filter((s) => s.state === "off").map((s) => s.label).join(", ")}
        </p>
      )}
      {daysLeft != null && daysLeft <= 2 && (
        <p className="muted small">
          Google sign-in expires in {Math.max(0, daysLeft)}d (testing-mode limit) — <a href="/api/google/start">reconnect</a>.
        </p>
      )}
      <form action="/api/logout" method="post" className="logout">
        <a href="/api/google/start" className="muted small">Reconnect Google</a>
        <span className="muted small"> · </span>
        <button className="link muted small">Log out</button>
      </form>
    </section>
  );
}
