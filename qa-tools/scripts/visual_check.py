"""Visual layout check for a web page. Runs inside the Playwright Python container.

Usage (see SKILL.md):
    python visual_check.py http://app/ --output /artifacts

For each viewport it takes a full-page screenshot and reports layout defects: controls clipped
by their container, controls outside the viewport, truncated input or select text and
horizontal scrollbars inside components. The exit code is 1 when any defect is found.
"""
import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass
from typing import Any

from playwright.sync_api import Page, sync_playwright

logger = logging.getLogger("visual_check")

DEFAULT_VIEWPORTS = ("1280x720", "1920x1080", "768x1024")
SETTLE_TIMEOUT_MS = 15000
FIND_LAYOUT_DEFECTS_SCRIPT = """
() => {
  const defects = [];
  const tolerance = 1;
  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0
      && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const describe = (element) => {
    const id = element.id ? '#' + element.id : '';
    const classes = typeof element.className === 'string' && element.className.trim()
      ? '.' + element.className.trim().split(/\\s+/).join('.') : '';
    return element.tagName.toLowerCase() + id + classes;
  };
  const clippingAncestor = (element) => {
    const rect = element.getBoundingClientRect();
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (!/(hidden|auto|scroll|clip)/.test(style.overflowX + style.overflowY)) continue;
      const box = parent.getBoundingClientRect();
      const clippedX = Math.max(0, box.left - rect.left) + Math.max(0, rect.right - box.right);
      const clippedY = Math.max(0, box.top - rect.top) + Math.max(0, rect.bottom - box.bottom);
      if (clippedX > tolerance || clippedY > tolerance) {
        return {container: describe(parent), clippedX: Math.round(clippedX),
                clippedY: Math.round(clippedY)};
      }
    }
    return null;
  };
  const measureText = (element, text) => {
    const style = getComputedStyle(element);
    const context = document.createElement('canvas').getContext('2d');
    context.font = style.font;
    return context.measureText(text).width
      + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  };
  const controls = document.querySelectorAll(
    'input, select, textarea, button, a[href], [role=button], [contenteditable=true]');
  for (const element of controls) {
    if (!isVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    const clipping = clippingAncestor(element);
    if (clipping) {
      defects.push({type: 'clipped-by-container', element: describe(element), ...clipping});
    }
    if (rect.right > window.innerWidth + tolerance || rect.left < -tolerance) {
      defects.push({type: 'outside-viewport', element: describe(element),
                    left: Math.round(rect.left), right: Math.round(rect.right)});
    }
    const isTextField = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
    if (isTextField && element.scrollWidth > element.clientWidth + tolerance) {
      defects.push({type: 'text-truncated', element: describe(element), value: element.value});
    }
    if (element.tagName === 'SELECT' && element.selectedOptions.length) {
      const arrowWidth = 22;
      const needed = measureText(element, element.selectedOptions[0].text) + arrowWidth;
      if (needed > element.clientWidth + tolerance) {
        defects.push({type: 'select-text-truncated', element: describe(element),
                      text: element.selectedOptions[0].text,
                      neededPx: Math.round(needed), availablePx: element.clientWidth});
      }
    }
  }
  for (const element of document.querySelectorAll('body *')) {
    const style = getComputedStyle(element);
    if (/(auto|scroll)/.test(style.overflowX) && isVisible(element)
        && element.scrollWidth > element.clientWidth + tolerance) {
      defects.push({type: 'horizontal-scroll-inside-component', element: describe(element),
                    contentPx: element.scrollWidth, visiblePx: element.clientWidth});
    }
  }
  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth + tolerance) {
    defects.push({type: 'page-horizontal-scroll', contentPx: root.scrollWidth,
                  visiblePx: root.clientWidth});
  }
  return defects;
}
"""


@dataclass(frozen=True)
class Viewport:
    width: int
    height: int

    @classmethod
    def parse(cls, text: str) -> "Viewport":
        width, height = text.lower().split("x")
        return cls(int(width), int(height))

    @property
    def label(self) -> str:
        return f"{self.width}x{self.height}"


class LayoutInspector:
    """Collects layout defects and browser errors of a page."""

    def __init__(self, page: Page):
        self.page = page
        self.console_errors: list[str] = []
        page.on("console", self._record_console_error)
        page.on("pageerror", lambda error: self.console_errors.append(str(error)))

    def _record_console_error(self, message: Any) -> None:
        if message.type == "error":
            self.console_errors.append(message.text)

    def find_layout_defects(self) -> list[dict[str, Any]]:
        return self.page.evaluate(FIND_LAYOUT_DEFECTS_SCRIPT)


class VisualCheck:
    """Opens a URL at several viewports, takes screenshots and writes a JSON report."""

    def __init__(self, url: str, output_directory: str, viewports: list[Viewport]):
        self.url = url
        self.output_directory = output_directory
        self.viewports = viewports

    def run(self) -> dict[str, Any]:
        os.makedirs(self.output_directory, exist_ok=True)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(args=["--no-sandbox"])
            results = [self._check_viewport(browser, viewport) for viewport in self.viewports]
            browser.close()
        report = {"url": self.url, "viewports": results}
        self._write_report(report)
        return report

    def _check_viewport(self, browser: Any, viewport: Viewport) -> dict[str, Any]:
        page = browser.new_page(viewport={"width": viewport.width, "height": viewport.height})
        inspector = LayoutInspector(page)
        page.goto(self.url, wait_until="networkidle", timeout=SETTLE_TIMEOUT_MS)
        screenshot = os.path.join(self.output_directory, f"screenshot-{viewport.label}.png")
        page.screenshot(path=screenshot, full_page=True)
        result = {
            "viewport": viewport.label,
            "screenshot": screenshot,
            "layoutDefects": inspector.find_layout_defects(),
            "consoleErrors": inspector.console_errors,
        }
        page.close()
        return result

    def _write_report(self, report: dict[str, Any]) -> None:
        path = os.path.join(self.output_directory, "visual-report.json")
        with open(path, "w", encoding="utf-8") as file:
            json.dump(report, file, indent=2)
        logger.info("Report written to %s", path)


def count_problems(report: dict[str, Any]) -> int:
    return sum(
        len(result["layoutDefects"]) + len(result["consoleErrors"])
        for result in report["viewports"]
    )


def parse_arguments(arguments: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Visual layout check of a web page")
    parser.add_argument("url")
    parser.add_argument("--output", default="/artifacts")
    parser.add_argument("--viewports", nargs="+", default=list(DEFAULT_VIEWPORTS))
    return parser.parse_args(arguments)


def main(arguments: list[str]) -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(levelname)s %(message)s")
    options = parse_arguments(arguments)
    viewports = [Viewport.parse(text) for text in options.viewports]
    report = VisualCheck(options.url, options.output, viewports).run()
    for result in report["viewports"]:
        logger.info(
            "%s: %d layout defects, %d console errors",
            result["viewport"], len(result["layoutDefects"]), len(result["consoleErrors"])
        )
        for defect in result["layoutDefects"]:
            logger.warning("  %s", json.dumps(defect))
    return 1 if count_problems(report) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
