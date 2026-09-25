import { isModifierOnlyKey, normalizeKeyboardEvent } from "./dom";
import type { ShortcutBinding } from "./keymap";
import { strokeToId } from "./normalize";
import { idleSequence, transitionSequence, type IndexedBinding } from "./matching";

export type ShortcutScopeOptions = {
  id: string;
  parentId: string | null;
  element?: Element;
};
export type ShortcutRegistration = {
  update(bindings: readonly ShortcutBinding[]): void;
  dispose(): void;
};
export type ShortcutEngineOptions = { repeatTimeoutMs?: number; now?: () => number };
export type ShortcutStatus = "ignored" | "pending" | "handled";
type Contribution = { bindings: IndexedBinding[] };
const documentEngines = new WeakMap<Document, ShortcutEngine>();

export function createShortcutEngine(options?: ShortcutEngineOptions): ShortcutEngine {
  return new ShortcutEngine(options);
}

export class ShortcutEngine {
  private readonly scopes = new Map<string, ShortcutScopeOptions>();
  private readonly contributions = new Map<string, Set<Contribution>>();
  private activeScopeId: string | null = null;
  private state = idleSequence();
  private mounted: { document: Document; cleanup: () => void } | null = null;
  private readonly now: () => number;
  private readonly repeatTimeoutMs: number;

  constructor(options: ShortcutEngineOptions = {}) {
    this.now = options.now ?? Date.now;
    this.repeatTimeoutMs = options.repeatTimeoutMs ?? 500;
  }

  registerScope(options: ShortcutScopeOptions): () => void {
    if (this.scopes.has(options.id)) throw new Error(`Duplicate shortcut scope: ${options.id}`);
    const seen = new Set([options.id]);
    let parent = options.parentId;
    while (parent !== null) {
      if (seen.has(parent)) throw new Error("Shortcut scope parents must not form a cycle");
      seen.add(parent);
      parent = this.scopes.get(parent)?.parentId ?? null;
    }
    const scope = { ...options };
    this.scopes.set(scope.id, scope);
    if (this.isOnActivePath(scope.id)) this.reset();
    this.refreshFocus();
    return () => {
      if (this.scopes.get(scope.id) !== scope) return;
      if (this.isOnActivePath(scope.id)) this.setActiveScope(scope.parentId !== null && this.scopes.has(scope.parentId) ? scope.parentId : null);
      this.scopes.delete(scope.id);
      this.contributions.delete(scope.id);
    };
  }

  registerBindings(scopeId: string, bindings: readonly ShortcutBinding[]): ShortcutRegistration {
    // Contributions may mount before the scope's React layout effect.
    let entries = this.contributions.get(scopeId);
    if (!entries) {
      entries = new Set();
      this.contributions.set(scopeId, entries);
    }
    const contribution = { bindings: indexBindings(bindings) };
    entries.add(contribution);
    if (this.isOnActivePath(scopeId)) this.reset();
    let disposed = false;
    return {
      update: next => {
        if (disposed) return;
        const indexed = indexBindings(next);
        if (structure(contribution.bindings) !== structure(indexed) && this.isOnActivePath(scopeId)) this.reset();
        contribution.bindings = indexed;
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        entries.delete(contribution);
        if (entries.size === 0 && this.contributions.get(scopeId) === entries) {
          this.contributions.delete(scopeId);
        }
        if (this.isOnActivePath(scopeId)) this.reset();
      },
    };
  }

  getActiveScopeId(): string | null {
    return this.activeScopeId;
  }

  isScopeActive(id: string): boolean {
    return this.activePath().includes(id);
  }

  setActiveScope(id: string | null): void {
    if (id !== null && !this.scopes.has(id)) throw new Error(`Unknown shortcut scope: ${id}`);
    if (id === this.activeScopeId) return;
    this.activeScopeId = id;
    this.reset();
  }

  reset(): void { this.state = idleSequence(); }

  handle(event: KeyboardEvent): ShortcutStatus {
    if (event.defaultPrevented || isModifierOnlyKey(event.key)) return "ignored";
    if (event.isComposing) { this.reset(); return "ignored"; }
    const path = this.activePath();
    if (!path.length) return "ignored";
    const bindings = path.flatMap(id =>
      [...(this.contributions.get(id) ?? [])].reverse().flatMap(entry =>
        [...entry.bindings].reverse().filter(({ binding }) => !binding.when || binding.when(event)),
      ),
    );
    const result = transitionSequence(this.state, strokeToId(normalizeKeyboardEvent(event)), bindings, this.now(), this.repeatTimeoutMs);
    // Commit before callbacks: a callback can change focus, bindings, or remove scopes.
    this.state = result.state;
    if (result.status !== "ignored" && result.binding?.preventDefault !== false) {
      event.preventDefault();
      event.stopPropagation();
    }
    result.binding?.action(event);
    return result.status;
  }

  mount(document: Document): () => void {
    if (this.mounted) {
      if (this.mounted.document !== document) throw new Error("A shortcut engine can mount on only one document");
      return this.mounted.cleanup;
    }
    const existing = documentEngines.get(document);
    if (existing && existing !== this) throw new Error("Use one shared shortcut engine per document");
    const keydown = (event: KeyboardEvent) => { this.handle(event); };
    const focusin = (event: FocusEvent) => this.activateFromPath(event.composedPath());
    const focusout = (event: FocusEvent) => this.activateFromElement(event.relatedTarget as Element | null);
    const blur = () => this.setActiveScope(null);
    const focus = () => this.refreshFocus();
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin, true);
    document.addEventListener("focusout", focusout, true);
    document.defaultView?.addEventListener("blur", blur);
    document.defaultView?.addEventListener("focus", focus);
    const cleanup = () => {
      if (this.mounted?.cleanup !== cleanup) return;
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin, true);
      document.removeEventListener("focusout", focusout, true);
      document.defaultView?.removeEventListener("blur", blur);
      document.defaultView?.removeEventListener("focus", focus);
      documentEngines.delete(document);
      this.mounted = null;
      this.setActiveScope(null);
    };
    this.mounted = { document, cleanup };
    documentEngines.set(document, this);
    this.refreshFocus();
    return cleanup;
  }

  private activePath(): string[] {
    const path: string[] = [];
    let id = this.activeScopeId;
    while (id !== null) {
      const scope = this.scopes.get(id);
      if (!scope) return [];
      path.push(id);
      id = scope.parentId;
    }
    return path;
  }

  private isOnActivePath(id: string): boolean {
    let current = this.activeScopeId;
    while (current !== null) {
      if (current === id) return true;
      current = this.scopes.get(current)?.parentId ?? null;
    }
    return false;
  }

  private refreshFocus(): void {
    if (!this.mounted) return;
    let element = this.mounted.document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    this.activateFromElement(element);
  }

  private activateFromElement(element: Element | null): void {
    const path: EventTarget[] = [];
    while (element) {
      path.push(element);
      element = element.parentElement ?? (element.getRootNode() as ShadowRoot).host ?? null;
    }
    this.activateFromPath(path);
  }

  private activateFromPath(path: EventTarget[]): void {
    for (const element of path) {
      for (const scope of this.scopes.values()) {
        if (scope.element === element) { this.setActiveScope(scope.id); return; }
      }
    }
    this.setActiveScope(null);
  }
}

function indexBindings(bindings: readonly ShortcutBinding[]): IndexedBinding[] {
  return bindings.map(binding => {
    if (!binding.sequence.length) throw new Error("Shortcut sequences must not be empty");
    return { binding: { ...binding }, keys: binding.sequence.map(strokeToId) };
  });
}

function structure(bindings: readonly IndexedBinding[]): string {
  return JSON.stringify(bindings.map(({ keys, binding }) => [keys, binding.repeat ?? false, binding.preventDefault ?? true]));
}
