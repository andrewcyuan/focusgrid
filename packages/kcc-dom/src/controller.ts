import {
  KCController,
  createKCLCellContext,
  resolveKCLKeymap,
  type KCActionBinding,
  type KCControllerState,
  type KCRegisteredEntry,
  type KCLResolvedAction,
} from "@focusgrid/kcc-core";
import {
  KeyRouter,
  routeKeyboardEvent,
  strokeToId,
} from "@focusgrid/shortcut-engine";
import { getKCEntryDomId, getKCLRowId } from "./ids";

export type KCDomControllerOptions = {
  keymap?: readonly KCActionBinding<unknown>[];
  entries?: readonly KCRegisteredEntry[];
  rootId?: string;
  getEntryDomId?: (
    rootId: string,
    entry: KCRegisteredEntry,
    index: number,
  ) => string;
};

export type KCEntryDomProps = {
  id: string;
  role: "option";
  "aria-selected": "true" | "false";
  tabIndex: -1;
  onPointerDown: (
    event: Pick<PointerEvent, "preventDefault" | "target">,
  ) => void;
  onClick: (event: Pick<MouseEvent, "target">) => void;
  onDoubleClick: (event: Pick<MouseEvent, "target">) => void;
};

export type KCLDomControllerOptions<T> = {
  keymap?: readonly KCActionBinding<T>[];
  dataList?: readonly T[];
  entries?: readonly KCRegisteredEntry[];
  rootId?: string;
};

export type KCLRowDomProps = KCEntryDomProps;

export class KCDomController {
  private nativeRouter: KeyRouter<
    KCControllerState,
    string,
    KCLResolvedAction<unknown>
  >;
  private customRouter: KeyRouter<
    KCControllerState,
    string,
    KCLResolvedAction<unknown>
  > | null = null;
  private customRouterEntryId: string | null = null;
  private customRouterSignature = "";
  private mounted = false;
  private entries: readonly KCRegisteredEntry[];
  private keymap: readonly KCActionBinding<unknown>[];
  private readonly rootId: string;
  private readonly getEntryDomId: (
    rootId: string,
    entry: KCRegisteredEntry,
    index: number,
  ) => string;
  private unsubscribe?: () => void;
  private conflictSignature = "";

  private readonly onFocus = () => {
    this.controller.api.setFocused(true);
  };

  private readonly onBlur = () => {
    this.controller.api.setFocused(false);
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const state = this.controller.getState();
    const nativeResult = routeKeyboardEvent(event, this.nativeRouter, {
      context: state,
      ignoreEvent: (currentEvent) =>
        isTextEditingEventTarget(currentEvent.target, this.rootEl),
      onMatch: (result) => this.runAction(result.args),
    });

    const activeEntry = this.getActiveEntry();
    const customRouter = this.getCustomRouter(activeEntry);

    if (!customRouter || nativeResult === null || nativeResult.matched) {
      return;
    }

    if (nativeResult.pending || nativeResult.preventDefault) {
      return;
    }

    routeKeyboardEvent(event, customRouter, {
      context: this.controller.getState(),
      onMatch: (result) =>
        this.runAction(result.args, activeEntry ?? undefined),
    });
  };

  constructor(
    private readonly controller: KCController,
    private readonly rootEl: HTMLElement,
    options: KCDomControllerOptions = {},
  ) {
    this.keymap = options.keymap ?? [];
    this.entries = options.entries ?? [];
    this.rootId = options.rootId ?? rootEl.id ?? "kcc";
    this.getEntryDomId =
      options.getEntryDomId ??
      ((currentRootId, entry) => getKCEntryDomId(currentRootId, entry.id));
    this.nativeRouter = new KeyRouter(resolveKCLKeymap(this.keymap));
  }

  mount(): void {
    if (this.mounted) {
      return;
    }

    if (!this.rootEl.id) {
      this.rootEl.id = this.rootId;
    }

    this.rootEl.tabIndex = this.rootEl.tabIndex < 0 ? 0 : this.rootEl.tabIndex;
    this.rootEl.setAttribute("role", "listbox");
    this.rootEl.setAttribute(
      "aria-orientation",
      this.controller.getState().orientation,
    );
    this.syncAria();

    this.rootEl.addEventListener("focus", this.onFocus);
    this.rootEl.addEventListener("blur", this.onBlur);
    this.rootEl.addEventListener("keydown", this.onKeyDown, { capture: true });
    this.unsubscribe = this.controller.subscribe(() => this.syncAria());
    this.mounted = true;
  }

  destroy(): void {
    if (!this.mounted) {
      return;
    }

    this.rootEl.removeEventListener("focus", this.onFocus);
    this.rootEl.removeEventListener("blur", this.onBlur);
    this.rootEl.removeEventListener("keydown", this.onKeyDown, {
      capture: true,
    });
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.mounted = false;
  }

  update(options: KCDomControllerOptions): void {
    if (options.keymap) {
      this.keymap = options.keymap;
      this.nativeRouter = new KeyRouter(resolveKCLKeymap(this.keymap));
    }

    this.entries = options.entries ?? this.entries;
    this.validateConflicts();
    this.syncAria();
  }

  getEntryProps(entryId: string): KCEntryDomProps {
    return {
      id: this.resolveEntryDomId(entryId),
      role: "option",
      "aria-selected":
        this.controller.getState().activeItemId === entryId ? "true" : "false",
      tabIndex: -1,
      onPointerDown: (event) => {
        if (isTextEditingEventTarget(event.target, this.rootEl)) {
          return;
        }

        event.preventDefault();
      },
      onClick: (event) => {
        if (isTextEditingEventTarget(event.target, this.rootEl)) {
          return;
        }

        this.focusRoot();
        this.controller.api.setActiveItemId(entryId);
      },
      onDoubleClick: (event) => {
        if (isTextEditingEventTarget(event.target, this.rootEl)) {
          return;
        }

        this.focusRoot();
        this.controller.api.setActiveItemId(entryId);
        this.runCommandAction("edit");
      },
    };
  }

  getRowProps(index: number): KCLRowDomProps {
    const entryId =
      this.controller.getState().itemIds[index] ?? `item-${clampDomIndex(index)}`;
    const props = this.getEntryProps(entryId);

    return {
      ...props,
      id: getKCLRowId(this.rootEl.id || this.rootId, index),
    };
  }

  private syncAria(): void {
    const state = this.controller.getState();
    this.rootEl.setAttribute("aria-orientation", state.orientation);

    if (!state.activeItemId) {
      this.rootEl.removeAttribute("aria-activedescendant");
      return;
    }

    const activeEntry = this.getActiveEntry();
    const activeDomId =
      activeEntry?.element?.id ??
      this.resolveEntryDomId(state.activeItemId);

    this.rootEl.setAttribute("aria-activedescendant", activeDomId);
  }

  private runAction(
    action: KCLResolvedAction<unknown> | undefined,
    explicitEntry?: KCRegisteredEntry,
  ): void {
    if (!action) {
      return;
    }

    if (action.kind === "command") {
      if (action.command === "moveActive") {
        const args = action.args;

        if (!args || !("direction" in args)) {
          return;
        }

        this.controller.commands.moveActive(args.direction, args.count);
        return;
      }

      if (action.command === "activate") {
        this.runCommandAction("activate");
        return;
      }

      if (action.command === "edit") {
        this.runCommandAction("edit");
      }

      return;
    }

    const entry = explicitEntry ?? this.getActiveEntry();

    if (!entry) {
      return;
    }

    const index = this.controller.getState().itemIds.indexOf(entry.id);
    const ctx = createKCLCellContext(
      this.controller.getState(),
      index,
      entry.data,
    );

    if (ctx) {
      action.action(ctx);
    }
  }

  private runCommandAction(command: "activate" | "edit"): void {
    const activeEntry = this.getActiveEntry();
    const customActions = activeEntry?.getActionKeybinds?.() ?? [];

    for (const binding of resolveKCLKeymap(customActions)) {
      const action = binding.args;

      if (action?.kind === "cell" && action.command === command) {
        this.runAction(action, activeEntry ?? undefined);
        return;
      }
    }
  }

  private getActiveEntry(): KCRegisteredEntry | null {
    const activeItemId = this.controller.getState().activeItemId;

    if (!activeItemId) {
      return null;
    }

    return this.entries.find((entry) => entry.id === activeItemId) ?? null;
  }

  private resolveEntryDomId(entryId: string): string {
    const entry = this.entries.find((item) => item.id === entryId);
    const index = this.controller.getState().itemIds.indexOf(entryId);

    if (!entry) {
      return this.getEntryDomId(
        this.rootEl.id || this.rootId,
        {
          id: entryId,
          element: null,
          data: undefined,
        },
        index,
      );
    }

    return this.getEntryDomId(this.rootEl.id || this.rootId, entry, index);
  }

  private getCustomRouter(
    activeEntry: KCRegisteredEntry | null,
  ): KeyRouter<KCControllerState, string, KCLResolvedAction<unknown>> | null {
    const bindings = activeEntry?.getActionKeybinds?.() ?? [];
    const signature = serializeResolvedBindings(resolveKCLKeymap(bindings));

    if (
      this.customRouter &&
      this.customRouterEntryId === activeEntry?.id &&
      this.customRouterSignature === signature
    ) {
      return this.customRouter;
    }

    this.customRouterEntryId = activeEntry?.id ?? null;
    this.customRouterSignature = signature;
    this.customRouter = activeEntry
      ? new KeyRouter(resolveKCLKeymap(bindings))
      : null;

    return this.customRouter;
  }

  private validateConflicts(): void {
    const nativeSequences = new Map<string, string>();
    const customSequences = new Map<string, string>();
    const warnings: string[] = [];

    for (const binding of resolveKCLKeymap(this.keymap)) {
      nativeSequences.set(
        serializeSequence(binding.sequence),
        binding.action,
      );
    }

    for (const entry of this.entries) {
      for (const binding of resolveKCLKeymap(entry.getActionKeybinds?.() ?? [])) {
        const sequence = serializeSequence(binding.sequence);
        const nativeAction = nativeSequences.get(sequence);
        const existingCustom = customSequences.get(sequence);

        if (nativeAction) {
          warnings.push(
            `KCC custom action "${entry.id}" uses "${sequence}", which conflicts with native "${nativeAction}". Native collection bindings win.`,
          );
        }

        if (existingCustom) {
          warnings.push(
            `KCC custom action "${entry.id}" uses "${sequence}", which also belongs to "${existingCustom}". The active item still scopes routing, but duplicate collection bindings can be ambiguous.`,
          );
        }

        customSequences.set(sequence, entry.id);
      }
    }

    const signature = warnings.join("\n");

    if (!signature || signature === this.conflictSignature) {
      return;
    }

    this.conflictSignature = signature;
    console.warn(signature);
  }

  private focusRoot(): void {
    if (this.rootEl.ownerDocument.activeElement !== this.rootEl) {
      this.rootEl.focus();
    }
  }
}

export class KCLDomController<T> extends KCDomController {
  constructor(
    controller: KCController,
    rootEl: HTMLElement,
    options: KCLDomControllerOptions<T> = {},
  ) {
    const entries: readonly KCRegisteredEntry<unknown>[] =
      options.entries ??
      (options.dataList ?? []).map((data, index) => ({
        id: `item-${index}`,
        element: null,
        data,
        getActionKeybinds: () =>
          (options.keymap ?? []) as readonly KCActionBinding<unknown>[],
      }));

    super(controller, rootEl, {
      keymap: options.keymap as readonly KCActionBinding<unknown>[] | undefined,
      entries,
      rootId: options.rootId,
      getEntryDomId: (rootId, _entry, index) => getKCLRowId(rootId, index),
    });
  }
}

function serializeResolvedBindings(
  bindings: ReturnType<typeof resolveKCLKeymap>,
): string {
  return bindings
    .map((binding) => `${serializeSequence(binding.sequence)}:${binding.action}`)
    .join("|");
}

function serializeSequence(sequence: readonly Parameters<typeof strokeToId>[0][]): string {
  return sequence.map((stroke) => strokeToId(stroke)).join(" ");
}

function clampDomIndex(index: number): number {
  if (!Number.isFinite(index)) {
    return 0;
  }

  return Math.max(0, Math.trunc(index));
}

function isTextEditingEventTarget(
  target: EventTarget | null,
  rootEl: HTMLElement,
): boolean {
  if (!target || target === rootEl || !("tagName" in target)) {
    return false;
  }

  const element = target as Element & {
    isContentEditable?: boolean;
  };
  const tagName = element.tagName.toLowerCase();
  const role =
    typeof element.getAttribute === "function"
      ? element.getAttribute("role")
      : null;

  if (tagName === "input") {
    return isTextEditingInput(element);
  }

  return (
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable === true ||
    role === "textbox"
  );
}

function isTextEditingInput(element: Element): boolean {
  const type =
    typeof element.getAttribute === "function"
      ? (element.getAttribute("type") ?? "text").toLowerCase()
      : "text";

  return TEXT_EDITING_INPUT_TYPES.has(type);
}

const TEXT_EDITING_INPUT_TYPES = new Set([
  "",
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);
