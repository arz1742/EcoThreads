import { useMemo, useState } from "react";

export interface SchemaColumn { name: string; type: string; nullable: boolean; is_pk: boolean }
export interface SchemaTable { name: string; comment: string | null; columns: SchemaColumn[] }
export interface SchemaRelation { from_table: string; from_column: string; to_table: string; to_column: string }

// Hand-tuned positions (column, order) so the diagram reads left → right:
// catalogue → items → people → shopping → orders & reviews.
const PLACE: Record<string, [number, number]> = {
  categories: [0, 0], ngos: [0, 1], activity_log: [0, 2],
  items: [1, 0], item_images: [1, 1],
  profiles: [2, 0], feedback: [2, 1],
  wishlists: [3, 0], cart_items: [3, 1], donation_requests: [3, 2],
  orders: [4, 0], order_items: [4, 1], reviews: [4, 2],
};

const W = 220, HEAD = 30, ROW = 19, GAP_X = 70, GAP_Y = 34, PAD = 16;

const shortType = (t: string) =>
  t.replace("timestamp with time zone", "timestamptz").replace("character varying", "varchar").replace("double precision", "float8").replace("USER-DEFINED", "enum").replace("ARRAY", "array");

export function ErDiagram({ tables, relations, counts, highlight }: {
  tables: SchemaTable[]; relations: SchemaRelation[]; counts: Record<string, number>; highlight?: string | null;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? highlight ?? null;

  const layout = useMemo(() => {
    const cols: Record<number, SchemaTable[]> = {};
    let extra = 0;
    const sorted = [...tables].sort((a, b) => (PLACE[a.name]?.[1] ?? 99) - (PLACE[b.name]?.[1] ?? 99));
    sorted.forEach((t) => {
      const c = PLACE[t.name]?.[0] ?? 5 + Math.floor(extra++ / 3);
      (cols[c] ??= []).push(t);
    });
    const pos: Record<string, { x: number; y: number; h: number }> = {};
    let maxY = 0, maxX = 0;
    Object.entries(cols).forEach(([c, list]) => {
      let y = PAD;
      list.forEach((t) => {
        const h = HEAD + t.columns.length * ROW + 6;
        const x = PAD + Number(c) * (W + GAP_X);
        pos[t.name] = { x, y, h };
        y += h + GAP_Y;
        maxY = Math.max(maxY, y); maxX = Math.max(maxX, x + W + PAD);
      });
    });
    return { pos, width: maxX, height: maxY };
  }, [tables]);

  const fkCols = useMemo(() => new Set(relations.map((r) => `${r.from_table}.${r.from_column}`)), [relations]);
  const colY = (table: string, col: string) => {
    const t = tables.find((x) => x.name === table);
    const i = Math.max(0, t?.columns.findIndex((c) => c.name === col) ?? 0);
    return layout.pos[table].y + HEAD + i * ROW + ROW / 2 + 2;
  };

  const related = (name: string) => relations.some((r) => (r.from_table === focus && r.to_table === name) || (r.to_table === focus && r.from_table === name));

  return (
    <svg width={layout.width} height={layout.height} role="img" aria-label="Entity relationship diagram of the EcoThreads database" className="font-sans">
      <defs>
        <marker id="one" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
          <path d="M9 0 V10 M6 0 V10" stroke="currentColor" strokeWidth="1.4" />
        </marker>
        <marker id="many" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
          <path d="M1 6 L11 0 M1 6 L11 12 M1 6 H11" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </marker>
      </defs>

      {/* relationship lines */}
      {relations.map((r, i) => {
        const a = layout.pos[r.from_table], b = layout.pos[r.to_table];
        if (!a || !b) return null;
        const y1 = colY(r.from_table, r.from_column), y2 = colY(r.to_table, r.to_column);
        let x1: number, x2: number, d: string;
        if (a.x === b.x) {
          x1 = a.x + W; x2 = b.x + W;
          const bulge = x1 + 40 + (i % 3) * 10;
          d = `M${x1} ${y1} C ${bulge} ${y1}, ${bulge} ${y2}, ${x2} ${y2}`;
        } else {
          const leftToRight = a.x < b.x;
          x1 = leftToRight ? a.x + W : a.x; x2 = leftToRight ? b.x : b.x + W;
          const mid = (x1 + x2) / 2;
          d = `M${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
        }
        const on = focus && (r.from_table === focus || r.to_table === focus);
        return (
          <path key={i} d={d} fill="none" markerStart="url(#many)" markerEnd="url(#one)"
            className={on ? "text-green-600" : focus ? "text-gray-200" : "text-gray-400"} stroke="currentColor" strokeWidth={on ? 2 : 1.2}>
            <title>{`${r.from_table}.${r.from_column} → ${r.to_table}.${r.to_column}`}</title>
          </path>
        );
      })}

      {/* tables */}
      {tables.map((t) => {
        const p = layout.pos[t.name];
        if (!p) return null;
        const dim = focus && focus !== t.name && !related(t.name);
        const active = focus === t.name;
        return (
          <g key={t.name} transform={`translate(${p.x},${p.y})`} opacity={dim ? 0.35 : 1}
            onMouseEnter={() => setHover(t.name)} onMouseLeave={() => setHover(null)} style={{ transition: "opacity .2s" }}>
            <rect width={W} height={p.h} rx={8} fill="white" stroke={active ? "#16a34a" : "#d1d5db"} strokeWidth={active ? 2 : 1} />
            <path d={`M0 8 a8 8 0 0 1 8 -8 h${W - 16} a8 8 0 0 1 8 8 v${HEAD - 8} h-${W} z`} fill={active ? "#15803d" : "#16a34a"} />
            <text x={10} y={20} fill="white" fontSize={13} fontWeight={600}>{t.name}</text>
            <text x={W - 10} y={20} fill="#dcfce7" fontSize={11} textAnchor="end">{counts[t.name] ?? "–"} rows</text>
            {t.columns.map((c, i) => {
              const y = HEAD + i * ROW + 2;
              const fk = fkCols.has(`${t.name}.${c.name}`);
              return (
                <g key={c.name}>
                  {i % 2 === 1 && <rect x={1} y={y} width={W - 2} height={ROW} fill="#f9fafb" />}
                  <text x={10} y={y + 13.5} fontSize={11} fill={c.is_pk ? "#b45309" : fk ? "#1d4ed8" : "#374151"} fontWeight={c.is_pk ? 600 : 400}>
                    {c.is_pk ? "🔑 " : fk ? "🔗 " : ""}{c.name}
                  </text>
                  <text x={W - 10} y={y + 13.5} fontSize={10} fill="#9ca3af" textAnchor="end">{shortType(c.type)}{c.nullable ? "" : " *"}</text>
                </g>
              );
            })}
            <title>{t.comment ?? t.name}</title>
          </g>
        );
      })}
    </svg>
  );
}
