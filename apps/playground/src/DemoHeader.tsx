import type { ReactNode } from "react";
import { demoHubPath } from "./demo-routes";

export interface DemoHeaderProps {
  title: string;
  description: string;
  shortcutSummary?: readonly string[];
  children?: ReactNode;
}

export function DemoHeader({
  title,
  description,
  shortcutSummary = [],
  children,
}: DemoHeaderProps) {
  return (
    <header className="DemoHeader">
      <div className="DemoHeaderCopy">
        <a className="DemoHeaderBrand" href={demoHubPath}>
          Focusgrid
        </a>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
          {children}
        </div>
      </div>
      <div className="DemoHeaderAside">
        {shortcutSummary.length > 0 ? (
          <div className="ShortcutSummary" aria-label="Demo shortcuts">
            {shortcutSummary.map((shortcut) => (
              <kbd key={shortcut}>{shortcut}</kbd>
            ))}
          </div>
        ) : null}
        <a className="DemoHeaderLink" href={demoHubPath}>
          All demos
        </a>
      </div>
    </header>
  );
}
