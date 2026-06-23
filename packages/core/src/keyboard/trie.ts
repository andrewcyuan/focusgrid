import { strokeToId } from "./normalize";
import type {
  KeyBinding,
  KeyMatchResult,
  KeyStroke,
  ShortcutContext,
} from "./keymap";

export type KeyTrieNode = {
  binding?: KeyBinding;
  children: Map<string, KeyTrieNode>;
};

export type KeyRouterOptions = {
  repeatTimeoutMs?: number;
  now?: () => number;
};

const DEFAULT_REPEAT_TIMEOUT_MS = 500;

export class KeyRouter {
  private readonly root: KeyTrieNode;
  private current: KeyTrieNode;
  private repeat: RepeatBinding | null = null;
  private readonly repeatTimeoutMs: number;
  private readonly now: () => number;

  constructor(bindings: KeyBinding[], options: KeyRouterOptions = {}) {
    this.root = createTrie(bindings);
    this.current = this.root;
    this.repeatTimeoutMs = options.repeatTimeoutMs ?? DEFAULT_REPEAT_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
  }

  reset(): void {
    this.current = this.root;
    this.repeat = null;
  }

  handle(stroke: KeyStroke, ctx: ShortcutContext): KeyMatchResult {
    const id = strokeToId(stroke);
    const wasPending = this.current !== this.root;

    if (!wasPending) {
      const repeated = this.matchRepeat(id, ctx);

      if (repeated) {
        return repeated;
      }
    }

    const next = this.current.children.get(id) ?? this.root.children.get(id);

    if (!next) {
      this.current = this.root;
      this.repeat = null;
      return {
        matched: false,
        pending: false,
        preventDefault: wasPending,
      };
    }

    this.current = next;

    if (next.binding && (!next.binding.when || next.binding.when(ctx))) {
      const binding = next.binding;
      this.current = this.root;
      this.setRepeat(id, binding);

      return {
        matched: true,
        pending: false,
        command: binding.command,
        args: binding.args,
        preventDefault: binding.preventDefault ?? true,
      };
    }

    return {
      matched: false,
      pending: next.children.size > 0,
    };
  }

  private matchRepeat(id: string, ctx: ShortcutContext): KeyMatchResult | null {
    if (!this.repeat || this.repeat.strokeId !== id) {
      this.repeat = null;
      return null;
    }

    if (this.now() > this.repeat.expiresAt) {
      this.repeat = null;
      return null;
    }

    const binding = this.repeat.binding;

    if (binding.when && !binding.when(ctx)) {
      this.repeat = null;
      return null;
    }

    this.setRepeat(id, binding);

    return {
      matched: true,
      pending: false,
      command: binding.command,
      args: binding.args,
      preventDefault: binding.preventDefault ?? true,
    };
  }

  private setRepeat(id: string, binding: KeyBinding): void {
    if (!binding.repeat || binding.sequence.length < 2) {
      this.repeat = null;
      return;
    }

    this.repeat = {
      strokeId: id,
      binding,
      expiresAt: this.now() + this.repeatTimeoutMs,
    };
  }
}

type RepeatBinding = {
  strokeId: string;
  binding: KeyBinding;
  expiresAt: number;
};

export function createTrie(bindings: KeyBinding[]): KeyTrieNode {
  const root: KeyTrieNode = {
    children: new Map(),
  };

  for (const binding of bindings) {
    let node = root;

    for (const stroke of binding.sequence) {
      const id = strokeToId(stroke);
      let child = node.children.get(id);

      if (!child) {
        child = {
          children: new Map(),
        };
        node.children.set(id, child);
      }

      node = child;
    }

    node.binding = binding;
  }

  return root;
}
