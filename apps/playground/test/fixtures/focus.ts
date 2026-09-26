import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { FocusGridController } from "@andrewcyuan/focusgrid/core";

const dom = new FocusGridDomController();
const root = document.getElementById("outer")!;
dom.setRoot(root);
const controller = new FocusGridController({
  root: { kind: "split", id: "split", orientation: "horizontal", sizes: [1, 1], children: [
    { kind: "pane", id: "node-a", paneId: "a" },
    { kind: "pane", id: "node-b", paneId: "b" },
  ] },
  activePaneId: "a", container: { width: 800, height: 300 },
}, dom);
controller.subscribe(next => {
  document.querySelector('[aria-label="active"]')!.textContent = next.activePaneId;
});
for (const id of ["a", "b", "inner-only", "inert"]) {
  document.getElementById(`focus-${id}`)!.addEventListener("click", () => report(dom.focus(id)));
}
document.getElementById("detach")!.addEventListener("click", () => dom.setRoot(null));
document.getElementById("adjacent")!.addEventListener("click", () => report(controller.focusAdjacent("right")));
function report(success: boolean) {
  document.querySelector('[aria-label="result"]')!.textContent = String(success);
}
