import type {
  Direction,
  NodeId,
  PaneFocusDirection,
  PaneId,
  PaneResizeDirection,
  PaneSwapDirection,
  WorkspaceState,
} from "./types";
import {
  closePane,
  focusPaneInDirection,
  focusPane,
  resizeHandle,
  resizePane,
  splitPane,
  swapPaneInDirection,
  swapPanes,
} from "./operations";

export type WorkspaceAction =
  | { type: "container.setSize"; width: number; height: number }
  | { type: "pane.focus"; paneId: PaneId }
  | {
      type: "pane.focusDirection";
      paneId: PaneId;
      direction: PaneFocusDirection;
    }
  | {
      type: "pane.resize";
      paneId: PaneId;
      direction: PaneResizeDirection;
      deltaPx: number;
    }
  | {
      type: "pane.split";
      paneId: PaneId;
      direction: Direction;
      newPaneId: PaneId;
    }
  | { type: "pane.swap"; firstPaneId: PaneId; secondPaneId: PaneId }
  | {
      type: "pane.swapDirection";
      paneId: PaneId;
      direction: PaneSwapDirection;
    }
  | { type: "pane.close"; paneId: PaneId }
  | {
      type: "handle.resize";
      splitId: NodeId;
      index: number;
      deltaPx: number;
      snapshotSizes?: number[];
    };

export function reducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case "container.setSize":
      if (
        state.container.width === action.width &&
        state.container.height === action.height
      ) {
        return state;
      }

      return {
        ...state,
        container: {
          width: action.width,
          height: action.height,
        },
      };

    case "pane.focus":
      return focusPane(state, action.paneId);

    case "pane.focusDirection":
      return focusPaneInDirection(state, action.paneId, action.direction);

    case "pane.resize":
      return resizePane(state, action.paneId, action.direction, action.deltaPx);

    case "pane.split":
      return splitPane(state, action.paneId, action.direction, action.newPaneId);

    case "pane.swap":
      return swapPanes(state, action.firstPaneId, action.secondPaneId);

    case "pane.swapDirection":
      return swapPaneInDirection(state, action.paneId, action.direction);

    case "pane.close":
      return closePane(state, action.paneId);

    case "handle.resize":
      return resizeHandle(
        state,
        action.splitId,
        action.index,
        action.deltaPx,
        action.snapshotSizes,
      );
  }
}
