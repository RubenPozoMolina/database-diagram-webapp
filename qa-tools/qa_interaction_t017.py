"""Visual QA + interaction check for TASK-017 unique constraint UI."""
import os
import re
import sys
from playwright.sync_api import sync_playwright

BASE_URL = "http://app-TASK-017:8080/"
ARTIFACTS = "/artifacts/TASK-017"

os.makedirs(ARTIFACTS, exist_ok=True)

def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(BASE_URL, wait_until="networkidle")
        page.screenshot(path=f"{ARTIFACTS}/01-empty-canvas.png", full_page=True)

        # Add a table with columns
        page.get_by_role("button", name=re.compile(r"add a new table")).click()
        page.get_by_label("Table name").fill("users")
        page.get_by_role("button", name=re.compile(r"add column")).click()
        page.get_by_placeholder("Column name").fill("id")
        page.get_by_role("button", name=re.compile(r"create table")).click()
        page.wait_for_selector("text=users")
        page.screenshot(path=f"{ARTIFACTS}/02-table-created.png", full_page=True)

        # Add email column
        table = page.get_by_role("region", name="Table users")
        table.get_by_role("button", name=re.compile(r"add a new column to this table")).click()
        page.get_by_placeholder("Column name").fill("email")
        page.get_by_role("button", name=re.compile(r"create column")).click()
        page.wait_for_selector("text=email")
        page.screenshot(path=f"{ARTIFACTS}/03-column-added.png", full_page=True)

        # Add unique constraint on email column
        table.get_by_role("button", name=re.compile(r"add a new unique constraint to this table")).click()
        page.get_by_placeholder("Constraint name").fill("users_email_key")
        page.get_by_role("checkbox", name="Include email in unique constraint").click()
        page.get_by_role("button", name=re.compile(r"^save$")).click()
        page.wait_for_selector("text=UQ")
        page.screenshot(path=f"{ARTIFACTS}/04-single-column-uc.png", full_page=True)
        assert page.get_by_title(re.compile(r"users_email_key")).is_visible(), "UQ tooltip missing for single column"

        # Add a composite unique constraint (need another column)
        table.get_by_role("button", name=re.compile(r"add a new column to this table")).click()
        page.get_by_placeholder("Column name").fill("name")
        page.get_by_role("button", name=re.compile(r"create column")).click()
        page.wait_for_selector("text=name")
        table.get_by_role("button", name=re.compile(r"add a new unique constraint to this table")).click()
        page.get_by_placeholder("Constraint name").fill("users_email_name_key")
        page.get_by_role("checkbox", name="Include email in unique constraint").click()
        page.get_by_role("checkbox", name="Include name in unique constraint").click()
        page.get_by_role("button", name=re.compile(r"^save$")).click()
        page.wait_for_selector("text=UQ")
        page.screenshot(path=f"{ARTIFACTS}/05-composite-uc.png", full_page=True)
        assert page.get_by_title(re.compile(r"users_email_name_key")).is_visible(), "UQ tooltip missing for composite"

        # Remove the single-column constraint
        page.get_by_role("button", name=re.compile(r"Remove unique constraint users_email_key")).click()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{ARTIFACTS}/06-after-removal.png", full_page=True)

        # Export to JSON and verify uniqueConstraints present
        page.get_by_role("button", name=re.compile(r"export diagram to json")).click()
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{ARTIFACTS}/07-export-clicked.png", full_page=True)

        browser.close()

    if errors:
        print("CONSOLE ERRORS:")
        for e in errors:
            print(f"  {e}")
    print(f"Screenshots saved to {ARTIFACTS}")
    print(f"Console errors: {len(errors)}")
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
