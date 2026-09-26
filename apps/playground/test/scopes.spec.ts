import { expect, test, type Page } from "@playwright/test";

async function focusEditor(page: Page, name = "pane-a") {
  const editor = page.getByRole("textbox", { name, exact: true });
  await editor.focus();
  await editor.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(3, 3));
  await expect(editor).toBeFocused();
  return editor;
}
async function clickWithoutMovingFocus(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).evaluate((element: HTMLButtonElement) => element.click());
}

test.beforeEach(async ({ page }) => {
  await page.goto("/test/fixtures/scopes.html");
});

test("parent complete matches run immediately; shared prefixes keep ancestor candidates", async ({ page }) => {
  const editor = await focusEditor(page);
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("result")).toHaveText("parent-short");
  await page.keyboard.press("g"); await page.keyboard.press("b");
  await expect(page.getByLabel("result")).toHaveText("parent-b:0");
  await page.keyboard.press("g"); await page.keyboard.press("a");
  await expect(page.getByLabel("result")).toHaveText("pane-a:child-a");
  await expect(editor).toHaveValue("abcdef");
  await expect(editor).toBeFocused();
});

test("only the focused branch runs, and deeper bindings override pane split and delete", async ({ page }) => {
  const editor = await focusEditor(page);
  await page.keyboard.press("F3");
  await expect(page.getByLabel("result")).toHaveText("pane-a:child");
  await page.keyboard.press("Control+b"); await page.keyboard.press("Shift+5");
  await expect(page.getByLabel("result")).toHaveText("pane-a:split-blocked");
  await page.keyboard.press("Control+b"); await page.keyboard.press("x");
  await expect(page.getByLabel("result")).toHaveText("pane-a:close-blocked");
  await expect(page.locator("[data-pane-id]")).toHaveCount(2);
  await expect(editor).toHaveValue("abcdef");
  const second = await focusEditor(page, "pane-b");
  await page.keyboard.press("F3");
  await expect(page.getByLabel("result")).toHaveText("pane-b:child");
  await expect(page.locator('[data-pane-id="pane-b"]')).toHaveAttribute("data-active", "true");
  await expect(second).toBeFocused();
});

test("rerenders preserve pending sequences, current callbacks, and registration priority", async ({ page }) => {
  const editor = await focusEditor(page);
  await page.keyboard.press("g");
  await clickWithoutMovingFocus(page, "Rerender");
  await page.keyboard.press("b");
  await expect(page.getByLabel("result")).toHaveText("parent-b:1");
  await page.keyboard.press("F2");
  await expect(page.getByLabel("result")).toHaveText("latest:1");
  await clickWithoutMovingFocus(page, "Toggle contributor");
  await page.keyboard.press("F2");
  await expect(page.getByLabel("result")).toHaveText("first:1");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("abcdef");
});

test("moving between scopes resets the sequence without leaking into the new pane", async ({ page }) => {
  await focusEditor(page);
  await page.keyboard.press("g");
  const second = await focusEditor(page, "pane-b");
  await page.keyboard.press("b");
  await expect(second).toHaveValue("abcbdef");
  await expect(page.getByLabel("result")).toHaveText("none");
  await expect(second).toBeFocused();
});

test("removed scopes stop routing and remount cleanly under StrictMode", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await focusEditor(page);
  await clickWithoutMovingFocus(page, "Toggle child");
  await focusEditor(page, "pane-a-plain");
  await page.keyboard.press("F3");
  await expect(page.getByLabel("result")).toHaveText("parent-f3");
  await clickWithoutMovingFocus(page, "Toggle module");
  await clickWithoutMovingFocus(page, "Toggle module");
  const editor = await focusEditor(page);
  await page.keyboard.press("F3");
  await expect(page.getByLabel("result")).toHaveText("pane-a:child");
  await expect(editor).toBeFocused();
  expect(errors).toEqual([]);
});

test("portal scopes use logical parents and external focus disables the module", async ({ page }) => {
  const editor = await focusEditor(page, "portal");
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("result")).toHaveText("parent-short");
  await page.keyboard.press("F3");
  await expect(page.getByLabel("result")).toHaveText("portal:child");
  await expect(editor).toBeFocused();
  const outside = page.getByRole("textbox", { name: "outside", exact: true });
  await outside.focus(); await page.keyboard.press("F3");
  await expect(page.getByLabel("result")).toHaveText("portal:child");
  await expect(outside).toBeFocused();
});

test("removing the focused element cannot leave an ancestor shortcut active on the body", async ({ page }) => {
  await focusEditor(page);
  await clickWithoutMovingFocus(page, "Toggle child");
  await expect(page.locator("body")).toBeFocused();
  await page.keyboard.press("F3");
  await expect(page.getByLabel("result")).toHaveText("none");
});


test("default root bindings execute once and survive nested consumer cleanup", async ({ page }) => {
  await focusEditor(page);
  await page.keyboard.press("F8");
  await expect(page.getByLabel("root-count")).toHaveText("1");
  await clickWithoutMovingFocus(page, "Toggle module");
  await page.getByRole("textbox", { name: "outside", exact: true }).focus();
  await page.keyboard.press("F8");
  await expect(page.getByLabel("root-count")).toHaveText("2");
  await clickWithoutMovingFocus(page, "Toggle module");
  await focusEditor(page);
  await page.keyboard.press("F8");
  await expect(page.getByLabel("root-count")).toHaveText("3");
});

test("capture shortcuts run before an editable target can swallow the event", async ({ page }) => {
  const editor = await focusEditor(page);
  await editor.evaluate(element => element.addEventListener("keydown", event => event.stopPropagation()));
  await page.keyboard.press("Control+b");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-pane-id="pane-b"]')).toBeFocused();
  await expect(editor).toHaveValue("abcdef");
});


test("binding updates replace the registered sequence", async ({ page }) => {
  const editor = await focusEditor(page);
  await clickWithoutMovingFocus(page, "Change root binding");
  await page.keyboard.press("F8");
  await expect(page.getByLabel("root-count")).toHaveText("0");
  await page.keyboard.press("F9");
  await expect(page.getByLabel("root-count")).toHaveText("1");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("abcdef");
});
