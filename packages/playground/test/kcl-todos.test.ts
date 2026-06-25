import { describe, expect, it } from "vitest";
import { createInitialTodos, toggleTodo } from "../src/kcl-todos";

describe("KCL todo playground helpers", () => {
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
});
