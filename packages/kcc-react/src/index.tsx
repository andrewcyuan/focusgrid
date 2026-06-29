import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  KCLController,
  createKCLController,
  type KCLActionBinding,
  type KCLCellContext,
  type KCLControllerState,
  type KCLOrientation,
} from "@focusgrid/kcc-core";
import { KCLDomController } from "@focusgrid/kcc-dom";

export type KeyboardControlledListProps<T> = {
  controller: KCLController;
  keymap: readonly KCLActionBinding<T>[];
  direction: KCLOrientation;
  renderCell: (ctx: KCLCellContext<T>) => ReactNode;
  dataList: readonly T[];
  selectDefaultIndex?: (dataList: readonly T[] | undefined) => number;
  className?: string;
};

export function KeyboardControlledList<T>({
  controller,
  keymap,
  direction,
  renderCell,
  dataList,
  selectDefaultIndex,
  className,
}: KeyboardControlledListProps<T>) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const domControllerRef = useRef<KCLDomController<T> | null>(null);
  const state = useKCLControllerState(controller);
  const rootId = useMemo(() => createRootId(), []);

  useEffect(() => {
    controller.api.setOrientation(direction);
  }, [controller, direction]);

  useEffect(() => {
    controller.api.setItemCount(dataList.length, (itemCount) => {
      if (!selectDefaultIndex) {
        return 0;
      }

      return selectDefaultIndex(dataList.slice(0, itemCount));
    });
  }, [controller, dataList, selectDefaultIndex]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const domController = new KCLDomController(controller, root, {
      keymap,
      dataList,
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
    domControllerRef.current?.update({ keymap, dataList, rootId });
  }, [keymap, dataList, rootId]);

  const rootClassName = className
    ? `KCLKeyboardControlledList ${className}`
    : "KCLKeyboardControlledList";

  return (
    <div ref={rootRef} id={rootId} className={rootClassName}>
      {dataList.map((data, index) => {
        const rowProps = domControllerRef.current?.getRowProps(index) ?? {
          id: `${rootId}-row-${index}`,
          role: "option" as const,
          "aria-selected": state.activeIndex === index ? "true" : "false",
          tabIndex: -1,
          onPointerDown: (
            event: Pick<PointerEvent, "preventDefault" | "target">,
          ) =>
            event.preventDefault(),
          onClick: (_event: Pick<MouseEvent, "target">) => {
            controller.api.setActiveIndex(index);
          },
          onDoubleClick: (_event: Pick<MouseEvent, "target">) => undefined,
        };

        return (
          <div
            key={index}
            id={rowProps.id}
            role={rowProps.role}
            aria-selected={rowProps["aria-selected"]}
            tabIndex={rowProps.tabIndex}
            data-kcl-row-index={index}
            data-active={state.activeIndex === index}
            onPointerDown={(event) => rowProps.onPointerDown(event.nativeEvent)}
            onClick={(event) => rowProps.onClick(event.nativeEvent)}
            onDoubleClick={(event) => rowProps.onDoubleClick(event.nativeEvent)}
          >
            {renderCell(controller.getCellContext(index, data))}
          </div>
        );
      })}
    </div>
  );
}

export function useKCLController(
  options?: Parameters<typeof createKCLController>[0],
): KCLController {
  const ref = useRef<KCLController | null>(null);

  if (!ref.current) {
    ref.current = createKCLController(options);
  }

  return ref.current;
}

export function useKCLControllerState(
  controller: KCLController,
): KCLControllerState {
  return useSyncExternalStore(
    (listener) => controller.subscribe(listener),
    () => controller.getState(),
    () => controller.getState(),
  );
}

let nextRootId = 0;

function createRootId(): string {
  nextRootId += 1;
  return `kcl-${nextRootId}`;
}

export type {
  KCLActionBinding,
  KCLCellAction,
  KCLCellContext,
  KCLCommandAction,
  KCLCommandArgs,
  KCLCommandName,
  KCLController,
  KCLControllerApi,
  KCLControllerOptions,
  KCLControllerState,
  KCLMoveDirection,
  KCLOrientation,
  KCLShortcutId,
  KCLShortcutOverrides,
  KCLShortcutValues,
} from "@focusgrid/kcc-core";
export {
  createDefaultKCLKeymap,
  createDefaultKCLShortcuts,
  createKCLController,
  defaultKCLShortcutActions,
} from "@focusgrid/kcc-core";
