import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
} from "react";
import { ShortcutEngine, type ShortcutRegistration } from "../engine";
import type { ShortcutBinding } from "../matching";
import { mountShortcutListener } from "./shortcut-listener";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const engine = new ShortcutEngine();
const rootScopeId = "shortcut-engine-root";
engine.registerScope({ id: rootScopeId, parentId: null });
const ShortcutScopeContext = createContext(rootScopeId);

export const ShortcutScope = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function ShortcutScope(
  { id: suppliedId, children, ...props },
  forwardedRef,
) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const parentId = useContext(ShortcutScopeContext);
  useBrowserLayoutEffect(() => engine.registerScope({ id, parentId }), [id, parentId]);
  return (
    <ShortcutScopeContext.Provider value={id}>
      <div {...props} id={id} data-shortcut-scope={id} ref={forwardedRef}>
        {children}
      </div>
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
    };
  }, [scopeId]);
  useBrowserLayoutEffect(() => {
    registrationRef.current?.update(bindings);
  });
}
