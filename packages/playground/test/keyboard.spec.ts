import { expect, test, type Locator } from "@playwright/test";

test("the demo hub links every public route", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Demos" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tmux playground/ })).toHaveAttribute("href", "/tmux");
  await expect(page.getByRole("link", { name: /Ariakit composite/ })).toHaveAttribute("href", "/ariakit");
  await expect(page.getByRole("link", { name: /Email workspace/ })).toHaveAttribute("href", "/email");
  const githubLink = page.getByRole("link", { name: "View on GitHub" });
  await expect(githubLink).toHaveAttribute(
    "href",
    "https://github.com/andrewcyuan/focusgrid",
  );
  await expect(githubLink.locator("svg")).toHaveCount(1);

  const pathOffsets = await page.locator(".DemoListRow > span").evaluateAll((paths) =>
    paths.map((path) => Math.round(path.getBoundingClientRect().left)),
  );
  expect(new Set(pathOffsets).size).toBe(1);

  const firstDemo = page.getByRole("link", { name: /Tmux playground/ });
  const restingBackground = await firstDemo.evaluate(
    (link) => getComputedStyle(link).backgroundColor,
  );

  await page.keyboard.press("Tab");
  await expect(githubLink).toBeFocused();
  await expect(githubLink).toHaveCSS("outline-style", "none");
  await expect(githubLink).toHaveCSS("filter", "contrast(0.8)");

  await page.keyboard.press("Tab");
  await expect(firstDemo).toBeFocused();
  await expect(firstDemo).toHaveCSS("outline-style", "none");
  expect(
    await firstDemo.evaluate((link) => getComputedStyle(link).backgroundColor),
  ).not.toBe(restingBackground);
});

test("all direct demo routes load and tmux omits the active-pane label", async ({ page }) => {
  await page.goto("/tmux");
  await expect(page.locator(".TextPane")).toHaveCount(2);
  await expect(page.getByText(/^Active:/)).toHaveCount(0);

  await page.goto("/ariakit");
  await expect(page.getByRole("heading", { name: "Ariakit composite" })).toBeVisible();

  await page.goto("/email");
  await expect(page.getByRole("heading", { name: "Email workspace" })).toBeVisible();
});

async function setTextareaSelection(
  textarea: Locator,
  selectionStart: number,
  selectionEnd: number
) {
  await textarea.evaluate(
    (element, selection) => {
      const textAreaElement = element as HTMLTextAreaElement;
      textAreaElement.setSelectionRange(selection.start, selection.end);
    },
    { start: selectionStart, end: selectionEnd }
  );
}

test("pane shortcuts are handled before focused textareas edit text", async ({
  page,
}) => {
  await page.goto("/tmux");

  const alphaText = page.locator('[data-pane-id="alpha"] textarea');
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(page.locator(".TextPane")).toHaveCount(3);
});

test("clicking non-focusable pane content focuses the pane shell for shortcuts", async ({
  page,
}) => {
  await page.goto("/tmux");

  const alphaPane = page.locator('[data-pane-id="alpha"]');
  const alphaText = alphaPane.locator("textarea");
  await expect(alphaText).toBeFocused();

  await alphaPane.locator(".TextPaneHeader").click();

  await expect(alphaPane).toBeFocused();

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(page.locator(".TextPane")).toHaveCount(3);
});

test("pane shortcuts stay scoped to the focused FocusGrid subtree", async ({
  page,
}) => {
  await page.goto("/tmux");

  const splitRightShortcut = page.getByLabel("Split right");
  await splitRightShortcut.focus();
  await expect(splitRightShortcut).toBeFocused();

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(page.locator(".TextPane")).toHaveCount(2);
  await expect(splitRightShortcut).toBeFocused();
});

test("directional swap shortcuts move the active pane from a focused textarea", async ({
  page,
}) => {
  await page.goto("/tmux");

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
  await expect
    .poll(async () => {
      const alphaBox = await alphaPane.boundingBox();
      const betaBox = await betaPane.boundingBox();
      return (alphaBox?.x ?? 0) > (betaBox?.x ?? 0);
    })
    .toBe(true);
});

test("invalid shortcut continuations are no-opped instead of typed", async ({
  page,
}) => {
  await page.goto("/tmux");

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

test("saved plus-style shortcuts are migrated before parsing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "focusgrid.playground.shortcuts",
      JSON.stringify({
        "split-right": "Ctrl+B %",
      })
    );
  });

  await page.goto("/tmux");

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
  await page.goto("/tmux");

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
  await expect
    .poll(async () => {
      const box = await alphaPane.boundingBox();
      return box?.width ?? 0;
    })
    .toBeGreaterThan(initialBox!.width);

  const postGrowthWidth = (await alphaPane.boundingBox())?.width ?? 0;

  await page.keyboard.press("H");
  await page.keyboard.press("H");

  await expect(alphaText).toHaveValue("abcdef");
  await expect
    .poll(async () => {
      const box = await alphaPane.boundingBox();
      return box?.width ?? 0;
    })
    .toBeLessThan(postGrowthWidth);
});

test("horizontal pointer resize continues after dragging outside the handle", async ({
  page,
}) => {
  await page.goto("/tmux");

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

test("Ariakit composite loads focused inside a Focusgrid pane", async ({
  page,
}) => {
  await page.goto("/ariakit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');

  await expect(page.locator(".AriakitPane")).toHaveCount(2);
  await expect(leftPane).toHaveAttribute(
    "data-active",
    "true",
  );
  const firstRow = leftPane.locator('[data-row-id="alpha"]');
  await expect(firstRow).toBeFocused();
  await expect(firstRow).toHaveCSS("outline-style", "none");
  await expect(
    page.getByRole("link", { name: "All demos" }),
  ).toBeVisible();
});

test("Ariakit arrow keys and adapter shortcuts move DOM focus", async ({
  page,
}) => {
  await page.goto("/ariakit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const alpha = leftPane.locator('[data-row-id="alpha"]');
  const beta = leftPane.locator('[data-row-id="beta"]');
  const gamma = leftPane.locator('[data-row-id="gamma"]');
  const delta = leftPane.locator('[data-row-id="delta"]');

  await expect(alpha).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(beta).toBeFocused();
  await page.keyboard.press("J");
  await expect(gamma).toBeFocused();
  await page.keyboard.press("K");
  await expect(beta).toBeFocused();
  await page.keyboard.press("L");
  await expect(gamma).toBeFocused();
  await page.keyboard.press("H");
  await expect(beta).toBeFocused();
  await page.keyboard.press("Shift+G");
  await expect(delta).toBeFocused();
  await page.keyboard.press("G");
  await page.keyboard.press("G");
  await expect(alpha).toBeFocused();
});

test("Ariakit adapter actions use the active row and prevent default", async ({
  page,
}) => {
  await page.goto("/ariakit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');

  await expect(leftPane.locator('[data-row-id="alpha"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(leftPane.locator('[data-row-id="beta"]')).toBeFocused();
  await page.keyboard.press("Space");

  const status = leftPane.locator(".AriakitActionStatus");
  await expect(status).toHaveText("Space on Beta");
  await expect(status).toHaveAttribute("data-default-prevented", "true");
  await expect(leftPane.locator('[data-row-id="beta"]')).toBeFocused();
});

test("Ariakit adapter ignores typing in the embedded input", async ({ page }) => {
  await page.goto("/ariakit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const input = leftPane.getByRole("textbox", { name: "Editable input" });
  await input.focus();
  await page.keyboard.type("j k g g ");

  await expect(input).toHaveValue("j k g g ");
  await expect(input).toBeFocused();
  await expect(leftPane.locator(".AriakitActionStatus")).toHaveText(
    "No row action yet",
  );
});

test("Focusgrid pane shortcuts transfer focus between Ariakit composites", async ({
  page,
}) => {
  await page.goto("/ariakit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const rightPane = page.locator('[data-pane-id="ariakit-beta"]');
  const leftBeta = leftPane.locator('[data-row-id="beta"]');
  const rightAlpha = rightPane.locator('[data-row-id="alpha"]');
  const rightBeta = rightPane.locator('[data-row-id="beta"]');

  await expect(leftPane.locator('[data-row-id="alpha"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(leftBeta).toBeFocused();

  await page.keyboard.press("Control+L");

  await expect(rightPane).toHaveAttribute("data-active", "true");
  await expect(rightAlpha).toBeFocused();
  await expect(leftBeta).toHaveAttribute("data-active-item", "true");
  await page.keyboard.press("ArrowDown");
  await expect(rightBeta).toBeFocused();

  await page.keyboard.press("Control+H");

  await expect(leftPane).toHaveAttribute("data-active", "true");
  await expect(leftBeta).toBeFocused();

  await page.keyboard.press("Control+L");
  await expect(rightBeta).toBeFocused();
});

test("static Ariakit header clicks restore the active pane", async ({ page }) => {
  await page.goto("/ariakit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const beta = leftPane.locator('[data-row-id="beta"]');
  await expect(leftPane.locator('[data-row-id="alpha"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(beta).toBeFocused();

  await page.locator(".DemoHeader h1").click();
  await expect(beta).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(leftPane.locator('[data-row-id="gamma"]')).toBeFocused();
});

test("window reactivation restores unowned Ariakit focus", async ({
  page,
  context,
}) => {
  await page.goto("/ariakit");
  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const beta = leftPane.locator('[data-row-id="beta"]');
  await expect(leftPane.locator('[data-row-id="alpha"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(beta).toBeFocused();
  await beta.evaluate((element) => element.blur());

  const otherPage = await context.newPage();
  await otherPage.goto("about:blank");
  await otherPage.bringToFront();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new FocusEvent("focus")));

  await expect(beta).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(leftPane.locator('[data-row-id="gamma"]')).toBeFocused();
  await otherPage.close();
});

test("window reactivation preserves interactive Ariakit header controls", async ({
  page,
  context,
}) => {
  await page.goto("/ariakit");
  const toolbarLink = page.getByRole("link", { name: "All demos" });
  await toolbarLink.focus();

  const otherPage = await context.newPage();
  await otherPage.goto("about:blank");
  await otherPage.bringToFront();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new FocusEvent("focus")));

  await expect(toolbarLink).toBeFocused();
  await otherPage.close();
});

test("email starts on the first inbox thread and collections use arrows and H/J/K/L", async ({ page }) => {
  await page.goto("/email");

  const inbox = page.locator('[data-pane-id="email-inbox"]');
  const fieldNotes = inbox.locator('[data-thread-id="field-notes"]');
  const reviewWindow = inbox.locator('[data-thread-id="review-window"]');

  await expect(fieldNotes).toBeFocused();
  await expect(fieldNotes).toHaveCSS("outline-style", "none");
  await page.keyboard.press("ArrowDown");
  await expect(reviewWindow).toBeFocused();
  await page.keyboard.press("K");
  await expect(fieldNotes).toBeFocused();
  await page.keyboard.press("L");
  await expect(reviewWindow).toBeFocused();
  await page.keyboard.press("H");
  await expect(fieldNotes).toBeFocused();
  await page.keyboard.press("J");
  await expect(reviewWindow).toBeFocused();
});

test("email Ctrl+H/J/K/L changes panes without moving collection rows", async ({ page }) => {
  await page.goto("/email");

  const sidebar = page.locator('[data-pane-id="email-sidebar"]');
  const inbox = page.locator('[data-pane-id="email-inbox"]');
  const fieldNotes = inbox.locator('[data-thread-id="field-notes"]');
  const reviewWindow = inbox.locator('[data-thread-id="review-window"]');

  await expect(fieldNotes).toBeFocused();
  await page.keyboard.press("J");
  await expect(reviewWindow).toBeFocused();
  await page.keyboard.press("Control+H");
  await expect(sidebar.locator('[data-mailbox-id="inbox"]')).toBeFocused();
  await page.keyboard.press("Control+L");
  await expect(reviewWindow).toBeFocused();
  await expect(fieldNotes).not.toBeFocused();

  await page.keyboard.press("Control+J");
  await expect(reviewWindow).toBeFocused();
  await page.keyboard.press("Control+K");
  await expect(reviewWindow).toBeFocused();
});

test("email Enter opens the active thread and Back restores its row", async ({ page }) => {
  await page.goto("/email");

  await expect(page.locator('[data-thread-id="field-notes"]')).toBeFocused();
  const reviewWindow = page.locator('[data-thread-id="review-window"]');
  await page.keyboard.press("J");
  await expect(reviewWindow).toBeFocused();
  await page.keyboard.press("Enter");

  const reader = page.locator('[data-pane-id="email-reader"]');
  await expect(reader).toBeVisible();
  await expect(reader.getByRole("heading", { name: "A review window for Thursday" })).toBeVisible();
  const back = reader.getByRole("button", { name: "Back" });
  await expect(back).toBeFocused();
  await back.click();

  await expect(reader).toHaveCount(0);
  await expect(reviewWindow).toBeFocused();
});

test("email clicks open the chosen message", async ({ page }) => {
  await page.goto("/email");

  await page.locator('[data-thread-id="studio-keys"]').click();
  const reader = page.locator('[data-pane-id="email-reader"]');
  await expect(reader.getByRole("heading", { name: "Keys from the old studio" })).toBeVisible();
  await expect(reader.getByRole("button", { name: "Back" })).toBeFocused();
});

test("email mailbox selection resets rows and focus deterministically", async ({ page }) => {
  await page.goto("/email");

  await page.keyboard.press("Control+H");
  const sidebar = page.locator('[data-pane-id="email-sidebar"]');
  await page.keyboard.press("J");
  await expect(sidebar.locator('[data-mailbox-id="starred"]')).toBeFocused();
  await page.keyboard.press("Enter");

  const inbox = page.locator('[data-pane-id="email-inbox"]');
  await expect(inbox.locator(".ThreadRow")).toHaveCount(2);
  await expect(inbox.locator('[data-thread-id="release-checklist"]')).toBeFocused();
  await expect(inbox.locator('[data-thread-id="field-notes"]')).toHaveCount(0);
});

test("public surfaces do not scroll horizontally at target widths", async ({ page }) => {
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 800 });

    for (const path of ["/", "/tmux", "/ariakit", "/email"]) {
      await page.goto(path);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});
