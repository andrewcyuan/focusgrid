import { type ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import type { FocusGridController } from "../controller";
import { PaneCommandCapability } from "../layout/types";
import { findPaneForFocusCommand, findPaneInDirection } from "../layout/navigation";
import { findPaneNode } from "../layout/tree";

export const defaultPaneShortcutActions = [
  {
    id: "split-right",
    label: "Split right",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      const pane = findPaneNode(state.root, active);
      if (!pane || pane[PaneCommandCapability.SplitHorizontal] === false) return null;
      return controller.split(pane.id, { side: "right" });
    },
    defaultSequence: "Ctrl-B %",
  },
  {
    id: "split-down",
    label: "Split down",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      const pane = findPaneNode(state.root, active);
      if (!pane || pane[PaneCommandCapability.SplitVertical] === false) return null;
      return controller.split(pane.id, { side: "down" });
    },
    defaultSequence: "Ctrl-B \"",
  },
  {
    id: "close",
    label: "Close active",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active || findPaneNode(state.root, active)?.[PaneCommandCapability.Remove] === false) return false;
      return controller.remove(active);
    },
    defaultSequence: "Ctrl-B X",
  },
  {
    id: "focus-left",
    label: "Focus left",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active) return false;
      const target = findPaneForFocusCommand(state, active, "left", controller.directionalFocusOverflow);
      return target ? controller.focus(target) : false;
    },
    defaultSequence: "Ctrl-B Left",
  },
  {
    id: "focus-right",
    label: "Focus right",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active) return false;
      const target = findPaneForFocusCommand(state, active, "right", controller.directionalFocusOverflow);
      return target ? controller.focus(target) : false;
    },
    defaultSequence: "Ctrl-B Right",
  },
  {
    id: "focus-up",
    label: "Focus up",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active) return false;
      const target = findPaneForFocusCommand(state, active, "up", controller.directionalFocusOverflow);
      return target ? controller.focus(target) : false;
    },
    defaultSequence: "Ctrl-B Up",
  },
  {
    id: "focus-down",
    label: "Focus down",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active) return false;
      const target = findPaneForFocusCommand(state, active, "down", controller.directionalFocusOverflow);
      return target ? controller.focus(target) : false;
    },
    defaultSequence: "Ctrl-B Down",
  },
  {
    id: "swap-left",
    label: "Swap left",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active) return false;
      const target = findPaneInDirection(state, active, "left");
      if (!target || findPaneNode(state.root, active)?.[PaneCommandCapability.SwapX] === false || findPaneNode(state.root, target)?.[PaneCommandCapability.SwapX] === false) return false;
      return controller.swap(active, target);
    },
    defaultSequence: "Ctrl-B Shift-Left",
  },
  {
    id: "swap-right",
    label: "Swap right",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active) return false;
      const target = findPaneInDirection(state, active, "right");
      if (!target || findPaneNode(state.root, active)?.[PaneCommandCapability.SwapX] === false || findPaneNode(state.root, target)?.[PaneCommandCapability.SwapX] === false) return false;
      return controller.swap(active, target);
    },
    defaultSequence: "Ctrl-B Shift-Right",
  },
  {
    id: "swap-up",
    label: "Swap up",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active) return false;
      const target = findPaneInDirection(state, active, "up");
      if (!target || findPaneNode(state.root, active)?.[PaneCommandCapability.SwapY] === false || findPaneNode(state.root, target)?.[PaneCommandCapability.SwapY] === false) return false;
      return controller.swap(active, target);
    },
    defaultSequence: "Ctrl-B Shift-Up",
  },
  {
    id: "swap-down",
    label: "Swap down",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active) return false;
      const target = findPaneInDirection(state, active, "down");
      if (!target || findPaneNode(state.root, active)?.[PaneCommandCapability.SwapY] === false || findPaneNode(state.root, target)?.[PaneCommandCapability.SwapY] === false) return false;
      return controller.swap(active, target);
    },
    defaultSequence: "Ctrl-B Shift-Down",
  },
  {
    id: "resize-left",
    label: "Resize left",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active || findPaneNode(state.root, active)?.[PaneCommandCapability.ResizeX] === false) return false;
      return controller.resize(active, { direction: "left", deltaPx: 48 });
    },
    defaultSequence: "Ctrl-B H",
    repeat: true,
  },
  {
    id: "resize-right",
    label: "Resize right",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active || findPaneNode(state.root, active)?.[PaneCommandCapability.ResizeX] === false) return false;
      return controller.resize(active, { direction: "right", deltaPx: 48 });
    },
    defaultSequence: "Ctrl-B L",
    repeat: true,
  },
  {
    id: "resize-up",
    label: "Resize up",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active || findPaneNode(state.root, active)?.[PaneCommandCapability.ResizeY] === false) return false;
      return controller.resize(active, { direction: "up", deltaPx: 48 });
    },
    defaultSequence: "Ctrl-B K",
    repeat: true,
  },
  {
    id: "resize-down",
    label: "Resize down",
    action: (controller: FocusGridController) => {
      const state = controller.state;
      const active = state.activePaneId;
      if (!active || findPaneNode(state.root, active)?.[PaneCommandCapability.ResizeY] === false) return false;
      return controller.resize(active, { direction: "down", deltaPx: 48 });
    },
    defaultSequence: "Ctrl-B J",
    repeat: true,
  },
] as const;

export type PaneShortcutId = (typeof defaultPaneShortcutActions)[number]["id"];
export type PaneShortcutValues = Record<PaneShortcutId, string>;

export function createDefaultPaneShortcuts(): PaneShortcutValues {
  return Object.fromEntries(defaultPaneShortcutActions.map(action => [action.id, action.defaultSequence])) as PaneShortcutValues;
}

export function createDefaultPaneKeymap(controller: FocusGridController): ShortcutBinding[] {
  return defaultPaneShortcutActions.map(definition => ({
    sequence: definition.defaultSequence,
    action: () => { definition.action(controller); },
    repeat: "repeat" in definition ? definition.repeat : undefined,
  }));
}
