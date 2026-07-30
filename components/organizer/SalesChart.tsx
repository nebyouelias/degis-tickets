/**
 * 14-day sales chart as inline SVG — no charting library, no client JS.
 * Keeps the organizer dashboard light on Ethiopian connections.
 */
export function SalesChart({
  days,
}: {
  days: Array<{ label: string; etb: number }>;
}) {
  const max = Math.max(...days.map((d) => d.etb), 1);
  const W = 100;
  const H = 34;
  const gap = 1.2;
  const barW = (W - gap * (days.length - 1)) / days.length;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label="Daily sales for the last 14 days"
      >
        {days.map((d, i) => {
          const h = d.etb > 0 ? Math.max((d.etb / max) * H, 0.8) : 0;
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={H - h}
              width={barW}
              height={h}
              rx={0.6}
              fill={d.etb > 0 ? "#8E1F2F" : "#26262D"}
            />
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-ink-500">
        <span>{days[0]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  );
}
