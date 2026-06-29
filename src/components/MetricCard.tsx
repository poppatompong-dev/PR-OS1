type MetricCardProps = {
  label: string;
  value: string | number;
  hint: string;
  tone?: "blue" | "teal" | "green" | "amber" | "red";
};

export function MetricCard({ label, value, hint, tone = "blue" }: MetricCardProps) {
  return (
    <section className={`metric-card metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-hint">{hint}</div>
    </section>
  );
}
