import { PaneCommandCapability, type FocusGridControllerState, type NodeId, type PaneId } from "./layout/types";

export type FocusGridStateValidationError = {
  code: string;
  path: string;
  message: string;
  paneId?: PaneId;
  nodeId?: NodeId;
};

export type FocusGridStateValidationResult =
  | { ok: true; state: FocusGridControllerState; errors: [] }
  | { ok: false; errors: FocusGridStateValidationError[] };

type ValidationMeta = Pick<FocusGridStateValidationError, "paneId" | "nodeId">;

export class FocusGridStateValidationException extends Error {
  constructor(readonly errors: FocusGridStateValidationError[]) {
    const details = errors.slice(0, 3).map((error) => `${error.path}: ${error.message}`).join("; ");
    const suffix = errors.length > 3 ? `; ${errors.length - 3} more` : "";
    super(details ? `Invalid FocusGrid controller state: ${details}${suffix}` : "Invalid FocusGrid controller state.");
    this.name = "FocusGridStateValidationException";
  }
}

export function assertValidFocusGridControllerState(input: unknown): asserts input is FocusGridControllerState {
  const result = validateFocusGridControllerState(input);
  if (!result.ok) throw new FocusGridStateValidationException(result.errors);
}

export function validateFocusGridControllerState(input: unknown): FocusGridStateValidationResult {
  const errors: FocusGridStateValidationError[] = [];
  const nodeIds = new Set<NodeId>();
  const paneIds = new Set<PaneId>();

  function add(code: string, path: string, message: string, meta: ValidationMeta = {}): void {
    errors.push({ code, path, message, ...meta });
  }

  function fields(value: Record<string, unknown>, path: string, allowed: ReadonlySet<string>, meta: ValidationMeta = {}): void {
    for (const field of Object.keys(value)) {
      if (!allowed.has(field)) add("unknown-field", `${path}.${field}`, `Unknown field "${field}".`, meta);
    }
  }

  function size(value: unknown, path: string, label: string, meta: ValidationMeta = {}): void {
    if (!isSize(value)) add("invalid-number", path, `${label} must be a finite, non-negative number.`, meta);
  }

  function id(value: unknown, seen: Set<string>, kind: "pane" | "node", path: string, meta: ValidationMeta): void {
    const label = kind === "pane" ? "Pane" : "Node";
    if (typeof value !== "string" || value.length === 0) {
      add(`invalid-${kind}-id`, path, `${label} id must be a non-empty string.`, meta);
    } else if (seen.has(value)) {
      add(`duplicate-${kind}-id`, path, `Duplicate ${kind} id "${value}".`, { ...meta, [kind === "pane" ? "paneId" : "nodeId"]: value });
    } else {
      seen.add(value);
    }
  }

  function node(value: unknown, path: string): void {
    if (!isRecord(value)) {
      add("invalid-node", path, "Layout node must be an object.");
      return;
    }
    const meta: ValidationMeta = {
      nodeId: typeof value.id === "string" ? value.id : undefined,
      paneId: typeof value.paneId === "string" ? value.paneId : undefined,
    };
    if (value.kind !== "pane" && value.kind !== "split") {
      add("invalid-node-kind", `${path}.kind`, 'Layout node kind must be "pane" or "split".', meta);
      return;
    }
    fields(value, path, value.kind === "pane" ? PANE_FIELDS : SPLIT_FIELDS, meta);
    id(value.id, nodeIds, "node", `${path}.id`, meta);
    if (value.kind === "pane") {
      id(value.paneId, paneIds, "pane", `${path}.paneId`, meta);
      for (const key of Object.values(PaneCommandCapability)) {
        if (key in value && typeof value[key] !== "boolean") {
          add("invalid-capability", `${path}.${key}`, `${key} must be a boolean when provided.`, meta);
        }
      }
      return;
    }
    if (value.orientation !== "horizontal" && value.orientation !== "vertical") {
      add("invalid-direction", `${path}.orientation`, 'Split orientation must be "horizontal" or "vertical".', meta);
    }
    if (!Array.isArray(value.children)) {
      add("invalid-children", `${path}.children`, "Split children must be an array.", meta);
    } else {
      if (value.children.length !== 2) add("non-binary-split", `${path}.children`, "Split nodes must have exactly two children.", meta);
      value.children.forEach((child, index) => node(child, `${path}.children[${index}]`));
    }
    if (!Array.isArray(value.sizes)) {
      add("invalid-sizes", `${path}.sizes`, "Split sizes must be an array.", meta);
    } else {
      if (value.sizes.length !== 2) add("invalid-sizes", `${path}.sizes`, "Split sizes must contain exactly two values.", meta);
      value.sizes.forEach((entry, index) => {
        if (!isSize(entry)) add("invalid-size", `${path}.sizes[${index}]`, "Split sizes must be finite, non-negative numbers.", meta);
      });
    }
    if (value.lastFocusedChildId !== undefined && typeof value.lastFocusedChildId !== "string") {
      add("invalid-last-focused-child", `${path}.lastFocusedChildId`, "lastFocusedChildId must be a node id string when provided.", meta);
    }
    if (typeof value.lastFocusedChildId === "string" && Array.isArray(value.children) &&
      !value.children.some((child) => isRecord(child) && child.id === value.lastFocusedChildId)) {
      add("invalid-last-focused-child", `${path}.lastFocusedChildId`, "lastFocusedChildId must reference one of the split's direct children.", { ...meta, nodeId: value.lastFocusedChildId });
    }
  }

  if (!isRecord(input)) {
    add("invalid-state", "$", "State must be an object.");
  } else {
    fields(input, "$", STATE_FIELDS);
    for (const key of STATE_FIELDS) {
      if (!(key in input)) add("missing-field", `$.${key}`, `${key} is required.`);
    }
    if ("root" in input) node(input.root, "$.root");
    if ("activePaneId" in input) {
      if (input.activePaneId !== null && typeof input.activePaneId !== "string") {
        add("invalid-active-pane", "$.activePaneId", "State must use a pane id string or null for activePaneId.");
      } else if (typeof input.activePaneId === "string" && !paneIds.has(input.activePaneId)) {
        add("unknown-active-pane", "$.activePaneId", `activePaneId "${input.activePaneId}" does not reference a pane in root.`, { paneId: input.activePaneId });
      }
    }
    if ("container" in input) {
      if (!isRecord(input.container)) {
        add("invalid-container", "$.container", "Container must be an object.");
      } else {
        fields(input.container, "$.container", CONTAINER_FIELDS);
        for (const key of CONTAINER_FIELDS) {
          if (!(key in input.container)) add("missing-field", `$.container.${key}`, `${key} is required.`);
          else size(input.container[key], `$.container.${key}`, `container ${key}`);
        }
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, state: input as FocusGridControllerState, errors: [] };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isSize(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input) && input >= 0;
}

const STATE_FIELDS = new Set(["root", "activePaneId", "container"]);
const CONTAINER_FIELDS = new Set(["width", "height"]);
const PANE_FIELDS = new Set(["kind", "id", "paneId", ...Object.values(PaneCommandCapability)]);
const SPLIT_FIELDS = new Set(["kind", "id", "orientation", "children", "sizes", "lastFocusedChildId"]);
