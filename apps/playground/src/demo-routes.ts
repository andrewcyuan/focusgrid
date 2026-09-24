export interface DemoRoute {
  path: "/tmux" | "/ariakit" | "/email";
  title: string;
  description: string;
}

export const demoHubPath = "/" as const;

export const demoRoutes: readonly DemoRoute[] = [
  {
    path: "/tmux",
    title: "Tmux playground",
    description: "Split, resize, swap, and close panes with editable shortcuts.",
  },
  {
    path: "/ariakit",
    title: "Ariakit composite",
    description: "Coordinate collection focus with application-managed panes.",
  },
  {
    path: "/email",
    title: "Email workspace",
    description: "Navigate mailboxes, threads, and a dynamic message reader.",
  },
] as const;
