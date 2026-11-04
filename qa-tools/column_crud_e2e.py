"""End-to-end Playwright script exercising column CRUD on the canvas (TASK-008).

Flow:
  1. Add a table (modal) -> prerequisite to have a table on the canvas
  2. Add a column via the "+ Add column" button on the table node (AC1)
  3. Edit the column name inline and commit (AC2)
  4. Remove the column (AC3)
  5. Verify the table reflects every column change on the canvas (AC4)

The inline column editor closes when focus leaves the field (onBlur exits edit
mode), so each property is edited in its own edit session. This matches real
user behaviour. The unit tests (TableNode.test.tsx) already cover data-type,
nullable, PK and default-value edits in isolation; this script verifies the
live browser flow end to end.

Run:
  docker run --rm --network qa-TASK-008 --init --cap-drop ALL \
    --security-opt no-new-privileges --shm-size 1g --user "$(id -u):$(id -g)" \
    --tmpfs /tmp -e HOME=/tmp \
    -v "$(pwd)/qa-tools":/skill:ro \
    -v "$(pwd)/qa-artifacts/TASK-008":/artifacts \
    asg-visual-qa:1.49.1 \
    python /skill/column_crud_e2e.py "http://app-TASK-008:8080/"
"""
import re
import sys

from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/"
ARTIFACTS = "/artifacts"


def rx(text, flags=0):
    return re.compile(text, flags)


def shoot(page, name):
    path = f"{ARTIFACTS}/{name}.png"
    page.screenshot(path=path, full_page=True)
    print(f"[screenshot] {path}")


def main():
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        page.on("console", lambda m: errors.append(m.text()) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ---- Step 0: load the app ----
        page.goto(BASE_URL, wait_until="networkidle")
        assert page.get_by_text(rx("Empty diagram canvas", re.IGNORECASE)).is_visible(), \
            "empty canvas not shown"
        shoot(page, "00-empty-canvas")

        # ---- Step 1: Add a table (prerequisite) ----
        page.get_by_role("button", name="Add a new table to the canvas").click()
        dialog = page.get_by_role("dialog", name="Add table")
        assert dialog.is_visible(), "Add Table dialog not opened"

        page.get_by_label("Table name").fill("users")
        # No columns added in the modal; column CRUD happens on the canvas (TASK-008 scope)
        page.get_by_role("button", name="Create Table").click()

        table_region = page.get_by_role("region", name="Table users")
        assert table_region.is_visible(), "Table 'users' not rendered on canvas"
        assert page.get_by_text(rx("new_column")).count() == 0, "no columns should exist yet"
        shoot(page, "01-table-added")

        # ---- AC1: Add a column via "+ Add column" on the table node ----
        page.get_by_role("button", name="Add a new column to this table").click()
        assert page.get_by_text(rx("new_column: text")).is_visible(), \
            "new column not added on canvas"
        shoot(page, "02-column-added")

        # ---- AC2: Edit column properties inline (rename) ----
        page.get_by_text(rx("new_column: text")).dblclick()
        name_input = page.locator(".column-name-input")
        assert name_input.is_visible(), "column name input not visible"
        name_input.fill("email")
        page.keyboard.press("Enter")  # commits and exits edit mode

        assert page.get_by_text(rx("email: text")).is_visible(), \
            "edited column not reflected on canvas"
        assert page.get_by_text(rx("new_column: text")).count() == 0, \
            "old column text still present"
        shoot(page, "03-column-edited")

        # ---- AC3: Remove the column ----
        page.get_by_text(rx("email: text")).dblclick()
        assert page.locator(".column-name-input").is_visible(), "edit row did not open"
        shoot(page, "03b-edit-row-open")
        remove_btn = page.get_by_role("button", name="Remove column email")
        assert remove_btn.is_visible(), "Remove button not visible"
        remove_btn.click()
        shoot(page, "04-column-removed")
        assert not page.get_by_text(rx("email: text")).is_visible(), \
            "column still present after removal"
        assert not page.locator(".column-name-input").is_visible(), \
            "edit row still open after removal"
        shoot(page, "04-column-removed")

        # ---- AC4: Table still reflects changes (present, no stale column) ----
        assert table_region.is_visible(), "table disappeared after column removal"
        assert page.get_by_text(rx("new_column")).count() == 0, "stale column text remains"
        assert page.get_by_text(rx("email")).count() == 0, "stale edited column text remains"
        shoot(page, "05-final-state")

        # Assert no console errors
        assert not errors, f"console errors detected: {errors}"

        browser.close()

    print("ALL COLUMN CRUD INTERACTIONS VERIFIED")


if __name__ == "__main__":
    main()
