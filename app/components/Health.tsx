import { fmtDuration, fmtTime, fmtDay } from "@/lib/time";
import type { Coach, HealthData } from "@/lib/types";

const BAND_COLOR = { green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)" } as const;

function Ring({
  value,
  max,
  color,
  label,
  display,
  sub,
}: {
  value: number | null;
  max: number;
  color: string;
  label: string;
  display: string;
  sub?: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const frac = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} className="ring-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="ring-fill"
          style={{ stroke: color, strokeDasharray: `${c * frac} ${c}` }}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-value" style={{ color: value == null ? "var(--muted)" : undefined }}>
          {display}
        </div>
        {sub && <div className="ring-sub">{sub}</div>}
      </div>
      <div className="ring-label">{label}</div>
    </div>
  );
}

export function Rings({ h }: { h: HealthData }) {
  const rec = h.recovery;
  return (
    <section className="rings">
      <Ring
        label="Recovery"
        value={rec.score}
        max={100}
        color={rec.band ? BAND_COLOR[rec.band] : "var(--muted)"}
        display={rec.score == null ? "—" : `${rec.score}%`}
        sub={rec.calibrating ? "calibrating" : rec.dataDate && rec.dataDate !== h.date ? "yesterday's" : undefined}
      />
      <Ring
        label="Strain"
        value={h.strain.score}
        max={21}
        color="var(--strain)"
        display={h.strain.score.toFixed(1)}
        sub={h.strain.peakHr ? `peak ${h.strain.peakHr}` : undefined}
      />
      <Ring
        label="Sleep"
        value={h.sleep ? h.sleep.performance * 100 : null}
        max={100}
        color="var(--sleep)"
        display={h.sleep ? `${Math.round(h.sleep.performance * 100)}%` : "—"}
        sub={h.sleep ? fmtDuration(h.sleep.asleepMin) : "no data"}
      />
    </section>
  );
}

export function CoachCard({ coach, band }: { coach: Coach; band: HealthData["recovery"]["band"] }) {
  return (
    <section className="card coach" style={{ borderColor: band ? BAND_COLOR[band] : undefined }}>
      <h2 className="coach-head">{coach.headline}</h2>
      {coach.lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
      {coach.tonight && (
        <div className="tonight">
          <span className="tonight-icon">☾</span>
          <div>
            In bed by <b>{fmtTime(coach.tonight.bedtime)}</b> for {fmtDuration(coach.tonight.needMin)} of sleep
            <div className="muted small">
              wake {fmtTime(coach.tonight.wakeAt)} · {coach.tonight.reason}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const STAGE_ROW: Record<string, number> = { AWAKE: 0, RESTLESS: 0, REM: 1, LIGHT: 2, ASLEEP: 2, DEEP: 3 };
const STAGE_COLOR = ["var(--awake)", "var(--rem)", "var(--light)", "var(--deep)"];

function Hypnogram({ segments, start, end }: { segments: { type: string; start: string; end: string }[]; start: string; end: string }) {
  const t0 = Date.parse(start);
  const span = Math.max(1, Date.parse(end) - t0);
  const W = 300;
  const rowH = 14;
  return (
    <svg className="hypno" viewBox={`0 0 ${W} ${rowH * 4 + 6}`} preserveAspectRatio="none" aria-label="Sleep stages through the night">
      {[0, 1, 2, 3].map((r) => (
        <line key={r} x1="0" x2={W} y1={r * rowH + rowH / 2 + 3} y2={r * rowH + rowH / 2 + 3} className="hypno-grid" />
      ))}
      {segments.map((s, i) => {
        const row = STAGE_ROW[s.type.toUpperCase()] ?? 2;
        const x = ((Date.parse(s.start) - t0) / span) * W;
        const w = Math.max(1, ((Date.parse(s.end) - Date.parse(s.start)) / span) * W);
        return <rect key={i} x={x} y={row * rowH + 3} width={w} height={rowH - 2} rx="2" fill={STAGE_COLOR[row]} />;
      })}
    </svg>
  );
}

function Delta({ value, base, unit, higherIsBetter }: { value: number | null; base: number | null; unit: string; higherIsBetter: boolean }) {
  if (value == null) return <span className="muted">—</span>;
  const d = base != null ? value - base : 0;
  const good = higherIsBetter ? d >= 0 : d <= 0;
  return (
    <span>
      {Math.round(value)}
      <span className="unit">{unit}</span>
      {base != null && Math.abs(d) >= 0.5 && (
        <span className={`delta ${good ? "good" : "bad"}`}>
          {d > 0 ? "▲" : "▼"}
          {Math.abs(Math.round(d))}
        </span>
      )}
    </span>
  );
}

export function SleepCard({ h }: { h: HealthData }) {
  const s = h.sleep;
  const r = h.recovery;
  return (
    <section className="card">
      <div className="card-head">
        <h3>Sleep &amp; vitals</h3>
        {s?.bedtime && s.wake && (
          <span className="muted small">
            {fmtTime(s.bedtime)} → {fmtTime(s.wake)}
          </span>
        )}
      </div>
      {s ? (
        <>
          {s.segments.length > 0 && s.bedtime && s.wake && (
            <div className="hypno-wrap">
              <div className="hypno-labels">
                <span>Awake</span>
                <span>REM</span>
                <span>Light</span>
                <span>Deep</span>
              </div>
              <Hypnogram segments={s.segments} start={s.bedtime} end={s.wake} />
            </div>
          )}
          <div className="stage-bar">
            {(["deep", "rem", "light", "awake"] as const).map((k) => (
              <div key={k} style={{ flex: s.stages[k] || 0.0001, background: `var(--${k})` }} title={`${k} ${s.stages[k]}m`} />
            ))}
          </div>
          <div className="stage-legend">
            <span><i style={{ background: "var(--deep)" }} />Deep {fmtDuration(s.stages.deep)}</span>
            <span><i style={{ background: "var(--rem)" }} />REM {fmtDuration(s.stages.rem)}</span>
            <span><i style={{ background: "var(--light)" }} />Light {fmtDuration(s.stages.light)}</span>
            <span><i style={{ background: "var(--awake)" }} />Awake {fmtDuration(s.stages.awake)}</span>
          </div>
        </>
      ) : (
        <p className="muted">No sleep logged for last night yet.</p>
      )}
      <div className="stats">
        <div>
          <div className="stat-label">Asleep / needed</div>
          <div className="stat-value">{s ? `${fmtDuration(s.asleepMin)}` : "—"}<span className="unit">{s ? ` / ${fmtDuration(s.needMin)}` : ""}</span></div>
        </div>
        <div>
          <div className="stat-label">Efficiency</div>
          <div className="stat-value">{s?.efficiency != null ? `${Math.round(s.efficiency * 100)}%` : "—"}</div>
        </div>
        <div>
          <div className="stat-label">HRV · {r.hrvBaseline ? `base ${Math.round(r.hrvBaseline)}` : "no base"}</div>
          <div className="stat-value"><Delta value={r.hrv} base={r.hrvBaseline} unit="ms" higherIsBetter /></div>
        </div>
        <div>
          <div className="stat-label">Resting HR · {r.rhrBaseline ? `base ${Math.round(r.rhrBaseline)}` : "no base"}</div>
          <div className="stat-value"><Delta value={r.rhr} base={r.rhrBaseline} unit="bpm" higherIsBetter={false} /></div>
        </div>
      </div>
    </section>
  );
}

export function StrainCard({ h }: { h: HealthData }) {
  const z = h.strain.zones;
  const zMax = Math.max(1, ...z);
  return (
    <section className="card">
      <div className="card-head">
        <h3>Strain &amp; activity</h3>
        <span className="muted small">{h.steps != null ? `${h.steps.toLocaleString("en-AU")} steps` : ""}</span>
      </div>
      <div className="zones">
        {z.map((m, i) => (
          <div key={i} className="zone">
            <div className="zone-bar-wrap">
              <div className="zone-bar" style={{ height: `${(m / zMax) * 100}%`, opacity: 0.45 + i * 0.13 }} />
            </div>
            <div className="zone-min">{m}m</div>
            <div className="zone-label">Z{i + 1}</div>
          </div>
        ))}
      </div>
      {h.workouts.length > 0 && (
        <ul className="list">
          {h.workouts.map((w, i) => (
            <li key={i}>
              <span className="dot" style={{ background: "var(--strain)" }} />
              <div className="li-main">
                <div className="li-title" style={{ textTransform: "capitalize" }}>{w.name}</div>
                <div className="muted small">
                  {fmtTime(w.start)} · {w.minutes} min{w.avgHr ? ` · avg ${w.avgHr} bpm` : ""}{w.kcal ? ` · ${Math.round(w.kcal)} kcal` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Trend h={h} />
    </section>
  );
}

function Trend({ h }: { h: HealthData }) {
  const bandColor = (r: number | null) => (r == null ? "var(--line)" : r >= 67 ? "var(--green)" : r >= 34 ? "var(--yellow)" : "var(--red)");
  return (
    <div className="trend">
      <div className="trend-title muted small">Last 7 days</div>
      <div className="trend-grid">
        {h.trend.slice(-7).map((d) => (
          <div key={d.date} className="trend-day">
            <div className="trend-bars">
              <div className="trend-bar" style={{ height: `${d.recovery ?? 0}%`, background: bandColor(d.recovery) }} title={`Recovery ${d.recovery ?? "—"}`} />
              <div className="trend-bar" style={{ height: `${((d.strain ?? 0) / 21) * 100}%`, background: "var(--strain)" }} title={`Strain ${d.strain ?? "—"}`} />
            </div>
            <div className="trend-label">{fmtDay(`${d.date}T12:00:00`).split(" ")[0].slice(0, 2)}</div>
          </div>
        ))}
      </div>
      <div className="trend-legend muted small">
        <span><i style={{ background: "var(--green)" }} />recovery</span>
        <span><i style={{ background: "var(--strain)" }} />strain</span>
      </div>
    </div>
  );
}
