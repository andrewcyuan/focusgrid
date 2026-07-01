import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  KCController,
  createKCActionContext,
  createKCController,
  type KCActionBinding,
  type KCActionContext,
  type KCControllerState,
  type KCOrientation,
  type KCRegisteredEntry,
} from "@focusgrid/kcc-core";
import { KCDomController } from "@focusgrid/kcc-dom";

export type KCCollectionProps = {
  controller: KCController;
  keymap: readonly KCActionBinding<unknown>[];
  direction: KCOrientation;
  selectDefaultItemId?: (items: readonly KCRegisteredEntry[]) => string | null;
  className?: string;
  wrapAround?: boolean;
  children: ReactNode;
};

export type KCItemProps<T = undefined> = {
  id?: string;
  className?: string;
  disabled?: boolean;
  data?: T;
  customActionKeybinds?: readonly KCActionBinding<T>[];
  children: ReactNode | ((ctx: KCActionContext<T>) => ReactNode);
};

export type KCListProps<T> = {
  dataList: readonly T[];
  renderCell: (ctx: KCActionContext<T>) => ReactNode;
  className?: string;
  customActionKeybinds?: readonly KCActionBinding<T>[];
  getItemId?: (data: T, index: number) => string;
};

type KCCollectionContextValue = {
  controller: KCController;
  rootId: string;
  registerEntry: (entry: KCRegisteredEntry<unknown>) => () => void;
  getEntryProps: (entryId: string) => {
    id: string;
    role: "option";
    "aria-selected": "true" | "false";
    tabIndex: -1;
    onPointerDown: (
      event: Pick<PointerEvent, "preventDefault" | "target">
    ) => void;
    onClick: (event: Pick<MouseEvent, "target">) => void;
    onDoubleClick: (event: Pick<MouseEvent, "target">) => void;
  };
};

const KCCollectionContext = createContext<KCCollectionContextValue | null>(
  null
);

export function KCCollection({
  controller,
  keymap,
  direction,
  selectDefaultItemId,
  className,
  wrapAround = false,
  children,
}: KCCollectionProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const domControllerRef = useRef<KCDomController | null>(null);
  const registryRef = useRef(new Map<string, KCRegisteredEntry<unknown>>());
  const state = useKCControllerState(controller);
  const [entries, setEntries] = useState<readonly KCRegisteredEntry<unknown>[]>(
    []
  );
  const rootId = useMemo(() => createRootId(), []);

  useEffect(() => {
    controller.api.setOrientation(direction);
  }, [controller, direction]);

  useEffect(() => {
    controller.api.setWrapAround(wrapAround);
  }, [controller, wrapAround]);

  useEffect(() => {
    controller.api.setRegisteredEntries(entries, selectDefaultItemId);
  }, [controller, entries, selectDefaultItemId]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const domController = new KCDomController(controller, root, {
      keymap,
      entries,
      rootId,
    });

    domController.mount();
    domControllerRef.current = domController;

    return () => {
      domController.destroy();
      domControllerRef.current = null;
    };
  }, [controller, rootId]);

  useEffect(() => {
    domControllerRef.current?.update({ keymap, entries, rootId });
  }, [keymap, entries, rootId]);

  const publishEntries = useCallback(() => {
    setEntries(sortEntriesByDocumentOrder([...registryRef.current.values()]));
  }, []);

  const registerEntry = useCallback(
    (entry: KCRegisteredEntry) => {
      registryRef.current.set(entry.id, entry);
      publishEntries();

      return () => {
        const current = registryRef.current.get(entry.id);

        if (current !== entry) {
          return;
        }

        registryRef.current.delete(entry.id);
        publishEntries();
      };
    },
    [publishEntries]
  );

  const getEntryProps = useCallback(
    (entryId: string) => {
      const domProps = domControllerRef.current?.getEntryProps(entryId);

      if (domProps) {
        return domProps;
      }

      return {
        id: `${rootId}-item-${sanitizeDomIdPart(entryId)}`,
        role: "option" as const,
        "aria-selected":
          state.activeItemId === entryId
            ? ("true" as const)
            : ("false" as const),
        tabIndex: -1 as const,
        onPointerDown: (
          event: Pick<PointerEvent, "preventDefault" | "target">
        ) => event.preventDefault(),
        onClick: (_event: Pick<MouseEvent, "target">) => {
          controller.api.setActiveItemId(entryId);
        },
        onDoubleClick: (_event: Pick<MouseEvent, "target">) => undefined,
      };
    },
    [controller, rootId, state.activeItemId]
  );

  const contextValue = useMemo<KCCollectionContextValue>(
    () => ({
      controller,
      rootId,
      registerEntry,
      getEntryProps,
    }),
    [controller, rootId, registerEntry, getEntryProps]
  );

  const rootClassName = className
    ? `KCCollection ${className}`
    : "KCCollection";

  return (
    <KCCollectionContext.Provider value={contextValue}>
      <div ref={rootRef} id={rootId} className={rootClassName}>
        {children}
      </div>
    </KCCollectionContext.Provider>
  );
}

export function KCItem<T = undefined>({
  id,
  className,
  disabled,
  data,
  customActionKeybinds,
  children,
}: KCItemProps<T>) {
  const collection = useRequiredKCCollectionContext();
  const generatedId = useStableGeneratedId("item");
  const itemId = id ?? generatedId;
  const itemRef = useRef<HTMLDivElement | null>(null);
  const actionKeybindsRef = useRef(customActionKeybinds);
  const state = useKCControllerState(collection.controller);

  actionKeybindsRef.current = customActionKeybinds;

  useEffect(() => {
    const entry: KCRegisteredEntry<T> = {
      id: itemId,
      element: itemRef.current,
      disabled,
      data: data as T,
      getActionKeybinds: () => actionKeybindsRef.current ?? [],
    };

    return collection.registerEntry(entry as KCRegisteredEntry<unknown>);
  }, [collection, data, disabled, itemId]);

  const rowProps = collection.getEntryProps(itemId);
  const ctx = createKCActionContext(state, itemId, data as T);
  const content = typeof children === "function" ? children(ctx) : children;

  return (
    <div
      ref={itemRef}
      id={rowProps.id}
      role={rowProps.role}
      aria-selected={rowProps["aria-selected"]}
      tabIndex={rowProps.tabIndex}
      className={className}
      data-kc-item-id={itemId}
      data-active={state.activeItemId === itemId}
      data-disabled={disabled === true ? "true" : undefined}
      onPointerDown={(event) => rowProps.onPointerDown(event.nativeEvent)}
      onClick={(event) => rowProps.onClick(event.nativeEvent)}
      onDoubleClick={(event) => rowProps.onDoubleClick(event.nativeEvent)}
    >
      {content}
    </div>
  );
}

export function KCList<T>({
  dataList,
  renderCell,
  className,
  customActionKeybinds,
  getItemId,
}: KCListProps<T>) {
  const listId = useStableGeneratedId("list");

  return (
    <div className={className}>
      {dataList.map((data, index) => {
        const itemId = getItemId?.(data, index) ?? `${listId}-row-${index}`;

        return (
          <KCListRow
            key={itemId}
            id={itemId}
            data={data}
            customActionKeybinds={customActionKeybinds}
            renderCell={renderCell}
          />
        );
      })}
    </div>
  );
}

function KCListRow<T>({
  id,
  data,
  customActionKeybinds,
  renderCell,
}: {
  id: string;
  data: T;
  customActionKeybinds?: readonly KCActionBinding<T>[];
  renderCell: (ctx: KCActionContext<T>) => ReactNode;
}) {
  return (
    <KCItem id={id} data={data} customActionKeybinds={customActionKeybinds}>
      {(ctx) => renderCell(ctx)}
    </KCItem>
  );
}

export function useKCController(
  options?: Parameters<typeof createKCController>[0]
): KCController {
  const ref = useRef<KCController | null>(null);

  if (!ref.current) {
    ref.current = createKCController(options);
  }

  return ref.current;
}

export function useKCControllerState(
  controller: KCController
): KCControllerState {
  return useSyncExternalStore(
    (listener) => controller.subscribe(listener),
    () => controller.getState(),
    () => controller.getState()
  );
}

function useRequiredKCCollectionContext(): KCCollectionContextValue {
  const context = useContext(KCCollectionContext);

  if (!context) {
    throw new Error("KCItem and KCList must be rendered inside KCCollection.");
  }

  return context;
}

function useStableGeneratedId(prefix: string): string {
  const reactId = useId();

  return useMemo(
    () => `kc-${prefix}-${sanitizeDomIdPart(reactId)}`,
    [prefix, reactId]
  );
}

function sortEntriesByDocumentOrder(
  entries: readonly KCRegisteredEntry<unknown>[]
): readonly KCRegisteredEntry<unknown>[] {
  return [...entries].sort((left, right) => {
    if (!left.element || !right.element || left.element === right.element) {
      return 0;
    }

    const position = left.element.compareDocumentPosition(right.element);

    if (position & 2) {
      return 1;
    }

    if (position & 4) {
      return -1;
    }

    return 0;
  });
}

let nextRootId = 0;

function createRootId(): string {
  nextRootId += 1;
  return `kcc-${nextRootId}`;
}

function sanitizeDomIdPart(value: string): string {
  const sanitized = value.trim().replace(/[^A-Za-z0-9_-]+/g, "-");

  return sanitized || "entry";
}

export type {
  KCActionBinding,
  KCActionContext,
  KCCommands,
  KCController,
  KCControllerApi,
  KCControllerOptions,
  KCControllerState,
  KCItemAction,
  KCMoveDirection,
  KCOrientation,
  KCRegisteredEntry,
  KCCommandAction,
  KCCommandArgs,
  KCCommandName,
  KCShortcutId,
  KCShortcutOverrides,
  KCShortcutValues,
} from "@focusgrid/kcc-core";
export {
  createDefaultKCCollectionKeymap,
  createDefaultKCShortcuts,
  createKCController,
  defaultKCShortcutActions,
} from "@focusgrid/kcc-core";
