# Usage

The playground is the smallest useful FocusGrid example: it creates one
controller, builds a keymap from editable shortcut values, and renders pane
content from the pane render context.

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
    () => createDefaultPaneKeymap({ overrides: shortcuts }),
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

This is the core focus contract: DOM focus can live inside pane content, while
FocusGrid tracks the active pane in controller state.

## Programmatic controls

The playground toolbar calls controller API methods directly for actions that
come from buttons and form controls.

```tsx
controller.api.wrapRootInSplit({
  side,
  minWidth: side === "left" || side === "right" ? 180 : undefined,
  minHeight: side === "up" || side === "down" ? 120 : undefined,
  noRemove: side === "left",
  preserveActivePane: true,
});

controller.api.swap(activePaneId, swapTargetId);
```

Keyboard shortcuts use commands through the keymap. UI controls use
`controller.api`. Keeping those paths separate makes it clear which behavior is
scriptable and which behavior is human input.

Pane command guards can be set on pane nodes, on `paneDefaults`, or when
creating new panes:

```ts
const controller = createFocusGridController(initialState, {
  directionalFocusOverflow: true,
  paneDefaults: {
    noRemove: true,
  },
});

controller.api.split("editor", {
  side: "right",
  newPaneId: "preview",
  noFocus: true,
  noRemove: false,
});
```

The default keyboard commands honor those guards. Direct `controller.api` calls
remain programmatic operations and can still focus, resize, split, remove, or
swap guarded panes.
