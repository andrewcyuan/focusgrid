import type {
  FocusGridControllerState,
  NodeId,
  PaneId,
} from "./layout/types";
import { paneCommandCapabilityKeys } from "./layout/types";

export type FocusGridStateValidationError = {
  code: string;
  path: string;
  message: string;
  paneId?: PaneId;
  nodeId?: NodeId;
};

export type FocusGridStateValidationResult =
  | {
      ok: true;
      state: FocusGridControllerState;
      errors: [];
    }
  | {
      ok: false;
      errors: FocusGridStateValidationError[];
    };

export class FocusGridStateValidationException extends Error {
  readonly errors: FocusGridStateValidationError[];

  constructor(errors: FocusGridStateValidationError[]) {
    super(formatValidationExceptionMessage(errors));
    this.name = "FocusGridStateValidationException";
    this.errors = errors;
  }
}

export function validateFocusGridControllerState(
  input: unknown,
): FocusGridStateValidationResult {
  const validator = new FocusGridStateValidator();
  const errors = validator.validate(input);

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    state: input as FocusGridControllerState,
    errors: [],
  };
}

export function assertValidFocusGridControllerState(
  input: unknown,
): asserts input is FocusGridControllerState {
  const result = validateFocusGridControllerState(input);

  if (!result.ok) {
    throw new FocusGridStateValidationException(result.errors);
  }
}

export function createInvalidJsonStateValidationException(
  message: string,
): FocusGridStateValidationException {
  return new FocusGridStateValidationException([
    {
      code: "invalid-json",
      path: "$",
      message,
    },
  ]);
}

type ValidationMeta = {
  paneId?: PaneId;
  nodeId?: NodeId;
};

class FocusGridStateValidator {
  private readonly errors: FocusGridStateValidationError[] = [];
  private readonly nodeIds = new Set<NodeId>();
  private readonly paneIds = new Set<PaneId>();

  validate(input: unknown): FocusGridStateValidationError[] {
    if (!isRecord(input)) {
      this.add("invalid-state", "$", "State must be an object.");
      return this.errors;
    }

    this.assertAllowedFields(input, "$", STATE_FIELDS);
    this.requireField(input, "root", "$");
    this.requireField(input, "activePaneId", "$");
    this.requireField(input, "container", "$");

    if ("root" in input) {
      this.validateNode(input.root, "$.root");
    }

    if ("activePaneId" in input) {
      if (input.activePaneId !== null && typeof input.activePaneId !== "string") {
        this.add(
          "invalid-active-pane",
          "$.activePaneId",
          "activePaneId must be a pane id string or null.",
        );
      } else if (
        typeof input.activePaneId === "string" &&
        !this.paneIds.has(input.activePaneId)
      ) {
        this.add(
          "unknown-active-pane",
          "$.activePaneId",
          `activePaneId "${input.activePaneId}" does not reference a pane in root.`,
          { paneId: input.activePaneId },
        );
      }
    }

    if ("container" in input) {
      this.validateContainer(input.container, "$.container");
    }

    return this.errors;
  }

  private validateNode(input: unknown, path: string): void {
    if (!isRecord(input)) {
      this.add("invalid-node", path, "Layout node must be an object.");
      return;
    }

    const meta = readNodeMeta(input);

    if (input.kind === "pane") {
      this.validatePane(input, path, meta);
      return;
    }

    if (input.kind === "split") {
      this.validateSplit(input, path, meta);
      return;
    }

    this.add(
      "invalid-node-kind",
      `${path}.kind`,
      'Layout node kind must be "pane" or "split".',
      meta,
    );
  }

  private validatePane(
    input: Record<string, unknown>,
    path: string,
    meta: ValidationMeta,
  ): void {
    this.assertAllowedFields(input, path, PANE_FIELDS, meta);
    this.validateNodeId(input, path, meta);
    this.validatePaneId(input, path, meta);

    if ("minWidth" in input) {
      this.validateOptionalNonNegativeFiniteNumber(
        input.minWidth,
        `${path}.minWidth`,
        "minWidth",
        meta,
      );
    }

    if ("minHeight" in input) {
      this.validateOptionalNonNegativeFiniteNumber(
        input.minHeight,
        `${path}.minHeight`,
        "minHeight",
        meta,
      );
    }

    for (const field of CAPABILITY_FIELDS) {
      if (field in input && typeof input[field] !== "boolean") {
        this.add(
          "invalid-capability",
          `${path}.${field}`,
          `${field} must be a boolean when provided.`,
          meta,
        );
      }
    }
  }

  private validateSplit(
    input: Record<string, unknown>,
    path: string,
    meta: ValidationMeta,
  ): void {
    this.assertAllowedFields(input, path, SPLIT_FIELDS, meta);
    this.validateNodeId(input, path, meta);

    if (input.direction !== "horizontal" && input.direction !== "vertical") {
      this.add(
        "invalid-direction",
        `${path}.direction`,
        'Split direction must be "horizontal" or "vertical".',
        meta,
      );
    }

    if (!Array.isArray(input.children)) {
      this.add(
        "invalid-children",
        `${path}.children`,
        "Split children must be an array.",
        meta,
      );
    } else {
      if (input.children.length !== 2) {
        this.add(
          "non-binary-split",
          `${path}.children`,
          "Split nodes must have exactly two children.",
          meta,
        );
      }

      input.children.forEach((child, index) => {
        this.validateNode(child, `${path}.children[${index}]`);
      });
    }

    if (!Array.isArray(input.sizes)) {
      this.add(
        "invalid-sizes",
        `${path}.sizes`,
        "Split sizes must be an array.",
        meta,
      );
    } else {
      if (input.sizes.length !== 2) {
        this.add(
          "invalid-sizes",
          `${path}.sizes`,
          "Split sizes must contain exactly two values.",
          meta,
        );
      }

      input.sizes.forEach((size, index) => {
        if (!isNonNegativeFiniteNumber(size)) {
          this.add(
            "invalid-size",
            `${path}.sizes[${index}]`,
            "Split sizes must be finite, non-negative numbers.",
            meta,
          );
        }
      });
    }

    if (
      "lastFocusedChildId" in input &&
      input.lastFocusedChildId !== undefined &&
      typeof input.lastFocusedChildId !== "string"
    ) {
      this.add(
        "invalid-last-focused-child",
        `${path}.lastFocusedChildId`,
        "lastFocusedChildId must be a node id string when provided.",
        meta,
      );
    }

    if (
      typeof input.lastFocusedChildId === "string" &&
      Array.isArray(input.children) &&
      !input.children.some(
        (child) => isRecord(child) && child.id === input.lastFocusedChildId,
      )
    ) {
      this.add(
        "invalid-last-focused-child",
        `${path}.lastFocusedChildId`,
        "lastFocusedChildId must reference one of the split's direct children.",
        { ...meta, nodeId: input.lastFocusedChildId },
      );
    }
  }

  private validateContainer(input: unknown, path: string): void {
    if (!isRecord(input)) {
      this.add("invalid-container", path, "Container must be an object.");
      return;
    }

    this.assertAllowedFields(input, path, CONTAINER_FIELDS);
    this.requireField(input, "width", path);
    this.requireField(input, "height", path);

    if ("width" in input) {
      this.validateOptionalNonNegativeFiniteNumber(
        input.width,
        `${path}.width`,
        "container width",
      );
    }

    if ("height" in input) {
      this.validateOptionalNonNegativeFiniteNumber(
        input.height,
        `${path}.height`,
        "container height",
      );
    }
  }

  private validateNodeId(
    input: Record<string, unknown>,
    path: string,
    meta: ValidationMeta,
  ): void {
    if (typeof input.id !== "string" || input.id.length === 0) {
      this.add(
        "invalid-node-id",
        `${path}.id`,
        "Node id must be a non-empty string.",
        meta,
      );
      return;
    }

    if (this.nodeIds.has(input.id)) {
      this.add(
        "duplicate-node-id",
        `${path}.id`,
        `Duplicate node id "${input.id}".`,
        { ...meta, nodeId: input.id },
      );
      return;
    }

    this.nodeIds.add(input.id);
  }

  private validatePaneId(
    input: Record<string, unknown>,
    path: string,
    meta: ValidationMeta,
  ): void {
    if (typeof input.paneId !== "string" || input.paneId.length === 0) {
      this.add(
        "invalid-pane-id",
        `${path}.paneId`,
        "Pane id must be a non-empty string.",
        meta,
      );
      return;
    }

    if (this.paneIds.has(input.paneId)) {
      this.add(
        "duplicate-pane-id",
        `${path}.paneId`,
        `Duplicate pane id "${input.paneId}".`,
        { ...meta, paneId: input.paneId },
      );
      return;
    }

    this.paneIds.add(input.paneId);
  }

  private validateOptionalNonNegativeFiniteNumber(
    input: unknown,
    path: string,
    label: string,
    meta: ValidationMeta = {},
  ): void {
    if (!isNonNegativeFiniteNumber(input)) {
      this.add(
        "invalid-number",
        path,
        `${label} must be a finite, non-negative number.`,
        meta,
      );
    }
  }

  private requireField(
    input: Record<string, unknown>,
    field: string,
    path: string,
    meta: ValidationMeta = {},
  ): void {
    if (!(field in input)) {
      this.add(
        "missing-field",
        `${path}.${field}`,
        `${field} is required.`,
        meta,
      );
    }
  }

  private assertAllowedFields(
    input: Record<string, unknown>,
    path: string,
    allowedFields: readonly string[],
    meta: ValidationMeta = {},
  ): void {
    const allowed = new Set(allowedFields);

    for (const field of Object.keys(input)) {
      if (allowed.has(field)) {
        continue;
      }

      if ((LEGACY_CAPABILITY_FIELDS as readonly string[]).includes(field)) {
        this.add(
          "legacy-capability-field",
          `${path}.${field}`,
          `${field} is not supported; use positive can* capability fields instead.`,
          meta,
        );
        continue;
      }

      this.add(
        "unknown-field",
        `${path}.${field}`,
        `Unknown field "${field}".`,
        meta,
      );
    }
  }

  private add(
    code: string,
    path: string,
    message: string,
    meta: ValidationMeta = {},
  ): void {
    this.errors.push({
      code,
      path,
      message,
      ...meta,
    });
  }
}

function formatValidationExceptionMessage(
  errors: FocusGridStateValidationError[],
): string {
  if (errors.length === 0) {
    return "Invalid FocusGrid controller state.";
  }

  const details = errors
    .slice(0, 3)
    .map((error) => `${error.path}: ${error.message}`)
    .join("; ");
  const suffix = errors.length > 3 ? `; ${errors.length - 3} more` : "";

  return `Invalid FocusGrid controller state: ${details}${suffix}`;
}

function readNodeMeta(input: Record<string, unknown>): ValidationMeta {
  return {
    nodeId: typeof input.id === "string" ? input.id : undefined,
    paneId: typeof input.paneId === "string" ? input.paneId : undefined,
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isNonNegativeFiniteNumber(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input) && input >= 0;
}

const STATE_FIELDS = ["root", "activePaneId", "container"] as const;
const CONTAINER_FIELDS = ["width", "height"] as const;
const CAPABILITY_FIELDS = paneCommandCapabilityKeys;
const LEGACY_CAPABILITY_FIELDS = [
  "noResizeX",
  "noResizeY",
  "noRemove",
  "noSplitHorizontal",
  "noSplitVertical",
  "noSwapX",
  "noSwapY",
  "noFocus",
] as const;
const PANE_FIELDS = [
  "kind",
  "id",
  "paneId",
  "minWidth",
  "minHeight",
  "data",
  ...CAPABILITY_FIELDS,
] as const;
const SPLIT_FIELDS = [
  "kind",
  "id",
  "direction",
  "children",
  "sizes",
  "lastFocusedChildId",
] as const;
