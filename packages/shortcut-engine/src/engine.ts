import { normalizeKeyboardEvent, normalizeShortcut } from "./keys";
import { idleSequence, transitionSequence, type ShortcutBinding, type ShortcutStatus } from "./matching";

export type ShortcutScopeOptions = { id: string; parentId: string | null };
export type ShortcutRegistration = { update(bindings: readonly ShortcutBinding[]): void; dispose(): void };
type Contribution = { bindings: ShortcutBinding[] };
// An undefined parent marks a scope whose contributors mounted before its owner.
type Scope = { parentId?: string | null; bindings: Set<Contribution> };

export class ShortcutEngine {
  private readonly scopes = new Map<string, Scope>();
  private activeScopeId: string | null = null;
  private state = idleSequence();

  registerScope({ id, parentId }: ShortcutScopeOptions): () => void {
    if (this.scopes.get(id)?.parentId !== undefined) throw new Error(`Duplicate shortcut scope: ${id}`);
    if (this.path(parentId).includes(id)) throw new Error("Shortcut scope parents must not form a cycle");
    const scope = this.scope(id);
    scope.parentId = parentId;
    this.resetIfActive(id);
    return () => {
      if (this.scopes.get(id) !== scope) return;
      if (this.isScopeActive(id)) this.setActiveScope(parentId);
      this.scopes.delete(id);
      scope.bindings.clear();
    };
  }

  registerBindings(id: string, bindings: readonly ShortcutBinding[]): ShortcutRegistration {
    const contribution = { bindings: compile(bindings) };
    const scope = this.scope(id);
    scope.bindings.add(contribution);
    this.resetIfActive(id);
    return {
      update: (next) => {
        if (!scope.bindings.has(contribution)) return;
        const compiled = compile(next);
        if (structure(contribution.bindings) !== structure(compiled)) this.resetIfActive(id);
        contribution.bindings = compiled;
      },
      dispose: () => {
        if (!scope.bindings.delete(contribution)) return;
        this.resetIfActive(id);
        if (scope.parentId === undefined && !scope.bindings.size) this.scopes.delete(id);
      },
    };
  }

  getActiveScopeId(): string | null {
    return this.activeScopeId;
  }

  setActiveScope(id: string | null): void {
    if (id === this.activeScopeId) return;
    this.activeScopeId = id;
    this.reset();
  }

  handle(event: KeyboardEvent): ShortcutStatus {
    if (event.defaultPrevented) return "ignored";
    if (event.isComposing) {
      this.reset();
      return "ignored";
    }
    const key = normalizeKeyboardEvent(event);
    const path = this.path();
    if (key === null || !path.length || path.some((id) => this.scopes.get(id)?.parentId === undefined))
      return "ignored";
    const bindings = path.flatMap((id) =>
      [...this.scopes.get(id)!.bindings]
        .toReversed()
        .flatMap((entry) => entry.bindings.toReversed())
        .filter((binding) => !binding.when || binding.when(event)),
    );
    const result = transitionSequence(this.state, key, bindings);
    // Commit before callbacks, which can change focus or remove scopes.
    this.state = result.state;
    if (result.status !== "ignored" && result.binding?.preventDefault !== false) {
      event.preventDefault();
      event.stopPropagation();
    }
    result.binding?.action(event);
    return result.status;
  }

  private isScopeActive(id: string): boolean {
    return this.path().includes(id);
  }

  private reset(): void {
    this.state = idleSequence();
  }

  private resetIfActive(id: string): void {
    if (this.isScopeActive(id)) this.reset();
  }

  private scope(id: string): Scope {
    if (!this.scopes.has(id)) this.scopes.set(id, { bindings: new Set() });
    return this.scopes.get(id)!;
  }

  private path(id = this.activeScopeId): string[] {
    const path: string[] = [];
    while (id !== null) {
      path.push(id);
      id = this.scopes.get(id)?.parentId ?? null;
    }
    return path;
  }
}

function compile(bindings: readonly ShortcutBinding[]): ShortcutBinding[] {
  return bindings.map((binding) => ({ ...binding, sequence: normalizeShortcut(binding.sequence) }));
}

function structure(bindings: readonly ShortcutBinding[]): string {
  return JSON.stringify(
    bindings.map((binding) => [binding.sequence, binding.repeat ?? false, binding.preventDefault ?? true]),
  );
}
