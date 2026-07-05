import type { SyntheticEvent } from "react";

const SCROLL_CONTAINER_SELECTOR = ".cc-wizard__scroll";
const DEFAULT_OFFSET_PX = 12;
/** Espera al reflow del `<details>` antes de un segundo ajuste. */
const REFLOW_DELAY_MS = 200;

function findScrollContainer(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element.parentElement;
  while (node) {
    if (node.matches(SCROLL_CONTAINER_SELECTOR)) return node;
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function scrollCuantoCobroSectionIntoView(
  element: HTMLElement,
  extraOffsetPx = DEFAULT_OFFSET_PX,
): void {
  const scrollContainer = findScrollContainer(element);
  if (!scrollContainer) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const nextTop =
    scrollContainer.scrollTop + (elementRect.top - containerRect.top) - extraOffsetPx;

  scrollContainer.scrollTo({
    top: Math.max(0, nextTop),
    behavior: "smooth",
  });
}

export function scheduleScrollCuantoCobroSectionIntoView(
  element: HTMLElement,
  extraOffsetPx = DEFAULT_OFFSET_PX,
): void {
  const scroll = () => scrollCuantoCobroSectionIntoView(element, extraOffsetPx);
  requestAnimationFrame(() => {
    requestAnimationFrame(scroll);
  });
  window.setTimeout(scroll, REFLOW_DELAY_MS);
}

export function handleCuantoCobroDetailsToggle(
  event: SyntheticEvent<HTMLDetailsElement>,
  onOpen?: () => void,
  onClose?: () => void,
): void {
  const element = event.currentTarget;
  if (element.open) {
    onOpen?.();
    scheduleScrollCuantoCobroSectionIntoView(element);
    return;
  }
  onClose?.();
}
