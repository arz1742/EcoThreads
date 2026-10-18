// "Recently viewed" — kept in this browser only (a convenience, not real data)
const KEY = "ecothreads:recent";
export function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function pushRecent(id: string) {
  try {
    const list = [id, ...getRecent().filter((x) => x !== id)].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* storage unavailable — ignore */ }
}
