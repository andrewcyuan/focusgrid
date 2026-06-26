# KCL Playground Todo Example

The `/kcl` playground demonstrates a keyboard-controlled todo list inside each
FocusGrid pane. It treats the list like a file tree: the list root owns focus in
row mode, arrow keys move the active row, `Space` activates the row, and `Enter`
opens inline editing.

## Data Model

The playground keeps todo data as plain immutable state. Row actions receive the
active row index from KCL and update only that item.

```ts
export type TodoItem = {
  id: string;
  label: string;
  checked: boolean;
};

export function toggleTodo(items: readonly TodoItem[], index: number): TodoItem[] {
  return items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, checked: !item.checked } : item,
  );
}

export function updateTodoLabel(
  items: readonly TodoItem[],
  index: number,
  label: string,
): TodoItem[] {
  return items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, label } : item,
  );
}
```

## Keymap Wiring

KCL's default row shortcuts are declared in `@focusgrid/kcl`:

```ts
{
  id: "activate",
  label: "Activate row",
  defaultSequence: "Space",
  action: "activate",
},
{
  id: "edit",
  label: "Edit row",
  defaultSequence: "Enter",
  action: "edit",
}
```

The playground binds those logical actions to todo behavior with
`createDefaultKCLKeymap`.

```tsx
const keymap = useMemo(
  () =>
    createDefaultKCLKeymap<TodoItem>({
      overrides: shortcuts,
      onActivate: (ctx) => {
        setTodos((current) => toggleTodo(current, ctx.index));
      },
      onEdit: (ctx) => {
        setEditingIndex(ctx.index);
      },
    }),
  [shortcuts],
);
```

The shortcut sidebar edits the same `shortcuts` object, so changing the KCL row
bindings immediately rebuilds this keymap.

## Focus Model

In row mode, DOM focus stays on the KCL list root:

```tsx
useEffect(() => {
  if (!active) {
    return;
  }

  controller.api.focus(paneId);
  paneRef.current
    ?.querySelector<HTMLElement>(".KCLKeyboardControlledList")
    ?.focus();
}, [active, controller, paneId]);
```

When edit mode starts, the active row renders an input. A follow-up effect focuses
that input and selects the whole label, so typing replaces the row text.

```tsx
useEffect(() => {
  const input = paneRef.current?.querySelector<HTMLInputElement>(
    '[data-kcl-edit-input="true"]',
  );

  if (!input) {
    return;
  }

  input.focus();
  input.select();
}, [editingIndex]);
```

`Enter` and `Escape` both leave edit mode. The current text is already saved by
`onChange`, so leaving edit mode just restores focus to the list root.

```tsx
const stopEditing = () => {
  setEditingIndex(null);
  requestAnimationFrame(focusListRoot);
};

const onEditInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
  if (event.key !== "Enter" && event.key !== "Escape") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  stopEditing();
};
```

## Row Rendering

Each row renders a read-only checkbox and either a label or an edit input.

```tsx
<KeyboardControlledList
  controller={kclController}
  keymap={keymap}
  direction="vertical"
  dataList={todos}
  renderCell={(ctx) => (
    <div className="KCLTodoRow" data-checked={ctx.data.checked}>
      <input
        type="checkbox"
        tabIndex={-1}
        readOnly
        checked={ctx.data.checked}
      />
      {editingIndex === ctx.index ? (
        <input
          data-kcl-edit-input="true"
          value={ctx.data.label}
          spellCheck={false}
          onChange={(event) => {
            setTodos((current) =>
              updateTodoLabel(current, ctx.index, event.target.value),
            );
          }}
          onKeyDown={onEditInputKeyDown}
        />
      ) : (
        <span>{ctx.data.label}</span>
      )}
    </div>
  )}
/>
```

## Editable Targets

`kcl-dom` listens in the capture phase so list shortcuts win while the list root
is focused. It deliberately ignores keydown events from editable descendants.
That lets `Space` insert a space in the inline input instead of toggling the
checkbox, while `Space` on the list root still activates the active row.

Double-click follows the same model: pointer selection focuses the list root and
updates the active row; double-click enters edit mode for that row.
