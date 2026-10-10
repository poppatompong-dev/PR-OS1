type MetricCardProps = {
  label: string;
  value: string | number;
  hint: string;
  tone?: "blue" | "teal" | "green" | "amber" | "red";
};

export function MetricCard({ label, value, hint, tone = "blue" }: MetricCardProps) {
  // A name is not a statistic: set at the same size as a count it wraps to
  // three lines and stretches the whole row of cards with it.
  const isText = typeof value === "string" && !/^-?\d/.test(value.trim());

  return (
    <section className={`metric-card metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${isText ? " metric-value-text" : ""}`}>{value}</div>
      <div className="metric-hint">{hint}</div>
    </section>
  );
}
