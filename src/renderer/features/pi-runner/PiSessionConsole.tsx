import type {
  PiRunnerActivityEvent,
  PiRunnerActivityKind,
  PiRunnerActivityStatus,
  PiRunnerConversationMessage,
  PiRunnerSessionSnapshot,
} from "@/shared/piRunner";
import { tokens } from "@/styles/tokens";

interface PiSessionConsoleProps {
  abortingSessionId: string | null;
  session: PiRunnerSessionSnapshot | null;
  onAbortSession: (sessionId: string) => Promise<void>;
}

function formatDateTime(timestamp: string | null): string {
  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatShortTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function hasStopPath(session: PiRunnerSessionSnapshot): boolean {
  return (
    session.status === "starting" || session.status === "running" || session.status === "aborting"
  );
}

export function PiSessionConsole({
  abortingSessionId,
  session,
  onAbortSession,
}: PiSessionConsoleProps) {
  if (!session) {
    return (
      <aside className="flex h-full min-h-[28rem] flex-col bg-[#0f110e]">
        <div className="border-b border-line bg-panel px-5 py-5">
          <h2 className="text-sm font-semibold text-ink">Pi session</h2>
          <p className="mt-1 text-xs text-muted">
            Start Pi from a pull request, or open a visible session from a PR row.
          </p>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center">
          <div className="max-w-sm">
            <h3 className="text-sm font-semibold text-ink">No session selected</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Session metadata, output, errors, and exit state will appear here without reading log
              files from the renderer.
            </p>
          </div>
        </div>
        <SteeringComposer />
      </aside>
    );
  }

  const showStopAction = hasStopPath(session);
  const statusLabel = getPiRunnerStatusLabel(session.status);

  return (
    <aside className="flex h-full min-h-[36rem] flex-col bg-[#0f110e]">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-panel px-5 py-4">
        <div className="min-w-0">
          <div className={tokens.status.item}>
            <span
              aria-hidden="true"
              className={`${tokens.status.dot} ${getPiRunnerStatusDotClassName(session.status)}`}
            />
            <span className={tokens.status.label}>{statusLabel}</span>
            <span className={tokens.status.value}>
              {session.pid ? `pid ${session.pid}` : session.id}
            </span>
          </div>
          <h2 className="mt-2 truncate text-sm font-semibold text-ink">
            {session.repositoryNameWithOwner}#{session.pullRequestNumber}
          </h2>
          <p className="mt-1 truncate text-xs text-muted">{session.pullRequestUrl}</p>
        </div>

        {showStopAction ? (
          <button
            className={tokens.button.quiet}
            disabled={session.status === "aborting" || abortingSessionId === session.id}
            type="button"
            onClick={() => {
              void onAbortSession(session.id);
            }}
          >
            {session.status === "aborting" || abortingSessionId === session.id
              ? "Stopping"
              : "Stop Pi"}
          </button>
        ) : null}
      </div>

      <SessionDetails session={session} />

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto]">
        <SessionStateNote session={session} />
        <ChatTranscript conversation={session.conversation} events={session.activityEvents} />
        <SteeringComposer />
      </div>
    </aside>
  );
}

interface SessionDetailsProps {
  session: PiRunnerSessionSnapshot;
}

function SessionDetails({ session }: SessionDetailsProps) {
  return (
    <details className="shrink-0 border-b border-line bg-[#11130f] px-5 py-3">
      <summary className="cursor-default text-xs font-medium text-muted">
        Session details
        <span className="ml-2 font-normal text-faint">
          {session.localPath} / {formatDateTime(session.updatedAt)}
        </span>
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <MetadataItem label="Workspace" value={session.localPath} />
        <MetadataItem label="Log file" value={session.logFilePath} />
        <MetadataItem label="Started" value={formatDateTime(session.startedAt)} />
        <MetadataItem label="Last activity" value={formatDateTime(session.updatedAt)} />
        <MetadataItem label="Session id" value={session.id} />
        <MetadataItem label="PID" value={session.pid ? String(session.pid) : "-"} />
        <MetadataItem label="Exited" value={formatDateTime(session.exitedAt)} />
        <MetadataItem
          label="Exit code"
          value={session.exitCode === null ? "-" : String(session.exitCode)}
        />
      </dl>
    </details>
  );
}

interface MetadataItemProps {
  label: string;
  value: string;
}

function MetadataItem({ label, value }: MetadataItemProps) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</dt>
      <dd className="mt-1 truncate font-mono text-xs text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}

interface SessionStateNoteProps {
  session: PiRunnerSessionSnapshot;
}

function SessionStateNote({ session }: SessionStateNoteProps) {
  if (session.error) {
    return (
      <div className="border-b border-rosey/35 bg-rosey/10 px-5 py-3 text-xs text-rosey">
        {session.error}
      </div>
    );
  }

  if (session.status === "exited" || session.status === "aborted" || session.status === "failed") {
    return (
      <div className="border-b border-line bg-panel/70 px-5 py-3 text-xs text-muted">
        Session {getPiRunnerStatusLabel(session.status).toLowerCase()}
        {session.exitCode === null ? "." : ` with exit code ${session.exitCode}.`}
      </div>
    );
  }

  return (
    <div className="border-b border-line bg-blue-400/10 px-5 py-3 text-xs text-muted">
      Pi is active. The renderer can stop the process, but follow-up steering is not enabled yet.
    </div>
  );
}

interface ChatTranscriptProps {
  conversation: PiRunnerConversationMessage[];
  events: PiRunnerActivityEvent[];
}

type ChatDisplayItem =
  | {
      type: "message";
      message: PiRunnerConversationMessage;
      timestamp: string;
    }
  | {
      type: "event";
      event: PiRunnerActivityEvent;
      timestamp: string;
    }
  | {
      type: "rollup";
      count: number;
      event: PiRunnerActivityEvent;
      events: PiRunnerActivityEvent[];
      timestamp: string;
    };

const maxVisibleChatItems = 32;

function ChatTranscript({ conversation, events }: ChatTranscriptProps) {
  const displayableEventCount = events.filter((event) =>
    shouldShowActivityEvent(event, conversation.length > 0),
  ).length;
  const displayItems = createChatDisplayItems(conversation, events);
  const hiddenCount = Math.max(
    0,
    conversation.length + displayableEventCount - countRawItems(displayItems),
  );

  return (
    <div className="min-h-0 overflow-auto px-5 py-5">
      {hiddenCount > 0 ? (
        <p className="mb-4 text-center text-xs text-faint">
          {hiddenCount} older updates are still available in the log file.
        </p>
      ) : null}

      {displayItems.length === 0 ? (
        <div className="flex min-h-full items-center justify-center text-center">
          <p className="max-w-sm text-sm leading-6 text-muted">
            Pi messages will appear here as a normal chat once the session starts producing output.
          </p>
        </div>
      ) : null}

      <ol className="space-y-3">
        {displayItems.map((item) => {
          if (item.type === "message") {
            return <ChatMessageItem key={`message-${item.message.id}`} message={item.message} />;
          }

          if (item.type === "rollup") {
            return (
              <ActivityRollup
                count={item.count}
                event={item.event}
                events={item.events}
                key={`rollup-${item.event.timestamp}-${item.event.kind}-${item.count}-${item.event.summary}`}
              />
            );
          }

          return (
            <ActivityEventItem
              event={item.event}
              key={`event-${item.event.timestamp}-${item.event.kind}-${item.event.title}-${item.event.summary}`}
            />
          );
        })}
      </ol>
    </div>
  );
}

interface ChatMessageItemProps {
  message: PiRunnerConversationMessage;
}

function ChatMessageItem({ message }: ChatMessageItemProps) {
  const isAssistant = message.role === "assistant";
  const isUser = message.role === "user";

  return (
    <li className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <article className={`max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl border px-4 py-3 shadow-sm shadow-black/10 ${
            isAssistant
              ? "rounded-bl-md border-moss/30 bg-moss/[0.055]"
              : "rounded-br-md border-line bg-panel/90"
          }`}
        >
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{message.body}</p>
        </div>
        <div
          className={`mt-1 flex items-center gap-2 text-[11px] text-faint ${
            isUser ? "justify-end" : "justify-start"
          }`}
        >
          <span>{isUser ? "You" : "Pi"}</span>
          <span aria-hidden="true">/</span>
          <time dateTime={message.timestamp}>{formatShortTime(message.timestamp)}</time>
          {message.status === "complete" ? null : (
            <>
              <span aria-hidden="true">/</span>
              <span>{getConversationStatusLabel(message.status)}</span>
            </>
          )}
        </div>
      </article>
    </li>
  );
}

function createChatDisplayItems(
  conversation: PiRunnerConversationMessage[],
  events: PiRunnerActivityEvent[],
): ChatDisplayItem[] {
  const eventItems: ChatDisplayItem[] = events
    .filter((event) => shouldShowActivityEvent(event, conversation.length > 0))
    .map((event) => ({ type: "event", event, timestamp: event.timestamp }));
  const messageItems: ChatDisplayItem[] = conversation.map((message) => ({
    type: "message",
    message,
    timestamp: message.timestamp,
  }));

  const chronologicalItems = [...messageItems, ...eventItems].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );

  return rollUpDisplayItems(chronologicalItems).slice(-maxVisibleChatItems);
}

function rollUpDisplayItems(displayItems: ChatDisplayItem[]): ChatDisplayItem[] {
  const items: ChatDisplayItem[] = [];
  let pendingRollup: {
    count: number;
    event: PiRunnerActivityEvent;
    events: PiRunnerActivityEvent[];
    key: string;
  } | null = null;

  const flushRollup = () => {
    if (!pendingRollup) {
      return;
    }

    items.push(
      pendingRollup.count === 1
        ? { type: "event", event: pendingRollup.event, timestamp: pendingRollup.event.timestamp }
        : {
            type: "rollup",
            count: pendingRollup.count,
            event: pendingRollup.event,
            events: pendingRollup.events,
            timestamp: pendingRollup.event.timestamp,
          },
    );
    pendingRollup = null;
  };

  for (const item of displayItems) {
    if (item.type !== "event") {
      flushRollup();
      items.push(item);
      continue;
    }

    const { event } = item;

    if (!shouldRollUpEvent(event)) {
      flushRollup();
      items.push({ type: "event", event, timestamp: event.timestamp });
      continue;
    }

    const rollupKey = getRollupKey(event);

    if (pendingRollup?.key === rollupKey) {
      pendingRollup = {
        count: pendingRollup.count + 1,
        event,
        events: [...pendingRollup.events, event],
        key: pendingRollup.key,
      };
      continue;
    }

    flushRollup();
    pendingRollup = { count: 1, event, events: [event], key: rollupKey };
  }

  flushRollup();

  return items;
}

function countRawItems(items: ChatDisplayItem[]): number {
  return items.reduce((total, item) => total + (item.type === "rollup" ? item.count : 1), 0);
}

function shouldShowActivityEvent(event: PiRunnerActivityEvent, hasConversation: boolean): boolean {
  if (event.kind === "system" && event.title === "Turn started") {
    return false;
  }

  if (!hasConversation) {
    return true;
  }

  return event.kind !== "user-prompt" && event.kind !== "pi-response";
}

function shouldRollUpEvent(event: PiRunnerActivityEvent): boolean {
  if (event.kind === "tool-activity") {
    return true;
  }

  if (event.kind !== "system") {
    return false;
  }

  if (event.title === "Stop requested") {
    return false;
  }

  return true;
}

function getRollupKey(event: PiRunnerActivityEvent): string {
  if (event.kind === "tool-activity") {
    return event.kind;
  }

  return event.kind;
}

interface ActivityRollupProps {
  count: number;
  event: PiRunnerActivityEvent;
  events: PiRunnerActivityEvent[];
}

function ActivityRollup({ count, event, events }: ActivityRollupProps) {
  if (event.kind === "tool-activity") {
    return (
      <CompactActivityItem
        label="Pi used tools"
        status={event.status}
        summary={formatToolActivitySummary(events, count)}
        timestamp={event.timestamp}
      />
    );
  }

  const label = getEventKindLabel(event.kind).toLowerCase();

  return (
    <li className="flex justify-center">
      <article className="min-w-0 max-w-[78%] rounded-lg border border-line bg-panel/45 px-3 py-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${getEventStatusDotClassName(event.status)}`}
            />
            <h4 className="truncate text-xs font-semibold text-ink">
              {count} {label} updates
            </h4>
          </div>
          <time className="shrink-0 text-[11px] text-faint" dateTime={event.timestamp}>
            {formatShortTime(event.timestamp)}
          </time>
        </div>
        <p className="mt-1 truncate text-xs text-muted">{event.summary}</p>
      </article>
    </li>
  );
}

interface ActivityEventItemProps {
  event: PiRunnerActivityEvent;
}

function ActivityEventItem({ event }: ActivityEventItemProps) {
  if (event.kind === "tool-activity") {
    return (
      <CompactActivityItem
        label={event.title}
        status={event.status}
        summary={event.summary}
        timestamp={event.timestamp}
      />
    );
  }

  return (
    <li className="flex justify-center">
      <article
        className={`min-w-0 max-w-[78%] rounded-lg border p-0 shadow-sm shadow-black/10 ${getEventCardClassName(
          event.kind,
        )}`}
      >
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-line/70 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${getEventStatusDotClassName(event.status)}`}
            />
            <h4 className="truncate text-xs font-semibold text-ink">{event.title}</h4>
          </div>
          <time className="shrink-0 text-[11px] text-faint" dateTime={event.timestamp}>
            {formatShortTime(event.timestamp)}
          </time>
        </div>
        <div className="px-3 py-3 text-xs leading-5 text-muted">
          <p>{event.summary}</p>
          {event.detail ? (
            <details className="mt-2 rounded-md border border-line/80 bg-paper/80 px-2.5 py-2">
              <summary className="cursor-default text-[11px] font-medium text-muted">
                Machine details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-5 text-muted">
                {event.detail}
              </pre>
            </details>
          ) : null}
        </div>
      </article>
    </li>
  );
}

interface CompactActivityItemProps {
  label: string;
  status: PiRunnerActivityStatus;
  summary: string;
  timestamp: string;
}

function CompactActivityItem({ label, status, summary, timestamp }: CompactActivityItemProps) {
  return (
    <li className="flex justify-center">
      <article className="flex min-w-0 max-w-[78%] items-center gap-2 rounded-full border border-line bg-panel/45 px-3 py-1.5 text-xs shadow-sm shadow-black/10">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${getEventStatusDotClassName(status)}`}
        />
        <h4 className="shrink-0 truncate font-semibold text-ink">{label}</h4>
        <span aria-hidden="true" className="text-faint">
          /
        </span>
        <p className="min-w-0 truncate text-muted">{summary}</p>
        <time className="shrink-0 text-[11px] text-faint" dateTime={timestamp}>
          {formatShortTime(timestamp)}
        </time>
      </article>
    </li>
  );
}

function formatToolActivitySummary(events: PiRunnerActivityEvent[], count: number): string {
  const toolCounts = new Map<string, number>();

  for (const event of events) {
    const toolName = getToolNameFromActivityTitle(event.title);

    if (!toolName) {
      continue;
    }

    toolCounts.set(toolName, (toolCounts.get(toolName) ?? 0) + 1);
  }

  const toolSummary = [...toolCounts.entries()]
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([toolName, toolCount]) => `${toolName} x${toolCount}`)
    .join(", ");

  return toolSummary ? `${count} updates: ${toolSummary}` : `${count} tool updates`;
}

function getToolNameFromActivityTitle(title: string): string | null {
  const match = title.match(/^Tool (?:activity|started|update|finished|failed): (.+)$/);

  return match?.[1] ?? null;
}

function SteeringComposer() {
  return (
    <div className="shrink-0 border-t border-line bg-panel px-5 py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <textarea
          aria-label="Message Pi"
          className={`${tokens.input.base} min-h-16 resize-none`}
          disabled
          placeholder="Message Pi"
        />
        <button className={tokens.button.secondary} disabled type="button">
          Send
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Follow-up messages are disabled for this increment.</p>
    </div>
  );
}

function getPiRunnerStatusLabel(status: PiRunnerSessionSnapshot["status"]): string {
  switch (status) {
    case "starting":
      return "Pi starting";
    case "running":
      return "Pi running";
    case "aborting":
      return "Pi stopping";
    case "exited":
      return "Pi exited";
    case "failed":
      return "Pi failed";
    case "aborted":
      return "Pi stopped";
  }
}

function getPiRunnerStatusDotClassName(status: PiRunnerSessionSnapshot["status"]): string {
  switch (status) {
    case "starting":
    case "running":
    case "aborting":
      return tokens.statusDot.loading;
    case "exited":
      return tokens.statusDot.ready;
    case "failed":
      return tokens.statusDot.missing;
    case "aborted":
      return tokens.statusDot.unknown;
  }
}

function getEventKindLabel(kind: PiRunnerActivityKind): string {
  switch (kind) {
    case "system":
      return "System";
    case "user-prompt":
      return "Prompt";
    case "pi-response":
      return "Pi";
    case "tool-activity":
      return "Tool";
    case "important-output":
      return "Output";
    case "error":
      return "Error";
  }
}

function getEventCardClassName(kind: PiRunnerActivityKind): string {
  switch (kind) {
    case "pi-response":
      return "border-moss/30 bg-moss/[0.055]";
    case "tool-activity":
      return "border-blue-300/25 bg-blue-300/[0.055]";
    case "error":
      return "border-rosey/35 bg-rosey/10";
    case "user-prompt":
      return "border-amber-300/30 bg-amber-300/[0.055]";
    case "important-output":
    case "system":
      return "border-line bg-panel/80";
  }
}

function getEventStatusDotClassName(status: PiRunnerActivityStatus): string {
  switch (status) {
    case "success":
      return tokens.statusDot.ready;
    case "failed":
      return tokens.statusDot.missing;
    case "pending":
      return tokens.statusDot.loading;
    case "info":
      return tokens.statusDot.unknown;
  }
}

function getConversationStatusLabel(status: PiRunnerConversationMessage["status"]): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "streaming":
      return "Writing";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    case "aborted":
      return "Stopped";
  }
}

export default PiSessionConsole;
