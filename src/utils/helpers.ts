import type { FeedItem } from "@src/types";

export const nowStr = () => new Date().toISOString();

export function filterItems(list: FeedItem[], query: string) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter((i) => (`${i.title} ${i.note || ""}`).toLowerCase().includes(q));
}

export function sectionFor(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yday = new Date(); yday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function groupByDay(list: FeedItem[]) {
  const by: Record<string, FeedItem[]> = {};
  for (const it of list) {
    const label = timeAgo(it.ts);
    if (!by[label]) by[label] = [];
    by[label].push(it);
  }
  return by;
}

export function timeAgo(ts: number) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); return `${d}d`;
}

export function defaultTitle(kind: string) {
  switch (kind) {
    case "meal": return "Meal • 1 cup kibble";
    case "vet": return "Vet Visit • General Checkup";
    case "med": return "Medication • Dose";
    case "memory": return "Memory • Cute photo with your pet";
    default: return "Note";
  }
}

export function pretty(k: string) {
  return ({ meal: "Meal", vet: "Vet Visit", med: "Medication", memory: "Memories", milestone: "Milestone" } as any)[k] || k;
}
