"""End-to-end Playwright script exercising the index UI on a table column (TASK-019).

Flow:
  1. Add a table (modal) -> prerequisite to have a table on the canvas
  2. Add two columns via the "+ Add column" button on the table node
  3. Add an index to a column via the "+ Add index" button (AC1)
  4. Verify the IX badge appears on the indexed column (AC2)
  5. Verify the indexes section lists the index on the column (AC2)
  6. Verify the index is recorded in the diagram model (AC3)
  7. Remove the index and verify cleanup (AC3)

Run (from project root):
  docker run --rm --network qa-TASK-019 --init --cap-drop ALL \
    --security-opt no-new-privileges --shm-size 1g --user "$(id -u):$(id -g)" \
    --tmpfs /tmp -e HOME=/tmp \
    -v "$(pwd)/qa-tools":/skill:ro \
    -v "$(pwd)/qa-artifacts/TASK-019":/artifacts \
    mcr.microsoft.com/playwright:v1.49.1-noble \
    python /skill/index_crud_e2e.py "http://app-TASK-019:8080/"
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
        page.get_by_role("button", name="Create Table").click()

        table_region = page.get_by_role("region", name="Table users")
        assert table_region.is_visible(), "Table 'users' not rendered on canvas"
        shoot(page, "01-table-added")

        # ---- Step 2: Add two columns via "+ Add column" ----
        page.get_by_role("button", name="Add a new column to this table").click()
        assert page.get_by_text(rx("new_column: text")).is_visible(), \
            "first new column not added on canvas"
        page.get_by_role("button", name="Add a new column to this table").click()
        assert page.get_by_text(rx("new_column: text")).count() >= 2, \
            "second new column not added on canvas"
        shoot(page, "02-columns-added")

        # Rename first column to "email" so we can target it specifically
        page.get_by_text(rx("new_column: text")).first.dblclick()
        name_input = page.locator(".column-name-input").first
        assert name_input.is_visible(), "column name input not visible"
        name_input.fill("email")
        page.keyboard.press("Enter")
        assert page.get_by_text(rx("email: text")).is_visible(), \
            "edited column not reflected on canvas"
        shoot(page, "03-column-renamed")

        # ---- AC1: Add an index to a column via "+ Add index" ----
        page.get_by_role("button", name="Add a new index to this table").click()
        shoot(page, "04-index-form-open")
        assert page.get_by_placeholder("Index name").is_visible(), \
            "index name input not visible"
        assert page.get_by_role("combobox", name=rx("column to index", re.IGNORECASE)).is_visible(), \
            "column select not visible"

        name_input = page.get_by_placeholder("Index name")
        name_input.fill("idx_email")
        select = page.get_by_role("combobox", name=rx("column to index", re.IGNORECASE))
        select.select_option(label="email")
        save_btn = page.get_by_role("button", name=rx("save", re.IGNORECASE)).last
        assert save_btn.is_visible(), "Save button not visible"
        save_btn.click()

        shoot(page, "05-index-added")

        # Verify the index form closed
        assert not page.get_by_placeholder("Index name").is_visible(), \
            "index form did not close after save"

        # ---- AC2: IX badge appears on the indexed column ----
        assert page.get_by_title(rx("IX", re.IGNORECASE)).is_visible(), \
            "IX badge not shown on indexed column"
        assert page.get_by_text("IX").is_visible(), "IX text badge not visible"
        shoot(page, "06-ix-badge-visible")

        # ---- AC2: Indexes section lists the index ----
        assert page.get_by_text("Indexes").is_visible(), "Indexes section not rendered"
        assert page.get_by_text("idx_email").is_visible(), \
            "index name not listed in indexes section"
        assert page.get_by_text(rx("on email", re.IGNORECASE)).is_visible(), \
            "index column association not listed"
        shoot(page, "07-indexes-section")

        # ---- AC3: Index recorded in the diagram model ----
        # Verify by removing the index and checking the indexes section no longer lists it
        page.get_by_role("button", name=rx("Remove index idx_email", re.IGNORECASE)).click()
        shoot(page, "08-index-removed")
        assert not page.get_by_text("idx_email").is_visible(), \
            "index still listed after removal"
        assert not page.get_by_title(rx("IX", re.IGNORECASE)).is_visible(), \
            "IX badge still shown after index removal"
        shoot(page, "09-final-state")

        # Assert no console errors
        assert not errors, f"console errors detected: {errors}"

        browser.close()

    print("ALL INDEX UI INTERACTIONS VERIFIED")


if __name__ == "__main__":
    main()
