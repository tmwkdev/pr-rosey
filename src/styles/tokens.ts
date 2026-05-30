export const tokens = {
  button: {
    primary:
      "inline-flex min-h-10 items-center justify-center rounded-md bg-rosey px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a63f4f] focus:outline-none focus:ring-2 focus:ring-rosey focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
    secondary:
      "inline-flex min-h-10 items-center justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-ink/5 focus:outline-none focus:ring-2 focus:ring-moss focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
  },
  card: {
    panel: "rounded-lg border border-ink/10 bg-white shadow-panel",
    section: "rounded-md border border-ink/10 bg-paper/80",
  },
  label: {
    eyebrow: "text-xs font-semibold uppercase tracking-wide text-moss",
    field: "text-sm font-medium text-ink",
  },
  input: {
    base: "min-h-10 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30",
  },
  formGroup: {
    base: "space-y-2",
  },
  status: {
    ready: "bg-moss/10 text-moss",
    missing: "bg-rosey/10 text-rosey",
    error: "bg-amber-100 text-amber-800",
    loading: "bg-ink/10 text-ink/70",
    unknown: "bg-ink/10 text-ink/70",
  },
};
