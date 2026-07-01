# KCC Playground Todo Example

The `/kcc` playground demonstrates a keyboard-controlled todo collection inside
each FocusGrid pane. The collection root owns focus, arrow keys move the active
item, `Space` activates the active todo, and `Enter` opens inline editing.

## Data Model

Todo rows have stable ids. KCC exposes `ctx.id` as the reconciliation anchor and
`ctx.index` as derived ordering data for rendering.

```ts
export type TodoItem = {
  id: string;
  label: string;
  checked: boolean;
};
```

## Keymap Wiring

Native movement bindings belong to `KCCollection`:

```tsx
const nativeKeymap = useMemo(
  () => createDefaultKCCollectionKeymap({ overrides: shortcuts }),
  [shortcuts]
);
```

Application behavior belongs to receiver action bindings:

```tsx
const todoActions = useMemo<readonly KCActionBinding<TodoItem>[]>(
  () => [
    {
      sequence: shortcuts.activate,
      command: "activate",
      action: (ctx) => {
        setTodos((current) => toggleTodoById(current, ctx.id));
      },
    },
    {
      sequence: shortcuts.edit,
      command: "edit",
      action: (ctx) => {
        setEditingId(ctx.id);
      },
    },
  ],
  [shortcuts]
);
```

Native bindings are routed first. If a row action conflicts with movement, the
movement binding wins and KCC warns.

## Focus Model

DOM focus stays on the `KCCollection` root while navigating:

```tsx
paneRef.current?.querySelector<HTMLElement>(".KCCollectionRoot")?.focus();
```

When edit mode starts, the active row renders an input. A follow-up effect
focuses that input and selects the whole label.

```tsx
useEffect(() => {
  const input = paneRef.current?.querySelector<HTMLInputElement>(
    '[data-kc-edit-input="true"]'
  );

  if (!input) {
    return;
  }

  input.focus();
  input.select();
}, [editingId]);
```

`Enter` and `Escape` leave edit mode and restore focus to the collection root.

## Row Rendering

```tsx
<KCCollection
  controller={kcController}
  keymap={nativeKeymap}
  direction="vertical"
  className="KCCollectionRoot"
>
  <KCList
    dataList={todos}
    getItemId={(todo) => todo.id}
    customActionKeybinds={todoActions}
    renderCell={(ctx) => (
      <div className="KCTodoRow" data-checked={ctx.data.checked}>
        <input
          type="checkbox"
          tabIndex={-1}
          readOnly
          checked={ctx.data.checked}
        />
        {editingId === ctx.id ? (
          <input
            data-kc-edit-input="true"
            value={ctx.data.label}
            spellCheck={false}
            onChange={(event) => {
              setTodos((current) =>
                updateTodoLabelById(current, ctx.id, event.target.value)
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
</KCCollection>
```

## Heterogeneous Collections

Use `KCItem` for single controls, `KCList` for row groups, and normal React
children for static layout:

```tsx
<KCCollection controller={controller} keymap={keymap} direction="vertical">
  <Logo />
  <KCItem id="compose" customActionKeybinds={composeActions}>
    <ComposeButton />
  </KCItem>
  <KCList
    dataList={inboxes}
    getItemId={(inbox) => `inbox:${inbox.id}`}
    customActionKeybinds={inboxActions}
    renderCell={(ctx) => <InboxRow inbox={ctx.data} />}
  />
  <h2>Labels</h2>
  <KCList
    dataList={labels}
    getItemId={(label) => `label:${label.id}`}
    customActionKeybinds={labelActions}
    renderCell={(ctx) => <LabelRow label={ctx.data} />}
  />
</KCCollection>
```

The heading and logo render, but keyboard navigation skips them.
