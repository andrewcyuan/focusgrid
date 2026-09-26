import { useBrowserLayoutEffect } from "./use-browser-layout-effect";
import {
  createContext, forwardRef, useContext, useId,
  useRef,
  type HTMLAttributes,
} from "react";
import {
  createShortcutEngine,
  type ShortcutBinding, type ShortcutRegistration,
} from "../index";

import { mountShortcutListener } from "./shortcut-listener";

const engine = createShortcutEngine();
const rootScopeId = "shortcut-engine-root";
engine.registerScope({ id: rootScopeId, parentId: null });
export const ShortcutScopeContext = createContext(rootScopeId);

export type ShortcutScopeProps = HTMLAttributes<HTMLDivElement>;

export const ShortcutScope = forwardRef<HTMLDivElement, ShortcutScopeProps>(function ShortcutScope(
  { id: suppliedId, children, ...props }, forwardedRef,
) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const parentId = useContext(ShortcutScopeContext);
  useBrowserLayoutEffect(() => engine.registerScope({ id, parentId }), [engine, id, parentId]);
  return (
    <ShortcutScopeContext.Provider value={id}>
      <div {...props} id={id} data-shortcut-scope={id} ref={forwardedRef}>{children}</div>
    </ShortcutScopeContext.Provider>
  );
});

export function useShortcuts(bindings: readonly ShortcutBinding[]): void {
  const scopeId = useContext(ShortcutScopeContext);
  const registrationRef = useRef<ShortcutRegistration | null>(null);
  useBrowserLayoutEffect(() => {
    const release = mountShortcutListener(engine, document, rootScopeId);
    const registration = engine.registerBindings(scopeId, []);
    registrationRef.current = registration;
    return () => {
      registration.dispose();
      release();
      registrationRef.current = null;
    };
  }, [engine, scopeId]);
  useBrowserLayoutEffect(() => { registrationRef.current?.update(bindings); });
}
