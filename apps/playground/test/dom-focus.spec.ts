import { expect, test, type Page } from "@playwright/test";

async function request(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).evaluate((button: HTMLButtonElement) => button.click());
}

test.beforeEach(async ({ page }) => {
  await page.goto("/test/fixtures/focus.html");
});

test("preserves a focused textarea, its selection, and its content", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "editor-a" });
  await editor.focus();
  await editor.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(2, 4));
  await request(page, "Focus a");
  await expect(page.getByLabel("result")).toHaveText("true");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("abcdef");
  expect(await editor.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([2, 4]);
});

test("focuses the outer pane shell even when a nested grid has the same pane ID", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "editor-a" });
  await editor.focus();
  await request(page, "Adjacent");
  await expect(page.locator('#outer > [data-pane-id="b"]')).toBeFocused();
  await expect(page.getByLabel("active")).toHaveText("b");
  await expect(editor).toHaveValue("abcdef");
  await request(page, "Focus nested-only ID");
  await expect(page.getByLabel("result")).toHaveText("false");
  await expect(page.locator('#outer > [data-pane-id="b"]')).toBeFocused();
});

test("failed DOM focus and detached roots leave focus and active state unchanged", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "editor-a" });
  await editor.focus();
  await request(page, "Focus inert pane");
  await expect(page.getByLabel("result")).toHaveText("false");
  await expect(editor).toBeFocused();
  await request(page, "Detach");
  await request(page, "Adjacent");
  await expect(page.getByLabel("result")).toHaveText("false");
  await expect(page.getByLabel("active")).toHaveText("a");
  await expect(editor).toBeFocused();
});
