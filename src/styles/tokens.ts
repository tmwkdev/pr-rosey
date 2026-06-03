export const tokens = {
  button: {
    primary:
      "inline-flex min-h-9 items-center justify-center rounded-md border border-moss/35 bg-moss/15 px-3.5 py-2 text-sm font-medium text-moss shadow-sm shadow-black/20 transition hover:border-moss/55 hover:bg-moss/20 focus:outline-none focus:ring-2 focus:ring-moss/35 focus:ring-offset-2 focus:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-55",
    secondary:
      "inline-flex min-h-9 items-center justify-center rounded-md border border-line bg-panel px-3.5 py-2 text-sm font-medium text-ink shadow-sm shadow-black/20 transition hover:border-faint hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-moss/30 focus:ring-offset-2 focus:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-55",
  },
  badge: {
    base: "inline-flex h-fit w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium",
  },
  card: {
    panel: "rounded-lg border border-line bg-panel shadow-panel",
    section: "rounded-md border border-line bg-white/[0.03]",
  },
  label: {
    eyebrow: "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted",
    field: "text-sm font-medium text-ink",
  },
  layout: {
    detailStack: "min-w-0 space-y-1",
  },
  stat: {
    row: "flex items-center justify-between px-4 py-3",
    label: "text-sm text-muted",
    value: "font-mono text-sm text-ink",
  },
  text: {
    meta: "text-xs text-muted",
    mutedBody: "text-sm leading-6 text-muted",
  },
  input: {
    base: "min-h-9 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink shadow-sm shadow-black/20 focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/25",
  },
  formGroup: {
    base: "space-y-2",
  },
  status: {
    ready: "border-moss/25 bg-moss/10 text-moss",
    missing: "border-rosey/25 bg-rosey/10 text-rosey",
    error: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    loading: "border-muted/20 bg-white/[0.04] text-muted",
    unknown: "border-muted/20 bg-white/[0.04] text-muted",
  },
  statusDot: {
    ready: "bg-moss shadow-[0_0_16px_rgba(107,209,155,0.34)]",
    missing: "bg-rosey shadow-[0_0_16px_rgba(230,95,115,0.3)]",
    error: "bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.28)]",
    loading: "bg-muted",
    unknown: "bg-faint",
  },
};
