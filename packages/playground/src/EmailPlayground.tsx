import { Composite, CompositeItem, useCompositeStore } from "@ariakit/react";
import {
  createCompositeNavigationKeymap,
  useCompositeShortcutRouter,
  type CompositeNavigationShortcutArgs,
  type CompositeNavigationShortcutId,
} from "@focusgrid/ariakit-adapter/react";
import {
  findPaneNode,
  type FocusGridControllerState,
} from "@focusgrid/focusgrid/core";
import {
  FocusGrid,
  useFocusGridController,
  type PaneComponentProps,
} from "@focusgrid/focusgrid/react";
import { parseKeySequence, type ShortcutBinding } from "@focusgrid/shortcut-engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoHeader } from "./DemoHeader";
import {
  mockMailboxes,
  mockMessages,
  mockThreads,
  type MockMailbox,
  type MockMessage,
  type MockThread,
} from "./email-data";
import {
  createDemoPaneKeymap,
  paneNavigationShortcuts,
} from "./pane-navigation";

type EmailCollectionAction = CompositeNavigationShortcutId | "open";
type EmailCollectionArgs = CompositeNavigationShortcutArgs | undefined;

const emailPaneKeymap = createDemoPaneKeymap();
const collectionShortcuts = ["Arrows", "H/J/K/L", "Enter"] as const;
const emailCollectionKeymap: ShortcutBinding<
  undefined,
  EmailCollectionAction,
  EmailCollectionArgs
>[] = [
  ...createCompositeNavigationKeymap({
    overrides: {
      "move-left": "H",
      "move-right": "L",
      "move-up": "K",
      "move-down": "J",
    },
  }),
  { sequence: parseKeySequence("Enter"), action: "open" },
];

function createEmailState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "email-root-split",
      direction: "horizontal",
      sizes: [0.25, 0.75],
      children: [
        {
          kind: "pane",
          id: "email-sidebar-node",
          paneId: "email-sidebar",
          minWidth: 180,
          minHeight: 280,
          canRemove: false,
        },
        {
          kind: "pane",
          id: "email-inbox-node",
          paneId: "email-inbox",
          minWidth: 300,
          minHeight: 280,
          canRemove: false,
        },
      ],
    },
    activePaneId: "email-inbox",
    container: { width: 0, height: 0 },
  };
}

export function EmailPlayground() {
  const controller = useFocusGridController(createEmailState);
  const applicationRef = useRef<HTMLDivElement>(null);
  const [mailboxId, setMailboxId] =
    useState<MockMailbox["id"]>("inbox");
  const [activeThreadId, setActiveThreadId] = useState("field-notes");
  const [readerThreadId, setReaderThreadId] = useState<string | null>(null);

  const threads = useMemo(
    () => mockThreads.filter((thread) => thread.mailboxId === mailboxId),
    [mailboxId],
  );
  const readerThread = mockThreads.find(
    (thread) => thread.id === readerThreadId,
  );
  const readerMessage = mockMessages.find(
    (message) => message.threadId === readerThreadId,
  );

  const selectMailbox = useCallback(
    (nextMailboxId: MockMailbox["id"]) => {
      const firstThread = mockThreads.find(
        (thread) => thread.mailboxId === nextMailboxId,
      );

      controller.api.remove("email-reader");
      setReaderThreadId(null);
      setMailboxId(nextMailboxId);
      setActiveThreadId(firstThread?.id ?? "");
      controller.api.focus("email-inbox");
    },
    [controller],
  );

  const openThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
      setReaderThreadId(threadId);

      if (findPaneNode(controller.getState(), "email-reader")) {
        controller.api.focus("email-reader");
        return;
      }

      controller.api.wrapRootInSplit({
        side: "right",
        newPaneId: "email-reader",
        minWidth: 300,
        minHeight: 280,
        canRemove: true,
      });
    },
    [controller],
  );

  const closeReader = useCallback(() => {
    controller.api.remove("email-reader");
    setReaderThreadId(null);
    controller.api.focus("email-inbox");
  }, [controller]);

  return (
    <div ref={applicationRef} className="EmailPage">
      <DemoHeader
        title="Email workspace"
        description="A mocked inbox for testing focus across changing pane topology."
        shortcutSummary={[...collectionShortcuts, ...paneNavigationShortcuts]}
      />
      <EmailTopBar mailboxId={mailboxId} />
      <FocusGrid
        controller={controller}
        keymap={emailPaneKeymap}
        focusManagement={{ mode: "application", scopeRef: applicationRef }}
        className="EmailFocusGrid"
        renderPane={(context) => {
          switch (context.paneId) {
            case "email-sidebar":
              return (
                <MailboxSidebar
                  {...context}
                  mailboxId={mailboxId}
                  onSelectMailbox={selectMailbox}
                />
              );
            case "email-inbox":
              return (
                <ThreadList
                  {...context}
                  activeThreadId={activeThreadId}
                  mailbox={mockMailboxes.find((mailbox) => mailbox.id === mailboxId)!}
                  threads={threads}
                  onActiveThreadChange={setActiveThreadId}
                  onOpenThread={openThread}
                />
              );
            case "email-reader":
              return readerThread && readerMessage ? (
                <Reader
                  {...context}
                  message={readerMessage}
                  thread={readerThread}
                  onBack={closeReader}
                />
              ) : (
                <section className="EmailPane EmailReader" />
              );
            default:
              return null;
          }
        }}
      />
    </div>
  );
}

function EmailTopBar({ mailboxId }: { mailboxId: MockMailbox["id"] }) {
  const mailbox = mockMailboxes.find((candidate) => candidate.id === mailboxId)!;

  return (
    <div className="EmailTopBar" aria-label="Email workspace status">
      <strong>Correspondence</strong>
      <span>{mailbox.label} · local demo data</span>
    </div>
  );
}

interface MailboxSidebarProps extends PaneComponentProps {
  mailboxId: MockMailbox["id"];
  onSelectMailbox: (mailboxId: MockMailbox["id"]) => void;
}

function MailboxSidebar({
  active,
  mailboxId,
  onSelectMailbox,
}: MailboxSidebarProps) {
  const composite = useCompositeStore({ orientation: "vertical" });
  const selectActiveMailbox = useCallback(() => {
    const activeId = composite.getState().activeId;
    const mailbox = mockMailboxes.find(
      (candidate) => mailboxRowId(candidate.id) === activeId,
    );
    if (mailbox) onSelectMailbox(mailbox.id);
  }, [composite, onSelectMailbox]);
  const onMatch = useCollectionNavigation(composite, selectActiveMailbox);
  const router = useCompositeShortcutRouter({
    keymap: emailCollectionKeymap,
    onMatch,
  });

  useEffect(() => {
    if (active) composite.move(mailboxRowId(mailboxId));
  }, [active, composite, mailboxId]);

  return (
    <aside className="EmailPane MailboxSidebar" data-active={active}>
      <div className="EmailPaneHeading">
        <span>Mailboxes</span>
        <small>{mockMailboxes.length} views</small>
      </div>
      <Composite
        {...router.compositeProps}
        store={composite}
        className="MailboxComposite"
        aria-label="Mailboxes"
      >
        {mockMailboxes.map((mailbox) => (
          <CompositeItem
            store={composite}
            id={mailboxRowId(mailbox.id)}
            className="MailboxRow"
            data-mailbox-id={mailbox.id}
            data-selected={mailbox.id === mailboxId}
            key={mailbox.id}
            onClick={() => onSelectMailbox(mailbox.id)}
          >
            <span>{mailbox.label}</span>
            <small>{mailbox.count}</small>
          </CompositeItem>
        ))}
      </Composite>
      <p className="MailboxNote">Fictional messages. Nothing leaves this page.</p>
    </aside>
  );
}

interface ThreadListProps extends PaneComponentProps {
  activeThreadId: string;
  mailbox: MockMailbox;
  threads: readonly MockThread[];
  onActiveThreadChange: (threadId: string) => void;
  onOpenThread: (threadId: string) => void;
}

function ThreadList({
  active,
  activeThreadId,
  mailbox,
  threads,
  onActiveThreadChange,
  onOpenThread,
}: ThreadListProps) {
  const composite = useCompositeStore({ orientation: "vertical" });
  const openActiveThread = useCallback(() => {
    const activeId = composite.getState().activeId;
    const thread = threads.find(
      (candidate) => threadRowId(candidate.id) === activeId,
    );
    if (thread) onOpenThread(thread.id);
  }, [composite, onOpenThread, threads]);
  const onMatch = useCollectionNavigation(composite, openActiveThread);
  const router = useCompositeShortcutRouter({
    keymap: emailCollectionKeymap,
    onMatch,
  });

  useEffect(() => {
    if (!active) return;
    const target = threads.some((thread) => thread.id === activeThreadId)
      ? activeThreadId
      : threads[0]?.id;
    if (target) composite.move(threadRowId(target));
  }, [active, activeThreadId, composite, threads]);

  return (
    <section className="EmailPane ThreadList" data-active={active}>
      <div className="EmailPaneHeading ThreadListHeading">
        <span>{mailbox.label}</span>
        <small>{threads.length} conversations</small>
      </div>
      <Composite
        {...router.compositeProps}
        store={composite}
        className="ThreadComposite"
        aria-label={`${mailbox.label} threads`}
      >
        {threads.map((thread) => (
          <CompositeItem
            store={composite}
            id={threadRowId(thread.id)}
            className="ThreadRow"
            data-thread-id={thread.id}
            data-unread={thread.unread ?? false}
            key={thread.id}
            onClick={() => onOpenThread(thread.id)}
            onFocus={() => onActiveThreadChange(thread.id)}
          >
            <span className="ThreadSender">{thread.sender}</span>
            <time>{thread.date}</time>
            <strong>{thread.subject}</strong>
            <span className="ThreadPreview">{thread.preview}</span>
          </CompositeItem>
        ))}
      </Composite>
    </section>
  );
}

interface ReaderProps extends PaneComponentProps {
  thread: MockThread;
  message: MockMessage;
  onBack: () => void;
}

function Reader({ active, thread, message, onBack }: ReaderProps) {
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active) backRef.current?.focus({ preventScroll: true });
  }, [active, thread.id]);

  return (
    <article className="EmailPane EmailReader" data-active={active}>
      <div className="ReaderToolbar">
        <button ref={backRef} type="button" onClick={onBack}>
          ← Back
        </button>
        <span>Message</span>
      </div>
      <header className="ReaderHeader">
        <h2>{thread.subject}</h2>
        <dl>
          <div><dt>From</dt><dd>{message.from}</dd></div>
          <div><dt>To</dt><dd>{message.to}</dd></div>
          <div><dt>Date</dt><dd>{message.date}</dd></div>
        </dl>
      </header>
      <div className="ReaderBody">
        {message.body.map((paragraph, index) => (
          <p key={`${thread.id}-${index}`}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}

type CompositeStore = ReturnType<typeof useCompositeStore>;

function useCollectionNavigation(
  composite: CompositeStore,
  onOpen: () => void,
) {
  return useCallback(
    ({ action }: { action: EmailCollectionAction }) => {
      switch (action) {
        case "move-left":
        case "move-up":
          composite.move(composite.previous());
          break;
        case "move-right":
        case "move-down":
          composite.move(composite.next());
          break;
        case "move-start":
          composite.move(composite.first());
          break;
        case "move-end":
          composite.move(composite.last());
          break;
        case "open":
          onOpen();
          break;
      }
    },
    [composite, onOpen],
  );
}

function mailboxRowId(mailboxId: MockMailbox["id"]) {
  return `mailbox-${mailboxId}`;
}

function threadRowId(threadId: string) {
  return `thread-${threadId}`;
}
