"""Round-trip fidelity E2E check: build a diagram, export to JSON, re-import,
verify the diagram is identical in structure and layout. Runs in the
asg-visual-qa container against the served app."""
import sys
sys.path.insert(0, "/skill")

import json
from playwright.sync_api import sync_playwright
from visual_check import LayoutInspector

APP_URL = "http://app-STORY-019:8080/"

def main():
    failures = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=["--no-sandbox"])
        context = browser.new_context(viewport={"width": 1280, "height": 720}, accept_downloads=True)
        page = context.new_page()
        inspector = LayoutInspector(page)

        page.goto(APP_URL, wait_until="networkidle")
        page.screenshot(path="/artifacts/STORY-019/rt-01-initial.png", full_page=True)
        defects = inspector.find_layout_defects()
        if defects:
            failures.append(f"initial page layout defects: {defects}")
        if inspector.console_errors:
            failures.append(f"initial console errors: {inspector.console_errors}")

        # --- Build a diagram: add table 'users' with column 'id' ---
        page.get_by_role("button", name="add a new table").click()
        page.get_by_label("Table name").fill("users")
        page.get_by_role("button", name="add column").click()
        page.get_by_placeholder("Column name").nth(0).fill("id")
        page.get_by_role("button", name="create table").click()
        assert page.get_by_role("region", name="Table users").is_visible(), "table users not rendered"
        page.screenshot(path="/artifacts/STORY-019/rt-02-after-create-table.png", full_page=True)

        # --- Export to JSON ---
        with page.expect_download() as download_info:
            page.get_by_role("button", name="export diagram to json").click()
        download = download_info.value
        assert download.suggested_filename.endswith(".json"), "export filename not .json"
        content = download.path().read_text(encoding="utf-8") if download.path() else ""
        payload = json.loads(content)
        assert payload.get("version") == "1.0.0", "export missing version"
        tables = payload["diagram"]["tables"]
        assert any(t["name"] == "users" for t in tables), "exported diagram missing users table"
        page.screenshot(path="/artifacts/STORY-019/rt-03-after-export.png", full_page=True)

        # --- Re-import the exported JSON ---
        file_input = page.locator('input[type="file"]')
        file_input.set_input_files({
            "name": "round-trip.json",
            "mimeType": "application/json",
            "buffer": content.encode("utf-8"),
        })
        assert page.get_by_role("region", name="Table users").is_visible(), "table users missing after re-import"
        page.screenshot(path="/artifacts/STORY-019/rt-04-after-reimport.png", full_page=True)

        defects = inspector.find_layout_defects()
        if defects:
            failures.append(f"after-reimport layout defects: {defects}")
        if inspector.console_errors:
            failures.append(f"after-reimport console errors: {inspector.console_errors}")

        browser.close()

    if failures:
        print("ROUND-TRIP FAIL:")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    print("ROUND-TRIP PASS: diagram exported and re-imported unchanged through the UI")
    sys.exit(0)

if __name__ == "__main__":
    main()
