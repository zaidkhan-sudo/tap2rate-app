const STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  UNUSED: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  DISABLED: "bg-rose-500/10 text-rose-300 border-rose-500/25",
};

export default function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
        STYLES[status] ?? "border-white/15 bg-white/5 text-neutral-300"
      }`}
    >
      {label}
    </span>
  );
}
