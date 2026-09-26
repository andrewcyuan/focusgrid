import { expect, test, type Page } from "@playwright/test";

async function command(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).evaluate((button: HTMLButtonElement) => button.click());
}

test.beforeEach(async ({ page }) => {
  await page.goto("/test/fixtures/recursive.html");
});

test("recursive split, swap, and collapse preserve editor identity, selection, and focus", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "outer-a", exact: true });
  await editor.fill("keep this text");
  await editor.focus();
  await editor.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(2, 5));
  const original = await editor.elementHandle();
  for (const name of ["Split a", "Swap a b", "Swap a b", "Remove c"]) {
    await command(page, name);
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue("keep this text");
    expect(await original!.evaluate(element => element.isConnected && document.activeElement === element)).toBe(true);
    expect(await editor.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([2, 5]);
  }
});

test("nested providers isolate native focus, shortcuts, and pointer resizing", async ({ page }) => {
  await page.getByRole("textbox", { name: "outer-a", exact: true }).focus();
  const editor = page.getByRole("textbox", { name: "inner-a", exact: true });
  await editor.focus();
  await editor.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(3, 3));
  await page.keyboard.press("Control+b");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('.inner-grid > [data-pane-id="b"]')).toBeFocused();
  await expect(page.getByLabel("inner-active")).toHaveText("b");
  await expect(page.getByLabel("outer-active")).toHaveText("a");
  await expect(editor).toHaveValue("nested");
  const outerPane = page.locator('.outer-grid > [data-pane-id="b"]');
  const innerPane = page.locator('.inner-grid > [data-pane-id="a"]');
  const outerWidth = (await outerPane.boundingBox())!.width;
  const innerWidth = (await innerPane.boundingBox())!.width;
  const handle = (await page.locator('.inner-grid > [role="separator"]').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 80);
  await page.mouse.down();
  await page.mouse.move(handle.x + 50, handle.y + 80);
  await page.mouse.up();
  await expect.poll(async () => (await innerPane.boundingBox())!.width).toBeGreaterThan(innerWidth + 40);
  expect((await outerPane.boundingBox())!.width).toBe(outerWidth);
  await expect(page.getByLabel("outer-active")).toHaveText("a");
});

test("mixed split orientations preserve ratios and enforce core resize minimums", async ({ page }) => {
  const pane = page.locator('.outer-grid > [data-pane-id="a"]');
  expect((await pane.boundingBox())!.width).toBe(239);
  await command(page, "Split a");
  const a = (await pane.boundingBox())!;
  const c = (await page.locator('.outer-grid > [data-pane-id="c"]').boundingBox())!;
  expect(a.width).toBe(c.width);
  expect(c.y).toBe(a.y + a.height + 3);
  const handle = (await page.locator('.outer-grid > [data-direction="vertical"]').boundingBox())!;
  await page.mouse.move(handle.x + 100, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 100, handle.y - 500);
  await page.mouse.up();
  await expect.poll(async () => (await pane.boundingBox())!.height).toBeGreaterThanOrEqual(59);
  expect((await pane.boundingBox())!.height).toBeLessThanOrEqual(60);
  expect((await pane.boundingBox())!.width).toBe(239);
});

test("core close notifications survive React batching and StrictMode without duplicates", async ({ page }) => {
  await command(page, "Create and close c");
  await expect(page.getByLabel("closed-count")).toHaveText("1");
  await expect(page.locator('.outer-grid > [data-pane-id="c"]')).toHaveCount(0);
});
