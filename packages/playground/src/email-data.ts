export interface MockMailbox {
  id: "inbox" | "starred" | "archive";
  label: string;
  count: number;
}

export interface MockThread {
  id: string;
  mailboxId: MockMailbox["id"];
  sender: string;
  subject: string;
  preview: string;
  date: string;
  unread?: boolean;
}

export interface MockMessage {
  threadId: MockThread["id"];
  from: string;
  to: string;
  date: string;
  body: readonly string[];
}

export const mockMailboxes: readonly MockMailbox[] = [
  { id: "inbox", label: "Inbox", count: 4 },
  { id: "starred", label: "Starred", count: 2 },
  { id: "archive", label: "Archive", count: 3 },
];

export const mockThreads: readonly MockThread[] = [
  {
    id: "field-notes",
    mailboxId: "inbox",
    sender: "Mara Bell",
    subject: "Field notes from the keyboard lab",
    preview: "The latest focus tests are quiet in all the right ways…",
    date: "9:42 AM",
    unread: true,
  },
  {
    id: "review-window",
    mailboxId: "inbox",
    sender: "Theo Grant",
    subject: "A review window for Thursday",
    preview: "I blocked half an hour so we can walk the interaction together…",
    date: "8:15 AM",
  },
  {
    id: "studio-keys",
    mailboxId: "inbox",
    sender: "Inez Park",
    subject: "Keys from the old studio",
    preview: "Found the spare set behind the blue cabinet…",
    date: "Yesterday",
    unread: true,
  },
  {
    id: "train-reading",
    mailboxId: "inbox",
    sender: "Jonah Reed",
    subject: "Reading for the train",
    preview: "Two short essays and one very long interview…",
    date: "Mon",
  },
  {
    id: "release-checklist",
    mailboxId: "starred",
    sender: "Celia North",
    subject: "Release checklist, pared back",
    preview: "I removed the items the browser suite already proves…",
    date: "Jul 18",
    unread: true,
  },
  {
    id: "spring-map",
    mailboxId: "starred",
    sender: "Noor Ali",
    subject: "The spring map is ready",
    preview: "Every path now has a name and a useful landmark…",
    date: "Jul 12",
  },
  {
    id: "receipt-paper",
    mailboxId: "archive",
    sender: "Paper & Wire",
    subject: "Receipt for order PW-1842",
    preview: "Your order of grid pads and cobalt pencils has shipped…",
    date: "Jun 30",
  },
  {
    id: "workshop-followup",
    mailboxId: "archive",
    sender: "Ada Moreno",
    subject: "Workshop follow-up",
    preview: "Here are the examples we promised to share with the group…",
    date: "Jun 21",
  },
  {
    id: "quiet-week",
    mailboxId: "archive",
    sender: "Ravi Sen",
    subject: "A quiet week in August",
    preview: "The cabin is free if you want a few days without notifications…",
    date: "Jun 08",
  },
];

const messageBodies: Record<string, readonly string[]> = {
  "field-notes": [
    "Hi Alex,",
    "The latest focus tests are quiet in all the right ways. Moving between the list and reader now restores the exact row I left, even after the pane topology changes.",
    "I left a few notes beside the keyboard matrix. Nothing urgent—just the cases worth keeping as regressions.",
    "Mara",
  ],
  "review-window": [
    "I blocked half an hour on Thursday so we can walk the interaction together.",
    "The main question is whether the pane shortcut should feel global when a textbox owns focus. I think the current capture-phase behavior is the right contract.",
    "Theo",
  ],
  "studio-keys": [
    "Found the spare set behind the blue cabinet. I can bring them by after lunch, or leave them with the front desk if that is easier.",
    "Inez",
  ],
  "train-reading": [
    "Two short essays and one very long interview for the train. Start with the piece about tools that disappear when they work well.",
    "Jonah",
  ],
  "release-checklist": [
    "I removed the checklist items the browser suite already proves. What remains is packaging, the public API diff, and a final keyboard pass in WebKit.",
    "Celia",
  ],
  "spring-map": [
    "Every path now has a name and a useful landmark. The north loop is still muddy, but it is the best view by far.",
    "Noor",
  ],
};

export const mockMessages: readonly MockMessage[] = mockThreads.map((thread) => ({
  threadId: thread.id,
  from: `${thread.sender} <${thread.sender.toLowerCase().replace(" ", ".")}@example.test>`,
  to: "Alex Yuan <alex@example.test>",
  date: thread.date,
  body: messageBodies[thread.id] ?? [thread.preview],
}));
