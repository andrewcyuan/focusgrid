# @focusgrid/focusgrid

Pane layout, DOM behavior, and React bindings for keyboard-native web
interfaces.

This package intentionally has no root export. Import the layer you need:

```tsx
import { createFocusGridController } from "@focusgrid/focusgrid/core";
import { createFocusGridDomController } from "@focusgrid/focusgrid/dom";
import { FocusGrid } from "@focusgrid/focusgrid/react";
import "@focusgrid/focusgrid/react/styles.css";
```

See the Focusgrid docs in the repository for usage and API details.

## Application focus management

Focusgrid normally leaves DOM focus policy entirely to the client. When a grid
is the primary keyboard surface inside an application shell, opt into
application focus management with a wrapper ref:

```tsx
import { useRef } from "react";
import { FocusGrid } from "@focusgrid/focusgrid/react";

function MailApp() {
  const applicationRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={applicationRef}>
      <header>Mail</header>
      <FocusGrid
        controller={controller}
        focusManagement={{
          mode: "application",
          scopeRef: applicationRef,
        }}
        renderPane={renderPane}
      />
    </div>
  );
}
```

Logical pane focus (`activePaneId`) and browser DOM focus are separate. In
application mode, Focusgrid remembers the last focused descendant of every
pane and restores the active pane when the window is reactivated, when a pane
change occurs while focus is inside the grid or otherwise unowned, and after a
primary click on static chrome inside the application scope. Restoration uses
the remembered descendant, then the first enabled tabbable descendant, then
the pane shell.

Inputs, buttons, links, editable elements, dialogs, and other interactive
controls outside the grid keep intentional focus. Keyboard listeners remain
attached to the Focusgrid root; application mode restores focus ownership but
does not make shortcuts document-global or turn the grid into a focus trap.

An application scope must contain its grid and should contain only one
application-managed Focusgrid. Use the default manual mode when a grid is not
the application's primary keyboard surface.
