import { redirect } from "next/navigation";
import { cfg } from "@/lib/config";
import { buildDashboard } from "@/lib/dashboard";
import { googleConfigured } from "@/lib/google";
import { authMode, isAuthed } from "@/lib/session";
import { storeUsable } from "@/lib/store";
import { fmtDay } from "@/lib/time";
import { CoachCard, Rings, SleepCard, StrainCard } from "./components/Health";
import { DevCard, DueCard, EdCard, InboxCard, PayCard, SourcesStrip, Timeline } from "./components/Life";
import WorkloadCard from "./components/Workload";
import NowCard from "./components/NowCard";
import { buildWidget } from "@/lib/widget";
import RefreshButton from "./components/RefreshButton";
import Routine from "./components/Routine";
import { AlertsCard, BriefCard, CountdownCard } from "./components/Brief";

export const dynamic = "force-dynamic";

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-AU", { timeZone: cfg.tz, hour: "numeric", hourCycle: "h23" }).format(now));
  return h < 5 ? "Late one" : h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

function Setup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="wrap narrow">
      <section className="card setup">
        <h2>{title}</h2>
        {children}
      </section>
    </main>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (authMode() === "misconfigured") {
    return (
      <Setup title="Almost there">
        <p>Set <code>DASHBOARD_PASSWORD</code> and <code>SESSION_SECRET</code> in your Vercel environment variables, then redeploy.</p>
      </Setup>
    );
  }
  if (!(await isAuthed())) redirect("/login");

  if (!cfg.demo && !storeUsable) {
    return (
      <Setup title="Add a database">
        <p>
          On Vercel the app needs somewhere to keep your Google sign-in. Add the free <b>Upstash Redis</b> integration
          (Vercel → Storage → Marketplace) to this project and redeploy — it sets the env vars for you.
        </p>
      </Setup>
    );
  }

  const params = await searchParams;
  // ?wake=1 comes from the alarm Shortcut: skip the cache so last night's sleep is as fresh as possible.
  const data = await buildDashboard(params.wake === "1", params.at);
  const now = new Date(data.generatedAt);
  const h = data.health;
  const needsGoogle = !data.demo && googleConfigured() && !data.google.connected;

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <div className="date">{fmtDay(now)}</div>
          <h1>
            {greeting(now)}, {cfg.ownerName}
          </h1>
        </div>
        <RefreshButton generatedAt={data.generatedAt} />
      </header>

      {data.demo && <div className="banner">Demo data — set <code>DEMO_MODE=0</code> once your accounts are connected.</div>}
      {params.connected === "1" && <div className="banner ok">Google connected. First load pulls 5 weeks of history, so give it a few seconds.</div>}
      {params.added && <div className="banner ok">Added {params.added} — its calendars and inbox are now merged in.</div>}
      {params.error && <div className="banner err">{params.error}</div>}

      {needsGoogle && (
        <a className="card connect" href="/api/google/start">
          <b>Connect Google</b>
          <span className="muted">Fitbit Air, Calendar and Gmail — one sign-in.</span>
        </a>
      )}
      {!googleConfigured() && !data.demo && (
        <div className="banner">Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to pull in Fitbit, Calendar and Gmail.</div>
      )}

      <NowCard feed={buildWidget(data, now)} tz={cfg.tz} />
      <BriefCard
        brief={data.brief}
        weather={data.weather}
        usingPhone={data.usingPhoneLocation}
        now={data.generatedAt}
        hideKinds={data.alerts.length ? ["event", "alert"] : ["event"]}
      />
      <AlertsCard alerts={data.alerts} />

      <div className="grid">
        <div className="col">
          {h && <Rings h={h} why={data.why} />}
          {data.coach && <CoachCard coach={data.coach} band={h?.recovery.band ?? null} />}
          {data.brief.phase === "morning" && (
            <Routine items={data.routine.items} done={data.routine.done} streak={data.routine.streak} />
          )}
          <Timeline today={data.timeline.today} tomorrow={data.timeline.tomorrow} now={data.generatedAt} />
          <WorkloadCard w={data.workload} tz={cfg.tz} />
          <DueCard due={data.due} now={data.generatedAt} />
        </div>
        <div className="col">
          {h && <SleepCard h={h} />}
          {h && <StrainCard h={h} />}
          <CountdownCard countdowns={data.countdowns} />
          {data.brief.phase === "day" && data.routine.done.length < data.routine.items.length && (
            <Routine items={data.routine.items} done={data.routine.done} streak={data.routine.streak} />
          )}
          {data.pay && <PayCard pay={data.pay} />}
          {data.inbox && <InboxCard inbox={data.inbox} />}
          {data.ed && <EdCard ed={data.ed} />}
          {data.dev && <DevCard dev={data.dev} />}
        </div>
      </div>

      <SourcesStrip sources={data.sources} googleExpires={data.google.refreshExpiresAt} accounts={data.accounts} />
      <p className="footnote">
        Recovery and strain are {cfg.appName}&apos;s own estimates from your Fitbit data, not medical advice.
      </p>
    </main>
  );
}
