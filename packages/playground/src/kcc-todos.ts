export type TodoItem = {
  id: string;
  label: string;
  checked: boolean;
};

export function createInitialTodos(paneId: string): TodoItem[] {
  return [
    {
      id: `${paneId}-triage`,
      label: `Triage ${paneId} inbox`,
      checked: false,
    },
    {
      id: `${paneId}-review`,
      label: `Review keyboard behavior`,
      checked: true,
    },
    {
      id: `${paneId}-ship`,
      label: `Ship deterministic focus`,
      checked: false,
    },
  ];
}

export function toggleTodo(items: readonly TodoItem[], index: number): TodoItem[] {
  return items.map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          checked: !item.checked,
        }
      : item,
  );
}

export function updateTodoLabel(
  items: readonly TodoItem[],
  index: number,
  label: string,
): TodoItem[] {
  return items.map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          label,
        }
      : item,
  );
}
