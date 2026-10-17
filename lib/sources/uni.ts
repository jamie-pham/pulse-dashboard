// Ed (edstem) and OnTrack. Neither has an official public API for students, so these use
// your own personal tokens, read-only. They're the most likely cards to break — that's expected.

import { cfg } from "../config";
import { fetchJson, SourceError } from "../errors";
import { cached } from "../store";
import { localTime } from "../time";
import type { DueItem, EdData } from "../types";

// ---------- Ed ----------
const edHeaders = () => ({ Authorization: `Bearer ${cfg.ed.token}`, Accept: "application/json" });

async function edCourses(): Promise<{ id: string; code: string }[]> {
  if (cfg.ed.courseIds.length) {
    const user = await fetchJson<any>(`${cfg.ed.base}/user`, { headers: edHeaders() }).catch(() => null);
    const known = new Map<string, string>(
      (user?.courses ?? []).map((c: any) => [String(c.course?.id), c.course?.code ?? c.course?.name]),
    );
    return cfg.ed.courseIds.map((id) => ({ id, code: known.get(id) ?? `Ed ${id}` }));
  }
  const user = await fetchJson<any>(`${cfg.ed.base}/user`, { headers: edHeaders() });
  return (user?.courses ?? [])
    .filter((c: any) => c.course?.status === "active" || c.course?.status == null)
    .map((c: any) => ({ id: String(c.course.id), code: c.course.code ?? c.course.name }));
}

export async function getEd(): Promise<{ ed: EdData; due: DueItem[] }> {
  if (!cfg.ed.token) throw new SourceError("off", "Add ED_TOKEN");
  const courses = await cached("ed:courses", 86400, edCourses);
  const weekAgo = Date.now() - 7 * 86400e3;
  const twoWeeks = Date.now() + 14 * 86400e3;

  const perCourse = await Promise.all(
    courses.map(async (c) => {
      const [threads, lessons] = await Promise.all([
        fetchJson<any>(`${cfg.ed.base}/courses/${c.id}/threads?limit=30&sort=new`, { headers: edHeaders() }).catch(() => null),
        fetchJson<any>(`${cfg.ed.base}/courses/${c.id}/lessons`, { headers: edHeaders() }).catch(() => null),
      ]);
      const announcements = (threads?.threads ?? [])
        .filter((t: any) => t.type === "announcement" && Date.parse(t.created_at) > weekAgo)
        .map((t: any) => ({
          id: `ed:${t.id}`,
          title: t.title,
          course: c.code,
          at: t.created_at,
          url: `${cfg.ed.web}/courses/${c.id}/discussion/${t.id}`,
        }));
      const due: DueItem[] = (lessons?.lessons ?? [])
        .filter((l: any) => l.due_at && Date.parse(l.due_at) < twoWeeks && Date.parse(l.due_at) > Date.now() - 3 * 86400e3)
        .filter((l: any) => !["completed", "attempted"].includes(String(l.status)))
        .map((l: any) => ({
          id: `edl:${l.id}`,
          title: l.title,
          due: new Date(l.due_at).toISOString(),
          source: "ed" as const,
          course: c.code,
          url: `${cfg.ed.web}/courses/${c.id}/lessons/${l.id}`,
        }));
      return { announcements, due };
    }),
  );
  return {
    ed: {
      announcements: perCourse
        .flatMap((p) => p.announcements)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, 6),
    },
    due: perCourse.flatMap((p) => p.due),
  };
}

// ---------- OnTrack (Doubtfire) ----------
const DONE = new Set(["complete", "discuss", "demonstrate", "ready_for_feedback", "ready_to_mark", "time_exceeded", "fail"]);

export async function getOnTrack(): Promise<DueItem[]> {
  const { base, username, token } = cfg.ontrack;
  if (!base || !username || !token) throw new SourceError("off", "Add ONTRACK_BASE, ONTRACK_USERNAME, ONTRACK_AUTH_TOKEN");
  const headers = { Username: username, "Auth-Token": token, Accept: "application/json" };
  const projects = await fetchJson<any[]>(`${base}/projects`, { headers });
  const horizon = Date.now() + 21 * 86400e3;

  const all = await Promise.all(
    (projects ?? [])
      .filter((p) => p.unit?.active !== false)
      .map(async (p) => {
        const [project, unit] = await Promise.all([
          fetchJson<any>(`${base}/projects/${p.id}`, { headers }),
          cached(`ontrack:unit:${p.unit_id ?? p.unit?.id}`, 86400, () =>
            fetchJson<any>(`${base}/units/${p.unit_id ?? p.unit?.id}`, { headers }),
          ),
        ]);
        const status = new Map<number, string>((project.tasks ?? []).map((t: any) => [t.task_definition_id, t.status]));
        const code = unit.code ?? p.unit?.code ?? "Unit";
        const webBase = base.replace(/\/api$/, "");
        return (unit.task_definitions ?? [])
          .map((td: any) => ({ td, st: status.get(td.id) ?? "not_started", due: td.target_date ?? td.due_date }))
          .filter(({ st, due }: any) => due && !DONE.has(st) && Date.parse(due) < horizon)
          .map(({ td, st, due }: any): DueItem => ({
            id: `ot:${p.id}:${td.id}`,
            title: `${td.abbreviation ? td.abbreviation + " · " : ""}${td.name}`,
            due: localTime(String(due).slice(0, 10), "23:59").toISOString(),
            source: "ontrack",
            course: code,
            status: String(st).replace(/_/g, " "),
            url: `${webBase}/#/projects/${p.id}/dashboard/${td.abbreviation ?? ""}`,
          }));
      }),
  );
  return all.flat();
}
