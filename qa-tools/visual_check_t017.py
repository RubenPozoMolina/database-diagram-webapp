"""Visual QA check for TASK-017 unique constraint UI."""
import json
import sys
from playwright.sync_api import sync_playwright

FIND_LAYOUT_DEFECTS_SCRIPT = r"""
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
      ? '.' + element.className.trim().split(/\s+/).join('.') : '';
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
      const needed = (() => {
        const context = document.createElement('canvas').getContext('2d');
        context.font = getComputedStyle(element).font;
        return context.measureText(element.selectedOptions[0].text).width;
      })() + parseFloat(getComputedStyle(element).paddingLeft) + parseFloat(getComputedStyle(element).paddingRight) + arrowWidth;
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

def main():
    url = "http://app-TASK-017:8080/"
    output = "/artifacts/TASK-017"
    import os
    os.makedirs(output, exist_ok=True)
    viewports = [("1280", "720"), ("1920", "1080"), ("768", "1024")]
    all_defects = 0
    console_errors_total = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        for w, h in viewports:
            page = browser.new_page(viewport={"width": int(w), "height": int(h)})
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(url, wait_until="networkidle", timeout=30000)
            screenshot = f"{output}/screenshot-{w}x{h}.png"
            page.screenshot(path=screenshot, full_page=True)
            defects = page.evaluate(FIND_LAYOUT_DEFECTS_SCRIPT)
            result = {
                "viewport": f"{w}x{h}",
                "screenshot": screenshot,
                "layoutDefects": defects,
                "consoleErrors": errors,
            }
            n = len(defects) + len(errors)
            all_defects += n
            console_errors_total += len(errors)
            print(f"{w}x{h}: {len(defects)} layout defects, {len(errors)} console errors")
            for d in defects:
                print(f"  DEFECT: {json.dumps(d)}")
            for e in errors:
                print(f"  CONSOLE ERROR: {e}")
            page.close()
        browser.close()
    report = {"url": url, "viewports": []}
    with open(f"{output}/visual-report.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"TOTAL: {all_defects} problems ({console_errors_total} console errors)")
    sys.exit(1 if all_defects else 0)

if __name__ == "__main__":
    main()
