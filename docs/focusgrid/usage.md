# Usage

The playground is the smallest useful FocusGrid example: it creates one
controller, builds a keymap from editable shortcut values, and renders pane
content from the pane render context.

Focusgrid is published as `@focusgrid/focusgrid` with explicit subpath exports.
There is no root package export; import the layer you need:

```tsx
import {
  createDefaultPaneKeymap,
  type FocusGridControllerState,
} from "@focusgrid/focusgrid/core";
import {
  FocusGrid,
  useFocusGridController,
  type PaneComponent,
  type PaneComponentProps,
  type PaneRenderContext,
} from "@focusgrid/focusgrid/react";
import "@focusgrid/focusgrid/react/styles.css";
```

## Container size

Import the stylesheet and give the grid's parent a nonzero width and height.
The grid fills its parent with `width: 100%` and `height: 100%`; its absolutely
positioned panes do not give the parent a height.

```tsx
<div style={{ height: "100dvh" }}>
  <FocusGrid controller={controller} keymap={keymap} renderPane={renderPane} />
</div>
```

For a header above the grid, use a sized flex-column shell and a grid wrapper
with `flex: 1` and `minHeight: 0`. The DOM resize observer updates controller
dimensions after mount, so an initial container size of zero is valid.

## Initial layout

FocusGrid starts from serializable state. The playground uses two panes in a
horizontal split and makes `alpha` active.

```ts
function createInitialState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root-split",
      direction: "horizontal",
      sizes: [0.55, 0.45],
      children: [
        {
          kind: "pane",
          id: "pane-node-alpha",
          paneId: "alpha",
          minWidth: 180,
          minHeight: 120,
        },
        {
          kind: "pane",
          id: "pane-node-beta",
          paneId: "beta",
          minWidth: 180,
          minHeight: 120,
        },
      ],
    },
    activePaneId: "alpha",
    container: {
      width: 0,
      height: 0,
    },
  };
}
```

## Controller and keymap

React code should keep the controller stable for the component lifetime. The
playground does that with `useFocusGridController()`, then rebuilds the keymap
when shortcut settings change.

```tsx
function FocusGridPlayground() {
  const controller = useFocusGridController(createInitialState);
  const [shortcuts, setShortcuts] = useState(loadSavedShortcuts());
  const keymap = useMemo(
    () => createDefaultPaneKeymap({ overrides: shortcuts }).keymap,
    [shortcuts],
  );

  useEffect(() => {
    saveShortcuts(shortcuts);
  }, [shortcuts]);

  return (
    <FocusGrid
      controller={controller}
      keymap={keymap}
      className="PlaygroundFocusGrid"
      renderPane={(ctx) => <PaneSlot ctx={ctx} />}
    />
  );
}
```

See [default keyboard bindings](commands.md#default-keyboard-bindings) for the
shortcut table, disabled actions, and override validation errors.

`FocusGrid` owns the DOM listeners, resize observer, computed pane layout, and
resize handles. The app owns pane content and controller state.

## Rendering panes

The playground maps pane ids to React components and falls back to `TextPane`.

```tsx
const paneComponents: Record<string, PaneComponent> = {
  alpha: TextPane,
  beta: TextPane,
};

function PaneSlot({ ctx }: { ctx: PaneRenderContext }) {
  const Component = paneComponents[ctx.paneId] ?? TextPane;

  return <Component {...ctx} />;
}
```

Pane components receive the pane id, active state, and controller. The textbox
example focuses the active pane's textarea and tells the controller when the
textarea receives focus.

```tsx
function TextPane({ paneId, active, controller }: PaneComponentProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!active || document.activeElement === inputRef.current) {
      return;
    }

    inputRef.current?.focus();
  }, [active]);

  return (
    <section className="TextPane" data-active={active}>
      <textarea
        ref={inputRef}
        defaultValue={`This is pane "${paneId}". Focus this textbox to focus its pane.`}
        onFocus={() => {
          controller.api.focus(paneId);
        }}
      />
    </section>
  );
}
```

This is the default, manual focus contract: DOM focus can live inside pane
content, while FocusGrid tracks the active pane in controller state. Updating
`activePaneId` does not, by itself, move browser focus.

## Application focus management

Use application focus management when a Focusgrid is the primary keyboard
surface inside an application shell. The policy is opt-in; omitting
`focusManagement` preserves the manual behavior above.

Create a ref for the application shell and pass the same ref to `FocusGrid`:

```tsx
function MailApp() {
  const applicationRef = useRef<HTMLDivElement>(null);
  const controller = useFocusGridController(createInitialState);

  return (
    <div
      ref={applicationRef}
      className="MailApp"
      style={{ height: "100dvh", display: "flex", flexDirection: "column" }}
    >
      <header>
        <h1>Mail</h1>
        <a href="/settings">Settings</a>
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <FocusGrid
          controller={controller}
          keymap={createDefaultPaneKeymap().keymap}
          focusManagement={{
            mode: "application",
            scopeRef: applicationRef,
          }}
          renderPane={(ctx) => <MailPane {...ctx} />}
        />
      </div>
    </div>
  );
}
```

`scopeRef.current` must contain the rendered Focusgrid root. A scope should
contain only one application-managed Focusgrid, but it may also contain static
application chrome such as headers, status bars, and toolbars.

Application mode coordinates logical pane focus with browser DOM focus:

- Focusing a descendant of a pane makes that pane logically active.
- Each pane remembers its last focused descendant independently.
- Changing the active pane restores that pane when DOM focus is already inside
  the grid or is otherwise unowned.
- Reactivating the browser window restores the active pane when focus has
  fallen back to the document body, document root, or static content.
- Clicking static chrome inside the application scope restores the active
  pane after the pointer event finishes.

When entering a pane, Focusgrid tries the remembered descendant, then the first
enabled tabbable descendant in DOM order, then the pane shell. Disabled,
hidden, inert, `aria-disabled`, and negative-tab-index fallback elements are
skipped. Focus is moved with `preventScroll: true`.

External interactive controls retain intentional focus. This includes links,
buttons, form controls, editable elements, dialogs, focusable elements, and
semantic widget regions. Clicking the Settings link in the example therefore
does not redirect focus into the grid, and a later pane-state update does not
steal focus from it.

Focusgrid does not install document-global keyboard routing in application
mode. Keyboard listeners remain on the Focusgrid root, so shortcuts work after
focus is restored into a pane but do not run from unrelated external inputs.
The policy is focus coordination, not a focus trap.

### Nested composite widgets

Nested widgets continue to own navigation within their own DOM subtree. For
example, Ariakit owns the active item and arrow-key movement inside a
`Composite`; Focusgrid only remembers the focused Composite item and restores
it when its pane becomes active again. Pane renderers do not need focus refs,
pane-specific effects, or Ariakit-specific integration for restoration.

Use manual mode when the grid is only one of several peer keyboard surfaces,
or when the application needs a different focus-ownership policy.

## Programmatic controls

The playground toolbar calls controller API methods directly for actions that
come from buttons and form controls.

```tsx
controller.api.wrapRootInSplit({
  side,
  minWidth: side === "left" || side === "right" ? 180 : undefined,
  minHeight: side === "up" || side === "down" ? 120 : undefined,
  canRemove: side !== "left",
  preserveActivePane: true,
});

controller.api.swap(activePaneId, swapTargetId);
```

Keyboard shortcuts use commands through the keymap. UI controls use
`controller.api`. Keeping those paths separate makes it clear which behavior is
scriptable and which behavior is human input.

Pane command capabilities can be set on pane nodes, on `paneDefaults`, or when
creating new panes:

```ts
const controller = createFocusGridController(initialState, {
  directionalFocusOverflow: true,
  paneDefaults: {
    canRemove: false,
  },
});

controller.api.split("editor", {
  side: "right",
  newPaneId: "preview",
  canFocus: false,
  canRemove: true,
});
```

The default keyboard commands honor those capabilities. Direct `controller.api` calls
remain programmatic operations and can still focus, resize, split, remove, or
swap panes that have disabled default command capabilities.
