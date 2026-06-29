import {
  KCLController,
  createKCLCellContext,
  resolveKCLKeymap,
  type KCLActionBinding,
  type KCLControllerState,
  type KCLResolvedAction,
} from "@focusgrid/kcc-core";
import {
  KeyRouter,
  isModifierOnlyKey,
  normalizeKeyboardEvent,
} from "@focusgrid/shortcut-engine";
import { getKCLRowId } from "./ids";

export type KCLDomControllerOptions<T> = {
  keymap?: readonly KCLActionBinding<T>[];
  dataList?: readonly T[];
  rootId?: string;
};

export type KCLRowDomProps = {
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

export class KCLDomController<T> {
  private router: KeyRouter<KCLControllerState, string, KCLResolvedAction<T>>;
  private mounted = false;
  private dataList: readonly T[];
  private keymap: readonly KCLActionBinding<T>[];
  private readonly rootId: string;
  private unsubscribe?: () => void;

  private readonly onFocus = () => {
    this.controller.api.setFocused(true);
  };

  private readonly onBlur = () => {
    this.controller.api.setFocused(false);
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (isTextEditingEventTarget(event.target, this.rootEl)) {
      return;
    }

    if (isModifierOnlyKey(event.key)) {
      return;
    }

    const result = this.router.handle(
      normalizeKeyboardEvent(event),
      this.controller.getState(),
    );

    if (!result.matched) {
      if (result.pending || result.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }

      return;
    }

    if (result.preventDefault) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.runAction(result.args);
  };

  constructor(
    private readonly controller: KCLController,
    private readonly rootEl: HTMLElement,
    options: KCLDomControllerOptions<T> = {},
  ) {
    this.keymap = options.keymap ?? [];
    this.dataList = options.dataList ?? [];
    this.rootId = options.rootId ?? rootEl.id ?? "kcl";
    this.router = new KeyRouter(resolveKCLKeymap(this.keymap));
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

  update(options: KCLDomControllerOptions<T>): void {
    if (options.keymap) {
      this.keymap = options.keymap;
      this.router = new KeyRouter(resolveKCLKeymap(this.keymap));
    }

    this.dataList = options.dataList ?? this.dataList;
    this.syncAria();
  }

  getRowProps(index: number): KCLRowDomProps {
    return {
      id: getKCLRowId(this.rootEl.id || this.rootId, index),
      role: "option",
      "aria-selected":
        this.controller.getState().activeIndex === index ? "true" : "false",
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
        this.controller.api.setActiveIndex(index);
      },
      onDoubleClick: (event) => {
        if (isTextEditingEventTarget(event.target, this.rootEl)) {
          return;
        }

        this.focusRoot();
        this.controller.api.setActiveIndex(index);
        this.runCommandAction("edit");
      },
    };
  }

  private syncAria(): void {
    const state = this.controller.getState();
    this.rootEl.setAttribute("aria-orientation", state.orientation);

    if (state.activeIndex < 0 || state.activeIndex >= state.itemCount) {
      this.rootEl.removeAttribute("aria-activedescendant");
      return;
    }

    this.rootEl.setAttribute(
      "aria-activedescendant",
      getKCLRowId(this.rootEl.id || this.rootId, state.activeIndex),
    );
  }

  private runAction(action: KCLResolvedAction<T> | undefined): void {
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

    const ctx = createKCLCellContext(this.controller.getState(), this.dataList);

    if (ctx) {
      action.action(ctx);
    }
  }

  private runCommandAction(command: "activate" | "edit"): void {
    for (const binding of resolveKCLKeymap(this.keymap)) {
      const action = binding.args;

      if (action?.kind === "cell" && action.command === command) {
        this.runAction(action);
        return;
      }
    }
  }

  private focusRoot(): void {
    if (this.rootEl.ownerDocument.activeElement !== this.rootEl) {
      this.rootEl.focus();
    }
  }
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
