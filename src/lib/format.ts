export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);

export const formatNumber = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(Number(n) || 0));

export const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function timeAgo(d: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24); if (days < 30) return `${days} d ago`;
  return formatDate(d);
}

export const CONDITIONS = ["New", "Like New", "Excellent", "Good", "Fair"] as const;

export const conditionStyle: Record<string, string> = {
  New: "bg-green-100 text-green-800",
  "Like New": "bg-emerald-100 text-emerald-800",
  Excellent: "bg-blue-100 text-blue-800",
  Good: "bg-yellow-100 text-yellow-800",
  Fair: "bg-orange-100 text-orange-800",
};

export const FREE_SHIPPING_AT = 999;
export const SHIPPING_FEE = 49;
