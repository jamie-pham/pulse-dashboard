// Notion tasks + GitHub (Anchor) activity.

import { cfg } from "../config";
import { fetchJson, SourceError } from "../errors";
import { cached } from "../store";
import { localTime } from "../time";
import type { DevData, DevItem, DueItem } from "../types";

// ---------- Notion ----------
function propText(p: any): string | null {
  if (!p) return null;
  switch (p.type) {
    case "status":
      return p.status?.name ?? null;
    case "select":
      return p.select?.name ?? null;
    case "checkbox":
      return p.checkbox ? "done" : "open";
    case "multi_select":
      return p.multi_select?.map((x: any) => x.name).join(", ") ?? null;
    default:
      return null;
  }
}

export async function getNotionTasks(): Promise<DueItem[]> {
  const { token, databaseId, dateProp, statusProp, doneValues } = cfg.notion;
  if (!token || !databaseId) throw new SourceError("off", "Add NOTION_TOKEN and NOTION_DATABASE_ID");
  const j = await fetchJson<any>(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify({
      page_size: 50,
      filter: { property: dateProp, date: { on_or_before: new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10) } },
      sorts: [{ property: dateProp, direction: "ascending" }],
    }),
  });
  return (j.results ?? [])
    .map((page: any) => {
      const props = page.properties ?? {};
      const titleProp = Object.values(props).find((p: any) => p.type === "title") as any;
      const status = propText(props[statusProp]);
      const date = props[dateProp]?.date?.start as string | undefined;
      return { page, title: titleProp?.title?.map((t: any) => t.plain_text).join("") || "Untitled", status, date };
    })
    .filter((x: any) => x.date && !doneValues.includes(String(x.status ?? "").toLowerCase()) && x.status !== "done")
    .map(
      (x: any): DueItem => ({
        id: `notion:${x.page.id}`,
        title: x.title,
        due: (x.date.length === 10 ? localTime(x.date, "23:59") : new Date(x.date)).toISOString(),
        source: "notion",
        status: x.status ?? undefined,
        url: x.page.url,
      }),
    );
}

// ---------- GitHub ----------
const gh = (path: string) =>
  fetchJson<any>(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${cfg.github.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pulse-dashboard",
    },
  });

function toItems(j: any): DevItem[] {
  return (j.items ?? []).map((i: any) => ({
    title: i.title,
    repo: i.repository_url?.split("/repos/")[1] ?? "",
    number: i.number,
    url: i.html_url,
    draft: i.draft,
    updated: i.updated_at,
  }));
}

export async function getGitHub(): Promise<DevData> {
  if (!cfg.github.token) throw new SourceError("off", "Add GITHUB_TOKEN");
  const me = await cached("gh:me", 86400, () => gh("/user"));
  const login = me.login as string;
  const repoQ = cfg.github.repos.map((r) => `repo:${r}`).join(" ");
  const q = (s: string) => `/search/issues?per_page=8&sort=updated&q=${encodeURIComponent(`${s} ${repoQ}`.trim())}`;
  const [mine, reviews, issues] = await Promise.all([
    gh(q(`is:open is:pr author:${login} archived:false`)),
    gh(q(`is:open is:pr review-requested:${login} archived:false`)),
    gh(q(`is:open is:issue assignee:${login} archived:false`)),
  ]);
  return { login, myPrs: toItems(mine), reviewRequests: toItems(reviews), issues: toItems(issues) };
}
