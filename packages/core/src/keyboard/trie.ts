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

export class KeyRouter {
  private readonly root: KeyTrieNode;
  private current: KeyTrieNode;

  constructor(bindings: KeyBinding[]) {
    this.root = createTrie(bindings);
    this.current = this.root;
  }

  reset(): void {
    this.current = this.root;
  }

  handle(stroke: KeyStroke, ctx: ShortcutContext): KeyMatchResult {
    const id = strokeToId(stroke);
    const next = this.current.children.get(id) ?? this.root.children.get(id);

    if (!next) {
      this.current = this.root;
      return {
        matched: false,
        pending: false,
      };
    }

    this.current = next;

    if (next.binding && (!next.binding.when || next.binding.when(ctx))) {
      const binding = next.binding;
      this.current = this.root;

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
}

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
