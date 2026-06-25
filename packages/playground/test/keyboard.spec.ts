import { expect, test, type Locator } from "@playwright/test";

async function setTextareaSelection(
  textarea: Locator,
  selectionStart: number,
  selectionEnd: number,
) {
  await textarea.evaluate((element, selection) => {
    const textAreaElement = element as HTMLTextAreaElement;
    textAreaElement.setSelectionRange(selection.start, selection.end);
  }, { start: selectionStart, end: selectionEnd });
}

test("pane shortcuts are handled before focused textareas edit text", async ({
  page,
}) => {
  await page.goto("/");

  const alphaText = page.locator('[data-pane-id="alpha"] textarea');
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(page.locator(".TextPane")).toHaveCount(3);
});

test("directional swap shortcuts move the active pane from a focused textarea", async ({
  page,
}) => {
  await page.goto("/");

  const alphaPane = page.locator('[data-pane-id="alpha"]');
  const betaPane = page.locator('[data-pane-id="beta"]');
  const alphaText = alphaPane.locator("textarea");
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  const initialAlphaBox = await alphaPane.boundingBox();
  const initialBetaBox = await betaPane.boundingBox();
  expect(initialAlphaBox).not.toBeNull();
  expect(initialBetaBox).not.toBeNull();
  expect(initialAlphaBox!.x).toBeLessThan(initialBetaBox!.x);

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+ArrowRight");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(alphaText).toBeFocused();
  await expect(alphaPane).toHaveAttribute("data-active", "true");
  await expect.poll(async () => {
    const alphaBox = await alphaPane.boundingBox();
    const betaBox = await betaPane.boundingBox();
    return (alphaBox?.x ?? 0) > (betaBox?.x ?? 0);
  }).toBe(true);
});

test("invalid shortcut continuations are no-opped instead of typed", async ({
  page,
}) => {
  await page.goto("/");

  const alphaText = page.locator('[data-pane-id="alpha"] textarea');
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Z");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(page.locator(".TextPane")).toHaveCount(2);

  await page.keyboard.press("Z");
  await expect(alphaText).toHaveValue("abcZdef");
});

test("saved plus-style shortcuts are migrated before parsing", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "focusgrid.playground.shortcuts",
      JSON.stringify({
        "split-right": "Ctrl+B %",
      }),
    );
  });

  await page.goto("/");

  const alphaText = page.locator('[data-pane-id="alpha"] textarea');
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(page.locator(".TextPane")).toHaveCount(3);
});

test("repeatable leader followers run without replaying the leader", async ({
  page,
}) => {
  await page.goto("/");

  const alphaPane = page.locator('[data-pane-id="alpha"]');
  const alphaText = alphaPane.locator("textarea");
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  const initialBox = await alphaPane.boundingBox();
  expect(initialBox).not.toBeNull();

  await page.keyboard.press("Control+B");
  await page.keyboard.press("L");
  await page.keyboard.press("L");
  await page.keyboard.press("L");

  await expect(alphaText).toHaveValue("abcdef");
  await expect.poll(async () => {
    const box = await alphaPane.boundingBox();
    return box?.width ?? 0;
  }).toBeGreaterThan(initialBox!.width);

  const postGrowthWidth = (await alphaPane.boundingBox())?.width ?? 0;

  await page.keyboard.press("H");
  await page.keyboard.press("H");

  await expect(alphaText).toHaveValue("abcdef");
  await expect.poll(async () => {
    const box = await alphaPane.boundingBox();
    return box?.width ?? 0;
  }).toBeLessThan(postGrowthWidth);
});

test("horizontal pointer resize continues after dragging outside the handle", async ({
  page,
}) => {
  await page.goto("/");

  const alphaPane = page.locator('[data-pane-id="alpha"]');
  const resizeHandle = page
    .locator('.FocusgridResizeHandle[data-direction="horizontal"]')
    .first();

  await expect(resizeHandle).toBeVisible();

  const initialBox = await alphaPane.boundingBox();
  const handleBox = await resizeHandle.boundingBox();
  expect(initialBox).not.toBeNull();
  expect(handleBox).not.toBeNull();

  const startX = handleBox!.x + handleBox!.width / 2;
  const startY = handleBox!.y + handleBox!.height / 2;
  const dragDistance = Math.max(120, handleBox!.width * 20);

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  for (const step of [0.2, 0.45, 0.7, 1]) {
    await page.mouse.move(startX + dragDistance * step, startY, { steps: 4 });
  }

  await page.mouse.up();

  await expect
    .poll(async () => (await alphaPane.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialBox!.width + 80);
});

test("KCL route keeps focus on the list root and moves active row with arrows", async ({
  page,
}) => {
  await page.goto("/kcl");

  const alphaList = page.locator('[data-kcl-pane-id="alpha"] [role="listbox"]');
  await expect(alphaList).toBeFocused();
  await expect(alphaList).toHaveAttribute("aria-activedescendant", /row-0$/);

  await page.keyboard.press("ArrowDown");

  await expect(alphaList).toBeFocused();
  await expect(alphaList).toHaveAttribute("aria-activedescendant", /row-1$/);
  await expect(
    page.locator('[data-kcl-pane-id="alpha"] [role="option"]').nth(1),
  ).toHaveAttribute("aria-selected", "true");
});

test("KCL Enter toggles the active todo without moving DOM focus into rows", async ({
  page,
}) => {
  await page.goto("/kcl");

  const alphaList = page.locator('[data-kcl-pane-id="alpha"] [role="listbox"]');
  const firstRow = page
    .locator('[data-kcl-pane-id="alpha"] [role="option"]')
    .first();
  const checkbox = firstRow.locator('input[type="checkbox"]');

  await expect(alphaList).toBeFocused();
  await expect(checkbox).not.toBeChecked();

  await page.keyboard.press("Enter");

  await expect(alphaList).toBeFocused();
  await expect(checkbox).toBeChecked();
  await expect(firstRow.locator(".KCLTodoRow")).toHaveAttribute(
    "data-checked",
    "true",
  );
});

test("KCL pointer selection focuses the list and activates rows on double click", async ({
  page,
}) => {
  await page.goto("/kcl");

  const alphaList = page.locator('[data-kcl-pane-id="alpha"] [role="listbox"]');
  const rows = page.locator('[data-kcl-pane-id="alpha"] [role="option"]');
  const thirdRow = rows.nth(2);
  const thirdCheckbox = thirdRow.locator('input[type="checkbox"]');

  await thirdRow.click();
  await expect(alphaList).toBeFocused();
  await expect(thirdRow).toHaveAttribute("aria-selected", "true");
  await expect(alphaList).toHaveAttribute("aria-activedescendant", /row-2$/);
  await expect(thirdCheckbox).not.toBeChecked();

  await thirdRow.dblclick();
  await expect(alphaList).toBeFocused();
  await expect(thirdCheckbox).toBeChecked();
});

test("KCL route exposes FocusGrid shortcuts and pane shortcuts work while list is focused", async ({
  page,
}) => {
  await page.goto("/kcl");

  await expect(page.getByRole("heading", { name: "KCL rows" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "FocusGrid panes" }),
  ).toBeVisible();
  await expect(page.getByLabel("Split right")).toHaveValue("Ctrl-B %");

  const alphaList = page.locator('[data-kcl-pane-id="alpha"] [role="listbox"]');
  await expect(alphaList).toBeFocused();

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(page.locator(".KCLPane")).toHaveCount(3);

  const activeList = page.locator('.KCLPane[data-active="true"] [role="listbox"]');
  await expect(activeList).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(activeList).toHaveAttribute("aria-activedescendant", /row-1$/);
});
