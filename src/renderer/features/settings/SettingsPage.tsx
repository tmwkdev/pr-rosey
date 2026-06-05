import { tokens } from "@/styles/tokens";

function SettingsPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-8">
      <div className="space-y-2">
        <p className={tokens.label.eyebrow}>Settings</p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">App settings</h2>
        <p className={tokens.text.mutedBody}>
          Settings will live here once the app has user-editable preferences.
        </p>
      </div>

      <div className={`${tokens.card.panel} p-5`}>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-ink">Placeholder</h3>
          <p className={tokens.text.mutedBody}>
            This page is intentionally separate from the pull request inbox so native preferences
            navigation has a stable destination.
          </p>
        </div>
      </div>

      <div>
        <a
          className="inline-flex text-sm font-medium text-moss underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-moss/30"
          href="#pull-requests"
        >
          Back to pull requests
        </a>
      </div>
    </section>
  );
}

export default SettingsPage;
