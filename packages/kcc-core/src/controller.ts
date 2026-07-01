import type { KCActionBinding } from "./keymap";

export type KCOrientation = "vertical" | "horizontal";

export type KCMoveDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "start"
  | "end";

export type KCRegisteredEntry<T = unknown> = {
  id: string;
  element: HTMLElement | null;
  disabled?: boolean;
  data: T;
  getActionKeybinds?: () => readonly KCActionBinding<T>[];
};

export type KCControllerState = {
  activeItemId: string | null;
  activeIndex: number;
  itemCount: number;
  itemIds: readonly string[];
  focused: boolean;
  orientation: KCOrientation;
  wrapAround: boolean;
};

export type KCActionContext<T = unknown> = {
  id: string;
  index: number;
  isCollectionFocused: boolean;
  isItemActive: boolean;
  data: T;
};

export type KCItemAction<T = unknown> = (ctx: KCActionContext<T>) => void;

export type KCControllerApi = {
  setActiveItemId(next: string | null): boolean;
  setActiveIndex(next: number | ((prev: number) => number)): boolean;
  setRegisteredEntries(
    entries: readonly KCRegisteredEntry[],
    selectDefaultItemId?: (
      entries: readonly KCRegisteredEntry[]
    ) => string | null
  ): boolean;
  setFocused(focused: boolean): boolean;
  setOrientation(orientation: KCOrientation): boolean;
  setWrapAround(wrapAround: boolean): boolean;
};

export type KCCommands = {
  moveActive(direction: KCMoveDirection, count?: number): boolean;
};

export type KCControllerOptions = {
  itemIds?: readonly string[];
  activeItemId?: string | null;
  focused?: boolean;
  orientation?: KCOrientation;
  wrapAround?: boolean;
  selectDefaultItemId?: (
    entries: readonly KCRegisteredEntry[]
  ) => string | null;
};

export type KCListener = () => void;

export class KCController {
  readonly api: KCControllerApi;
  readonly commands: KCCommands;
  private state: KCControllerState;
  private entries: readonly KCRegisteredEntry[];
  private listeners = new Set<KCListener>();

  constructor(options: KCControllerOptions = {}) {
    const entries = createInitialEntries(options);
    const selectDefaultItemId =
      options.selectDefaultItemId ?? createDefaultItemSelector;
    const activeItemId = defaultActiveItemId(
      entries,
      options.activeItemId ?? null,
      selectDefaultItemId
    );

    this.entries = entries;
    this.state = createState({
      entries,
      activeItemId,
      focused: options.focused ?? false,
      orientation: options.orientation ?? "vertical",
      wrapAround: options.wrapAround ?? false,
    });

    this.api = {
      setActiveItemId: (next) => {
        return this.commit(
          createState({
            entries: this.entries,
            activeItemId: normalizeActiveItemId(this.entries, next),
            focused: this.state.focused,
            orientation: this.state.orientation,
            wrapAround: this.state.wrapAround,
          })
        );
      },
      setActiveIndex: (next) => {
        const nextValue =
          typeof next === "function" ? next(this.state.activeIndex) : next;
        const activeItemId = activeItemIdFromIndex(this.entries, nextValue);

        return this.api.setActiveItemId(activeItemId);
      },
      setRegisteredEntries: (nextEntries, selectDefaultItemIdForEntries) => {
        const entries = normalizeEntries(nextEntries);
        const activeItemId = reconcileActiveItemId(
          this.state.activeItemId,
          this.entries,
          entries,
          selectDefaultItemIdForEntries
        );

        this.entries = entries;

        return this.commit(
          createState({
            entries,
            activeItemId,
            focused: this.state.focused,
            orientation: this.state.orientation,
            wrapAround: this.state.wrapAround,
          })
        );
      },
      setFocused: (focused) =>
        this.commit({
          ...this.state,
          focused,
        }),
      setOrientation: (orientation) =>
        this.commit({
          ...this.state,
          orientation,
        }),
      setWrapAround: (wrapAround) =>
        this.commit({
          ...this.state,
          wrapAround,
        }),
    };

    this.commands = {
      moveActive: (direction, count = 1) => {
        const next = moveActiveItemId(
          this.entries,
          this.state,
          direction,
          count
        );

        if (next === this.state.activeItemId) {
          return false;
        }

        return this.api.setActiveItemId(next);
      },
    };
  }

  getState(): KCControllerState {
    return this.state;
  }

  getRegisteredEntries(): readonly KCRegisteredEntry[] {
    return this.entries;
  }

  getActiveEntry<T = unknown>(): KCRegisteredEntry<T> | null {
    const activeItemId = this.state.activeItemId;

    if (!activeItemId) {
      return null;
    }

    return (
      (this.entries.find((entry) => entry.id === activeItemId) as
        | KCRegisteredEntry<T>
        | undefined) ?? null
    );
  }

  getActionContext<T>(id: string, data: T): KCActionContext<T> {
    return createKCActionContext(this.state, id, data);
  }

  subscribe(listener: KCListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(next: KCControllerState): boolean {
    if (
      next.activeItemId === this.state.activeItemId &&
      next.activeIndex === this.state.activeIndex &&
      next.itemCount === this.state.itemCount &&
      next.focused === this.state.focused &&
      next.orientation === this.state.orientation &&
      next.wrapAround === this.state.wrapAround &&
      arrayShallowEqual(next.itemIds, this.state.itemIds)
    ) {
      return false;
    }

    this.state = next;

    for (const listener of this.listeners) {
      listener();
    }

    return true;
  }
}

export function createKCController(
  options?: KCControllerOptions
): KCController {
  return new KCController(options);
}

export function clampActiveIndex(index: number, itemCount: number): number {
  const normalizedItemCount = Number.isFinite(itemCount)
    ? Math.max(0, Math.trunc(itemCount))
    : 0;

  if (normalizedItemCount === 0) {
    return -1;
  }

  if (!Number.isFinite(index)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.trunc(index), normalizedItemCount - 1));
}

export function moveActiveIndex(
  state: Pick<KCControllerState, "activeIndex" | "itemCount" | "orientation">,
  direction: KCMoveDirection,
  count = 1
): number {
  if (state.itemCount === 0 || state.activeIndex < 0) {
    return -1;
  }

  if (direction === "start") {
    return 0;
  }

  if (direction === "end") {
    return state.itemCount - 1;
  }

  if (!doesDirectionApply(state.orientation, direction)) {
    return state.activeIndex;
  }

  const delta = getDirectionDelta(direction) * normalizeMoveCount(count);

  return clampActiveIndex(state.activeIndex + delta, state.itemCount);
}

export function doesDirectionApply(
  orientation: KCOrientation,
  direction: KCMoveDirection
): boolean {
  if (orientation === "vertical") {
    return direction === "up" || direction === "down";
  }

  return direction === "left" || direction === "right";
}

export function createKCActionContext<T>(
  state: KCControllerState,
  id: string,
  data: T
): KCActionContext<T> {
  const index = state.itemIds.indexOf(id);

  return {
    id,
    index,
    data,
    isCollectionFocused: state.focused,
    isItemActive: state.activeItemId === id,
  };
}

function createState({
  entries,
  activeItemId,
  focused,
  orientation,
  wrapAround,
}: {
  entries: readonly KCRegisteredEntry[];
  activeItemId: string | null;
  focused: boolean;
  orientation: KCOrientation;
  wrapAround: boolean;
}): KCControllerState {
  const itemIds = entries.map((entry) => entry.id);

  return {
    activeItemId,
    activeIndex: activeItemId ? itemIds.indexOf(activeItemId) : -1,
    itemCount: entries.length,
    itemIds,
    focused,
    orientation,
    wrapAround,
  };
}

function createInitialEntries(
  options: KCControllerOptions
): readonly KCRegisteredEntry[] {
  return (options.itemIds ?? []).map((id) => ({
    id,
    element: null,
    data: undefined,
  }));
}

function normalizeEntries(
  entries: readonly KCRegisteredEntry[]
): readonly KCRegisteredEntry[] {
  const seen = new Set<string>();

  return entries.flatMap((entry) => {
    const id = String(entry.id).trim();

    if (!id || seen.has(id)) {
      return [];
    }

    seen.add(id);

    return [
      {
        ...entry,
        id,
      },
    ];
  });
}

function defaultActiveItemId(
  entries: readonly KCRegisteredEntry[],
  requested: string | null,
  selectDefaultItemId: (entries: readonly KCRegisteredEntry[]) => string | null
): string | null {
  return (
    normalizeActiveItemId(entries, requested) ??
    normalizeActiveItemId(entries, selectDefaultItemId(entries)) ??
    firstEnabledEntry(entries)?.id ??
    null
  );
}

function reconcileActiveItemId(
  previousActiveItemId: string | null,
  previousEntries: readonly KCRegisteredEntry[],
  nextEntries: readonly KCRegisteredEntry[],
  selectDefaultItemId?: (entries: readonly KCRegisteredEntry[]) => string | null
): string | null {
  if (nextEntries.length === 0) {
    return null;
  }

  const current = normalizeActiveItemId(nextEntries, previousActiveItemId);

  if (current) {
    return current;
  }

  if (previousEntries.length === 0 && selectDefaultItemId) {
    const selected = normalizeActiveItemId(
      nextEntries,
      selectDefaultItemId(nextEntries)
    );

    if (selected) {
      return selected;
    }
  }

  const previousIndex = previousActiveItemId
    ? previousEntries.findIndex((entry) => entry.id === previousActiveItemId)
    : -1;

  if (previousIndex >= 0) {
    return (
      nextEntries[clampActiveIndex(previousIndex, nextEntries.length)]?.id ??
      null
    );
  }

  return firstEnabledEntry(nextEntries)?.id ?? null;
}

function normalizeActiveItemId(
  entries: readonly KCRegisteredEntry[],
  id: string | null
): string | null {
  if (!id) {
    return null;
  }

  const entry = entries.find((item) => item.id === id);

  return entry && !entry.disabled ? entry.id : null;
}

function moveActiveItemId(
  entries: readonly KCRegisteredEntry[],
  state: KCControllerState,
  direction: KCMoveDirection,
  count = 1
): string | null {
  if (entries.length === 0 || state.activeIndex < 0) {
    return null;
  }

  if (direction === "start") {
    return firstEnabledEntry(entries)?.id ?? state.activeItemId;
  }

  if (direction === "end") {
    return lastEnabledEntry(entries)?.id ?? state.activeItemId;
  }

  if (!doesDirectionApply(state.orientation, direction)) {
    return state.activeItemId;
  }

  const delta = getDirectionDelta(direction);
  let index = state.activeIndex;
  let remaining = normalizeMoveCount(count);

  while (remaining > 0) {
    const nextIndex = nextMovableIndex(entries, index, delta, state.wrapAround);

    if (nextIndex === index) {
      break;
    }

    index = nextIndex;
    remaining -= 1;
  }

  return entries[index]?.id ?? null;
}

function nextMovableIndex(
  entries: readonly KCRegisteredEntry[],
  currentIndex: number,
  delta: number,
  wrapAround: boolean
): number {
  let nextIndex = currentIndex;

  for (let visited = 0; visited < entries.length; visited += 1) {
    const candidate = nextIndex + delta;

    if (candidate < 0 || candidate >= entries.length) {
      if (!wrapAround) {
        return currentIndex;
      }

      nextIndex = candidate < 0 ? entries.length - 1 : 0;
    } else {
      nextIndex = candidate;
    }

    if (!entries[nextIndex]?.disabled) {
      return nextIndex;
    }
  }

  return currentIndex;
}

function firstEnabledEntry(
  entries: readonly KCRegisteredEntry[]
): KCRegisteredEntry | undefined {
  return entries.find((entry) => !entry.disabled);
}

function lastEnabledEntry(
  entries: readonly KCRegisteredEntry[]
): KCRegisteredEntry | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];

    if (entry && !entry.disabled) {
      return entry;
    }
  }

  return undefined;
}

function activeItemIdFromIndex(
  entries: readonly KCRegisteredEntry[],
  index: number
): string | null {
  return entries[clampActiveIndex(index, entries.length)]?.id ?? null;
}

function createDefaultItemSelector(
  entries: readonly KCRegisteredEntry[]
): string | null {
  if (entries.length === 0) {
    return null;
  }

  return entries[0]?.id ?? null;
}

function getDirectionDelta(direction: KCMoveDirection): number {
  return direction === "up" || direction === "left" ? -1 : 1;
}

function normalizeMoveCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 1;
  }

  return Math.max(1, Math.trunc(count));
}

function arrayShallowEqual<T>(
  left: readonly T[],
  right: readonly T[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
