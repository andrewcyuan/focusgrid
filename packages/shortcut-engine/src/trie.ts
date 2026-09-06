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
  private state: KeyRouterState<TContext, TAction, TArgs> = {
    phase: "idle",
    repeat: null,
  };
  private readonly repeatTimeoutMs: number;
  private readonly now: () => number;

  constructor(
    bindings: ShortcutBinding<TContext, TAction, TArgs>[],
    options: KeyRouterOptions = {},
  ) {
    this.root = createTrie(bindings);
    this.repeatTimeoutMs = options.repeatTimeoutMs ?? DEFAULT_REPEAT_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
  }

  reset(): void {
    this.state = { phase: "idle", repeat: null };
  }

  handle(
    stroke: KeyStroke,
    ctx: TContext,
  ): ShortcutMatchResult<TAction, TArgs> {
    const transition = transitionKeyRouter(
      this.root,
      this.state,
      strokeToId(stroke),
      ctx,
      this.now(),
      this.repeatTimeoutMs,
    );
    this.state = transition.state;
    return transition.result;
  }
}

type KeyRouterState<
  TContext,
  TAction extends string,
  TArgs,
> =
  | {
      phase: "idle";
      repeat: RepeatPrefix<TContext, TAction, TArgs> | null;
    }
  | {
      phase: "pending";
      current: KeyTrieNode<TContext, TAction, TArgs>;
    };

export function transitionKeyRouter<
  TContext,
  TAction extends string,
  TArgs,
>(
  root: KeyTrieNode<TContext, TAction, TArgs>,
  state: KeyRouterState<TContext, TAction, TArgs>,
  strokeId: string,
  context: TContext,
  now: number,
  repeatTimeoutMs: number,
): {
  state: KeyRouterState<TContext, TAction, TArgs>;
  result: ShortcutMatchResult<TAction, TArgs>;
} {
  if (state.phase === "idle" && state.repeat) {
    if (now <= state.repeat.expiresAt) {
      const binding = state.repeat.node.children.get(strokeId)?.binding;
      if (
        !binding ||
        !binding.repeat ||
        binding.sequence.length !== 2 ||
        (binding.when && !binding.when(context))
      ) {
        return {
          state: idleState(),
          result: { matched: false, pending: false, preventDefault: true },
        };
      }

      return matchedTransition(root, binding, now, repeatTimeoutMs);
    }
    state = idleState();
  }

  const wasPending = state.phase === "pending";
  const current = state.phase === "pending" ? state.current : root;
  const next = current.children.get(strokeId) ?? root.children.get(strokeId);

  if (!next) {
    return {
      state: idleState(),
      result: { matched: false, pending: false, preventDefault: wasPending },
    };
  }

  if (next.binding && (!next.binding.when || next.binding.when(context))) {
    return matchedTransition(root, next.binding, now, repeatTimeoutMs);
  }

  if (next.binding) {
    return {
      state: idleState(),
      result: { matched: false, pending: false },
    };
  }

  return {
    state: { phase: "pending", current: next },
    result: { matched: false, pending: next.children.size > 0 },
  };
}

function matchedTransition<
  TContext,
  TAction extends string,
  TArgs,
>(
  root: KeyTrieNode<TContext, TAction, TArgs>,
  binding: ShortcutBinding<TContext, TAction, TArgs>,
  now: number,
  repeatTimeoutMs: number,
): {
  state: KeyRouterState<TContext, TAction, TArgs>;
  result: ShortcutMatchResult<TAction, TArgs>;
} {
  const prefixNode = binding.repeat && binding.sequence.length === 2
    ? root.children.get(strokeToId(binding.sequence[0]))
    : undefined;
  return {
    state: {
      phase: "idle",
      repeat: prefixNode
        ? { node: prefixNode, expiresAt: now + repeatTimeoutMs }
        : null,
    },
    result: {
      matched: true,
      pending: false,
      action: binding.action,
      args: binding.args,
      preventDefault: binding.preventDefault ?? true,
    },
  };
}

function idleState<
  TContext,
  TAction extends string,
  TArgs,
>(): KeyRouterState<TContext, TAction, TArgs> {
  return { phase: "idle", repeat: null };
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
