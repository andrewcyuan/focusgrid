import { strokeToId } from "./normalize";
import type {
  KeyStroke,
  ShortcutBinding,
  ShortcutMatchResult,
} from "./keymap";

export type KeyTrieNode<
  TContext = unknown,
  TAction extends string = string,
  TArgs = unknown,
> = {
  binding?: ShortcutBinding<TContext, TAction, TArgs>;
  children: Map<string, KeyTrieNode<TContext, TAction, TArgs>>;
};

export type KeyRouterOptions = {
  repeatTimeoutMs?: number;
  now?: () => number;
};

const DEFAULT_REPEAT_TIMEOUT_MS = 500;

export class KeyRouter<
  TContext = unknown,
  TAction extends string = string,
  TArgs = unknown,
> {
  private readonly root: KeyTrieNode<TContext, TAction, TArgs>;
  private current: KeyTrieNode<TContext, TAction, TArgs>;
  private repeat: RepeatPrefix<TContext, TAction, TArgs> | null = null;
  private readonly repeatTimeoutMs: number;
  private readonly now: () => number;

  constructor(
    bindings: ShortcutBinding<TContext, TAction, TArgs>[],
    options: KeyRouterOptions = {},
  ) {
    this.root = createTrie(bindings);
    this.current = this.root;
    this.repeatTimeoutMs = options.repeatTimeoutMs ?? DEFAULT_REPEAT_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
  }

  reset(): void {
    this.current = this.root;
    this.repeat = null;
  }

  handle(
    stroke: KeyStroke,
    ctx: TContext,
  ): ShortcutMatchResult<TAction, TArgs> {
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

    if (next.binding && (!next.binding.when || next.binding.when(ctx))) {
      const binding = next.binding;
      this.current = this.root;
      this.setRepeat(binding);

      return {
        matched: true,
        pending: false,
        action: binding.action,
        args: binding.args,
        preventDefault: binding.preventDefault ?? true,
      };
    }

    if (next.binding) {
      this.current = this.root;
      this.repeat = null;
      return {
        matched: false,
        pending: false,
      };
    }

    this.current = next;

    return {
      matched: false,
      pending: next.children.size > 0,
    };
  }

  private matchRepeat(
    id: string,
    ctx: TContext,
  ): ShortcutMatchResult<TAction, TArgs> | null {
    if (!this.repeat) {
      return null;
    }

    if (this.now() > this.repeat.expiresAt) {
      this.repeat = null;
      return null;
    }

    const next = this.repeat.node.children.get(id);
    const binding = next?.binding;

    if (
      !binding ||
      !binding.repeat ||
      binding.sequence.length !== 2 ||
      (binding.when && !binding.when(ctx))
    ) {
      this.repeat = null;
      return {
        matched: false,
        pending: false,
        preventDefault: true,
      };
    }

    this.setRepeat(binding);

    return {
      matched: true,
      pending: false,
      action: binding.action,
      args: binding.args,
      preventDefault: binding.preventDefault ?? true,
    };
  }

  private setRepeat(binding: ShortcutBinding<TContext, TAction, TArgs>): void {
    if (!binding.repeat || binding.sequence.length !== 2) {
      this.repeat = null;
      return;
    }

    const prefixStroke = binding.sequence[0];
    const prefixStrokeId = strokeToId(prefixStroke);
    const prefixNode = this.root.children.get(prefixStrokeId);

    if (!prefixNode) {
      this.repeat = null;
      return;
    }

    this.repeat = {
      node: prefixNode,
      expiresAt: this.now() + this.repeatTimeoutMs,
    };
  }
}

type RepeatPrefix<
  TContext = unknown,
  TAction extends string = string,
  TArgs = unknown,
> = {
  node: KeyTrieNode<TContext, TAction, TArgs>;
  expiresAt: number;
};

export function createTrie<
  TContext = unknown,
  TAction extends string = string,
  TArgs = unknown,
>(
  bindings: ShortcutBinding<TContext, TAction, TArgs>[],
): KeyTrieNode<TContext, TAction, TArgs> {
  const root: KeyTrieNode<TContext, TAction, TArgs> = {
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
