type Segment = { value: number; color: string; label: string };

/**
 * Torta/donut en SVG puro (server-friendly, sin librerías).
 * Los colores son strings CSS (ej. "hsl(var(--primary))").
 */
export function DonutChart({ segments, centerLabel, size = 132 }: {
  segments: Segment[];
  centerLabel?: string;
  size?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const summary = segments.map((s) => `${s.label}: ${s.value}`).join(", ");
  const chartLabel = `${centerLabel ? `${centerLabel} — ` : ""}${summary || "sin datos"}`;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={chartLabel}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="12" opacity="0.4" />
        {total > 0 &&
          segments.filter((s) => s.value > 0).map((s, i) => {
            const frac = s.value / total;
            const dash = frac * c;
            const el = (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="12"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
                strokeLinecap={segments.filter((x) => x.value > 0).length > 1 ? "butt" : "round"}
              />
            );
            offset += dash;
            return el;
          })}
        {centerLabel && (
          <text x="50" y="54" textAnchor="middle" fontSize="20" fontWeight="700" fill="hsl(var(--foreground))">
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="mono font-semibold">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
