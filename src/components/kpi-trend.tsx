// Server-rendered small-multiple trend line for one KPI measure. Three
// measures of different scales (ARR, customers, pipeline) each get their
// own chart — never combined on one axis. Single series per chart, so the
// tile's label carries identity (no legend) and the stat value above is
// the direct label. Stroke uses currentColor so the parent can restyle it
// for print (dark emerald → neutral) without a second SVG.

const W = 200;
const H = 44;
const PAD = 4;

export function KpiTrend({ values }: { values: (number | null)[] }) {
  const points = values.map((v) => v ?? 0);
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const step = (W - PAD * 2) / (points.length - 1);
  const x = (i: number) => PAD + i * step;
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const lastX = x(points.length - 1);
  const lastY = y(points[points.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-2 h-11 w-full"
      role="img"
      aria-label={`Trend over ${points.length} data points`}
      preserveAspectRatio="none"
    >
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="3" fill="currentColor" />
    </svg>
  );
}
