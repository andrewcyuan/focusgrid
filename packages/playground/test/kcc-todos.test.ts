import { describe, expect, it } from "vitest";
import {
  createInitialTodos,
  toggleTodo,
  updateTodoLabel,
} from "../src/kcc-todos";

describe("KCC todo playground helpers", () => {
  it("creates pane-specific initial todos", () => {
    expect(createInitialTodos("alpha")).toEqual([
      {
        id: "alpha-triage",
        label: "Triage alpha inbox",
        checked: false,
      },
      {
        id: "alpha-review",
        label: "Review keyboard behavior",
        checked: true,
      },
      {
        id: "alpha-ship",
        label: "Ship deterministic focus",
        checked: false,
      },
    ]);
  });

  it("toggles one todo without mutating the source array", () => {
    const source = createInitialTodos("beta");
    const next = toggleTodo(source, 0);

    expect(next[0]?.checked).toBe(true);
    expect(source[0]?.checked).toBe(false);
    expect(next[1]).toBe(source[1]);
  });

  it("updates one todo label without mutating the source array", () => {
    const source = createInitialTodos("beta");
    const next = updateTodoLabel(source, 1, "Review edit mode");

    expect(next[1]?.label).toBe("Review edit mode");
    expect(source[1]?.label).toBe("Review keyboard behavior");
    expect(next[0]).toBe(source[0]);
    expect(next[2]).toBe(source[2]);
  });
});
