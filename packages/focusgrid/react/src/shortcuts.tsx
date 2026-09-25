import { useBrowserLayoutEffect } from "./use-browser-layout-effect";
import {
  createContext, forwardRef, useContext, useId, useImperativeHandle,
  useRef, useState,
  type HTMLAttributes, type ReactNode,
} from "react";
import {
  createShortcutEngine,
  type ShortcutBinding, type ShortcutEngine, type ShortcutRegistration,
} from "@andrewcyuan/shortcut-engine";

const EngineContext = createContext<ShortcutEngine | null>(null);
export const ShortcutScopeContext = createContext<string | null>(null);

export type ShortcutProviderProps = {
  children: ReactNode;
  engine?: ShortcutEngine;
  ownerDocument?: Document;
};

export function ShortcutProvider({ children, engine: suppliedEngine, ownerDocument }: ShortcutProviderProps) {
  const [localEngine] = useState(createShortcutEngine);
  const engine = suppliedEngine ?? localEngine;
  useBrowserLayoutEffect(() => engine.mount(ownerDocument ?? document), [engine, ownerDocument]);
  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useShortcutEngine(): ShortcutEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error("Shortcut components must be inside a ShortcutProvider");
  return engine;
}

export type ShortcutScopeProps = HTMLAttributes<HTMLDivElement>;

export const ShortcutScope = forwardRef<HTMLDivElement, ShortcutScopeProps>(function ShortcutScope(
  { id: suppliedId, children, ...props }, forwardedRef,
) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const engine = useShortcutEngine();
  const parentId = useContext(ShortcutScopeContext);
  const elementRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => elementRef.current!, []);
  useBrowserLayoutEffect(() => engine.registerScope({ id, parentId, element: elementRef.current! }), [engine, id, parentId]);
  return (
    <ShortcutScopeContext.Provider value={id}>
      <div {...props} id={id} ref={elementRef}>{children}</div>
    </ShortcutScopeContext.Provider>
  );
});

export function useShortcuts(bindings: readonly ShortcutBinding[]): void {
  const engine = useShortcutEngine();
  const scopeId = useContext(ShortcutScopeContext);
  const registrationRef = useRef<ShortcutRegistration | null>(null);
  if (scopeId === null) throw new Error("useShortcuts requires a ShortcutScope");
  useBrowserLayoutEffect(() => {
    const registration = engine.registerBindings(scopeId, []);
    registrationRef.current = registration;
    return () => {
      registration.dispose();
      registrationRef.current = null;
    };
  }, [engine, scopeId]);
  useBrowserLayoutEffect(() => { registrationRef.current?.update(bindings); });
}
