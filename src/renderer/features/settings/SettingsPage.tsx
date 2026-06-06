import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { LocalRepositoryInspection, RepositoryMapping } from "@/shared/repositoryMappings";
import { tokens } from "@/styles/tokens";

type RepositoryMappingFormState = {
  repositoryNameWithOwner: string;
  localPath: string;
};

const emptyFormState: RepositoryMappingFormState = {
  repositoryNameWithOwner: "",
  localPath: "",
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function replaceMapping(
  mappings: RepositoryMapping[],
  nextMapping: RepositoryMapping,
): RepositoryMapping[] {
  return [
    ...mappings.filter(
      (mapping) =>
        mapping.repositoryNameWithOwner.toLowerCase() !==
        nextMapping.repositoryNameWithOwner.toLowerCase(),
    ),
    nextMapping,
  ].sort((left, right) =>
    left.repositoryNameWithOwner.localeCompare(right.repositoryNameWithOwner),
  );
}

function SettingsPage() {
  const [mappings, setMappings] = useState<RepositoryMapping[]>([]);
  const [formState, setFormState] = useState<RepositoryMappingFormState>(emptyFormState);
  const [inspection, setInspection] = useState<LocalRepositoryInspection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChoosing, setIsChoosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [removingRepositoryNameWithOwner, setRemovingRepositoryNameWithOwner] = useState<
    string | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSaveDisabled =
    isSaving || !formState.repositoryNameWithOwner.trim() || !formState.localPath.trim();

  const selectedMapping = useMemo(
    () =>
      mappings.find(
        (mapping) =>
          mapping.repositoryNameWithOwner.toLowerCase() ===
          formState.repositoryNameWithOwner.trim().toLowerCase(),
      ),
    [formState.repositoryNameWithOwner, mappings],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadMappings() {
      try {
        const result = await window.prRosey.repositoryMappings.list();

        if (isMounted) {
          setMappings(result.mappings);
          setLoadError(null);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(getErrorMessage(error, "Repository mappings could not be loaded."));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadMappings();

    return () => {
      isMounted = false;
    };
  }, []);

  const chooseLocalRepository = async () => {
    setIsChoosing(true);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const result = await window.prRosey.repositoryMappings.chooseLocalRepository();

      if (!result) {
        return;
      }

      setInspection(result);
      setFormState((current) => ({
        repositoryNameWithOwner: result.repositoryNameWithOwner ?? current.repositoryNameWithOwner,
        localPath: result.localPath,
      }));
    } catch (error) {
      setActionError(getErrorMessage(error, "Local repository could not be inspected."));
    } finally {
      setIsChoosing(false);
    }
  };

  const saveMapping = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const savedMapping = await window.prRosey.repositoryMappings.save({
        repositoryNameWithOwner: formState.repositoryNameWithOwner,
        localPath: formState.localPath,
      });

      setMappings((current) => replaceMapping(current, savedMapping));
      setFormState(emptyFormState);
      setInspection(null);
      setSuccessMessage(`Connected ${savedMapping.repositoryNameWithOwner}.`);
    } catch (error) {
      setActionError(getErrorMessage(error, "Repository mapping could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const editMapping = (mapping: RepositoryMapping) => {
    setFormState({
      repositoryNameWithOwner: mapping.repositoryNameWithOwner,
      localPath: mapping.localPath,
    });
    setInspection(null);
    setActionError(null);
    setSuccessMessage(null);
  };

  const removeMapping = async (repositoryNameWithOwner: string) => {
    setRemovingRepositoryNameWithOwner(repositoryNameWithOwner);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const result = await window.prRosey.repositoryMappings.remove(repositoryNameWithOwner);
      setMappings(result.mappings);

      if (
        formState.repositoryNameWithOwner.toLowerCase() === repositoryNameWithOwner.toLowerCase()
      ) {
        setFormState(emptyFormState);
        setInspection(null);
      }

      setSuccessMessage(`Removed ${repositoryNameWithOwner}.`);
    } catch (error) {
      setActionError(getErrorMessage(error, "Repository mapping could not be removed."));
    } finally {
      setRemovingRepositoryNameWithOwner(null);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className={tokens.label.eyebrow}>Settings</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Repository mapping</h2>
          <p className={tokens.text.mutedBody}>
            Connect each GitHub repository to the local clone pr-rosey should trust for future
            workspace setup.
          </p>
        </div>
        <a
          className="inline-flex text-sm font-medium text-moss underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-moss/30"
          href="#pull-requests"
        >
          Back to pull requests
        </a>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <form className={`${tokens.card.panel} flex flex-col gap-5 p-5`} onSubmit={saveMapping}>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink">Connect a clone</h3>
            <p className={tokens.text.mutedBody}>
              Pick a folder once. If it has a GitHub origin, the repository name fills itself in.
            </p>
          </div>

          <div className={tokens.formGroup.base}>
            <label className={tokens.label.field} htmlFor="repository-name-with-owner">
              GitHub repository
            </label>
            <input
              className={`${tokens.input.base} w-full`}
              id="repository-name-with-owner"
              placeholder="owner/repo"
              type="text"
              value={formState.repositoryNameWithOwner}
              onChange={(event) => {
                setFormState((current) => ({
                  ...current,
                  repositoryNameWithOwner: event.target.value,
                }));
                setSuccessMessage(null);
              }}
            />
          </div>

          <div className={tokens.formGroup.base}>
            <label className={tokens.label.field} htmlFor="local-path">
              Local clone
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={`${tokens.input.base} min-w-0 flex-1 font-mono`}
                id="local-path"
                placeholder="/Users/you/Developer/owner/repo"
                type="text"
                value={formState.localPath}
                onChange={(event) => {
                  setFormState((current) => ({ ...current, localPath: event.target.value }));
                  setInspection(null);
                  setSuccessMessage(null);
                }}
              />
              <button
                className={tokens.button.secondary}
                disabled={isChoosing}
                type="button"
                onClick={chooseLocalRepository}
              >
                {isChoosing ? "Choosing" : "Choose folder"}
              </button>
            </div>
          </div>

          {inspection ? <InspectionMessage inspection={inspection} /> : null}
          {selectedMapping ? (
            <p className={tokens.text.meta}>
              Saving will update the existing mapping last changed{" "}
              {formatRelativeDate(selectedMapping.updatedAt)}.
            </p>
          ) : null}
          {actionError ? <p className={tokens.text.error}>{actionError}</p> : null}
          {successMessage ? <p className={tokens.text.success}>{successMessage}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <button className={tokens.button.primary} disabled={isSaveDisabled} type="submit">
              {isSaving ? "Saving" : selectedMapping ? "Update mapping" : "Save mapping"}
            </button>
            <button
              className={tokens.button.quiet}
              type="button"
              onClick={() => {
                setFormState(emptyFormState);
                setInspection(null);
                setActionError(null);
                setSuccessMessage(null);
              }}
            >
              Clear
            </button>
          </div>
        </form>

        <aside className={`${tokens.card.panel} flex flex-col gap-4 p-5`}>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink">Connected clones</h3>
            <p className={tokens.text.mutedBody}>
              {mappings.length === 1
                ? "1 repository is mapped."
                : `${mappings.length} repositories are mapped.`}
            </p>
          </div>

          {loadError ? <p className={tokens.text.error}>{loadError}</p> : null}
          {isLoading ? <p className={tokens.text.mutedBody}>Loading mappings...</p> : null}
          {!isLoading && !loadError && mappings.length === 0 ? (
            <div className="rounded-md border border-dashed border-line px-4 py-5">
              <p className="text-sm font-medium text-ink">No repositories connected yet.</p>
              <p className={tokens.text.mutedBody}>
                Choose a local clone to make it available for future managed workspaces.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {mappings.map((mapping) => (
              <RepositoryMappingRow
                key={mapping.repositoryNameWithOwner}
                mapping={mapping}
                removingRepositoryNameWithOwner={removingRepositoryNameWithOwner}
                onEdit={editMapping}
                onRemove={removeMapping}
              />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

interface InspectionMessageProps {
  inspection: LocalRepositoryInspection;
}

function InspectionMessage({ inspection }: InspectionMessageProps) {
  const isReady = inspection.status === "ready";

  return (
    <div className="rounded-md border border-line bg-paper px-4 py-3">
      <div className={tokens.status.item}>
        <span
          className={`${tokens.status.dot} ${
            isReady ? tokens.statusDot.ready : tokens.statusDot.error
          }`}
        />
        <span className={tokens.status.label}>{inspection.message}</span>
      </div>
      {inspection.remoteUrl ? (
        <p className={`${tokens.text.meta} mt-2 break-all font-mono`}>{inspection.remoteUrl}</p>
      ) : null}
    </div>
  );
}

interface RepositoryMappingRowProps {
  mapping: RepositoryMapping;
  removingRepositoryNameWithOwner: string | null;
  onEdit: (mapping: RepositoryMapping) => void;
  onRemove: (repositoryNameWithOwner: string) => void;
}

function RepositoryMappingRow({
  mapping,
  removingRepositoryNameWithOwner,
  onEdit,
  onRemove,
}: RepositoryMappingRowProps) {
  const isRemoving =
    removingRepositoryNameWithOwner?.toLowerCase() ===
    mapping.repositoryNameWithOwner.toLowerCase();

  return (
    <article className={`${tokens.card.section} p-4`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h4 className="truncate text-sm font-semibold text-ink">
            {mapping.repositoryNameWithOwner}
          </h4>
          <p className="break-all font-mono text-xs text-muted">{mapping.localPath}</p>
          <p className={tokens.text.meta}>Updated {formatRelativeDate(mapping.updatedAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button className={tokens.button.quiet} type="button" onClick={() => onEdit(mapping)}>
            Edit
          </button>
          <button
            className={tokens.button.quiet}
            disabled={isRemoving}
            type="button"
            onClick={() => onRemove(mapping.repositoryNameWithOwner)}
          >
            {isRemoving ? "Removing" : "Remove"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default SettingsPage;
