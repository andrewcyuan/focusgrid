export type KCLOrientation = "vertical" | "horizontal";

export type KCLMoveDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "start"
  | "end";

export type KCLControllerState = {
  activeIndex: number;
  itemCount: number;
  focused: boolean;
  orientation: KCLOrientation;
};

export type KCLCellContext<T> = {
  index: number;
  isListFocused: boolean;
  isCellActive: boolean;
  data: T;
};

export type KCLCellAction<T> = (ctx: KCLCellContext<T>) => void;

export type KCLControllerApi = {
  setActiveIndex(next: number | ((prev: number) => number)): boolean;
  setItemCount(
    itemCount: number,
    selectDefaultIndex?: (itemCount: number) => number,
  ): boolean;
  setFocused(focused: boolean): boolean;
  setOrientation(orientation: KCLOrientation): boolean;
};

export type KCLCommands = {
  moveActive(direction: KCLMoveDirection, count?: number): boolean;
};

export type KCLControllerOptions = {
  itemCount?: number;
  activeIndex?: number;
  focused?: boolean;
  orientation?: KCLOrientation;
  selectDefaultIndex?: (itemCount: number) => number;
};

export type KCLListener = () => void;

export class KCLController {
  readonly api: KCLControllerApi;
  readonly commands: KCLCommands;
  private state: KCLControllerState;
  private listeners = new Set<KCLListener>();

  constructor(options: KCLControllerOptions = {}) {
    const itemCount = normalizeItemCount(options.itemCount ?? 0);
    const selectDefaultIndex = options.selectDefaultIndex ?? (() => 0);
    const activeIndex =
      options.activeIndex ?? defaultActiveIndex(itemCount, selectDefaultIndex);

    this.state = {
      activeIndex: clampActiveIndex(activeIndex, itemCount),
      itemCount,
      focused: options.focused ?? false,
      orientation: options.orientation ?? "vertical",
    };

    this.api = {
      setActiveIndex: (next) => {
        const nextValue =
          typeof next === "function" ? next(this.state.activeIndex) : next;

        return this.commit({
          ...this.state,
          activeIndex: clampActiveIndex(nextValue, this.state.itemCount),
        });
      },
      setItemCount: (nextItemCount, selectDefaultIndexForCount) => {
        const itemCount = normalizeItemCount(nextItemCount);
        const nextActiveIndex = reconcileActiveIndex(
          this.state.activeIndex,
          this.state.itemCount,
          itemCount,
          selectDefaultIndexForCount,
        );

        return this.commit({
          ...this.state,
          itemCount,
          activeIndex: nextActiveIndex,
        });
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
    };

    this.commands = {
      moveActive: (direction, count = 1) => {
        const next = moveActiveIndex(this.state, direction, count);

        if (next === this.state.activeIndex) {
          return false;
        }

        return this.api.setActiveIndex(next);
      },
    };
  }

  getState(): KCLControllerState {
    return this.state;
  }

  getCellContext<T>(index: number, data: T): KCLCellContext<T> {
    return {
      index,
      data,
      isListFocused: this.state.focused,
      isCellActive: this.state.activeIndex === index,
    };
  }

  subscribe(listener: KCLListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(next: KCLControllerState): boolean {
    if (
      next.activeIndex === this.state.activeIndex &&
      next.itemCount === this.state.itemCount &&
      next.focused === this.state.focused &&
      next.orientation === this.state.orientation
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

export function createKCLController(
  options?: KCLControllerOptions,
): KCLController {
  return new KCLController(options);
}

export function clampActiveIndex(index: number, itemCount: number): number {
  const normalizedItemCount = normalizeItemCount(itemCount);

  if (normalizedItemCount === 0) {
    return -1;
  }

  if (!Number.isFinite(index)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.trunc(index), normalizedItemCount - 1));
}

export function moveActiveIndex(
  state: KCLControllerState,
  direction: KCLMoveDirection,
  count = 1,
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
  orientation: KCLOrientation,
  direction: KCLMoveDirection,
): boolean {
  if (orientation === "vertical") {
    return direction === "up" || direction === "down";
  }

  return direction === "left" || direction === "right";
}

function defaultActiveIndex(
  itemCount: number,
  selectDefaultIndex: (itemCount: number) => number,
): number {
  if (itemCount === 0) {
    return -1;
  }

  return selectDefaultIndex(itemCount);
}

function reconcileActiveIndex(
  previousActiveIndex: number,
  previousItemCount: number,
  nextItemCount: number,
  selectDefaultIndex?: (itemCount: number) => number,
): number {
  if (nextItemCount === 0) {
    return -1;
  }

  if (previousItemCount === 0) {
    return clampActiveIndex((selectDefaultIndex ?? (() => 0))(nextItemCount), nextItemCount);
  }

  return clampActiveIndex(previousActiveIndex, nextItemCount);
}

function normalizeItemCount(itemCount: number): number {
  if (!Number.isFinite(itemCount)) {
    return 0;
  }

  return Math.max(0, Math.trunc(itemCount));
}

function normalizeMoveCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 1;
  }

  return Math.max(1, Math.trunc(count));
}

function getDirectionDelta(direction: KCLMoveDirection): number {
  return direction === "up" || direction === "left" ? -1 : 1;
}
