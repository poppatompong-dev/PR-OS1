type StatusPillProps = {
  label: string;
  tone?: "blue" | "teal" | "amber" | "red" | "gray" | "green";
};

export function StatusPill({ label, tone = "gray" }: StatusPillProps) {
  return (
    <span className={`status-pill status-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
