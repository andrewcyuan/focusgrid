import type { ReactNode } from "react";
import type { KclOrientation } from "@focusgrid/kcl";

export type KeyboardControlledListItemContext<Item> = {
  item: Item;
  index: number;
  active: boolean;
  focused: boolean;
};

export type KeyboardControlledListProps<Item> = {
  items: readonly Item[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  orientation?: KclOrientation;
  renderItem: (ctx: KeyboardControlledListItemContext<Item>) => ReactNode;
};

export type { KclMoveCommand, KclOrientation } from "@focusgrid/kcl";
