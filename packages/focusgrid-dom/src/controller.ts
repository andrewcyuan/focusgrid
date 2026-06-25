import type { KeyBinding, Workspace } from "@focusgrid/core";
import { KeyboardListener } from "./keyboard-listener";
import { RootResizeObserver } from "./resize-observer";

export type WorkspaceDomControllerOptions = {
  keymap?: KeyBinding[];
};

export class WorkspaceDomController {
  private keyboard?: KeyboardListener;
  private resizeObserver?: RootResizeObserver;

  constructor(
    private readonly workspace: Workspace,
    private readonly rootEl: HTMLElement,
    private readonly options: WorkspaceDomControllerOptions = {},
  ) {}

  mount(): void {
    this.rootEl.tabIndex = this.rootEl.tabIndex < 0 ? 0 : this.rootEl.tabIndex;
    this.keyboard = new KeyboardListener(this.workspace, this.rootEl, {
      keymap: this.options.keymap,
    });
    this.resizeObserver = new RootResizeObserver(this.workspace, this.rootEl);

    this.keyboard.mount();
    this.resizeObserver.mount();
  }

  destroy(): void {
    this.keyboard?.destroy();
    this.resizeObserver?.destroy();
    this.keyboard = undefined;
    this.resizeObserver = undefined;
  }
}
