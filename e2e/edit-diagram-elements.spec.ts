import { test, expect, type Page, type Locator } from '@playwright/test';

test.describe('Edit diagram elements (STORY-008)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  async function addTable(page: Page, name: string, columns: string[]) {
    await page.getByRole('button', { name: /add a new table/i }).click();
    await page.getByLabel('Table name').fill(name);
    for (const colName of columns) {
      await page.getByRole('button', { name: /add column/i }).click();
      const inputs = page.getByPlaceholder('Column name');
      await inputs.last().fill(colName);
    }
    await page.getByRole('button', { name: /create table/i }).click();
    await expect(page.getByRole('region', { name: `Table ${name}` })).toBeVisible();
  }

  async function addRelationship(
    page: Page,
    sourceTable: string,
    sourceColumn: string,
    targetTable: string,
    targetColumn: string,
  ) {
    await page.getByRole('button', { name: /add a relationship/i }).click();
    await expect(page.getByRole('dialog', { name: /add relationship/i })).toBeVisible();
    await page.selectOption('#source-table-select', { label: sourceTable });
    await page.selectOption('#source-column-select', { label: sourceColumn });
    await page.selectOption('#target-table-select', { label: targetTable });
    await page.selectOption('#target-column-select', { label: targetColumn });
    await page.getByRole('button', { name: /create relationship/i }).click();
    await expect(page.getByRole('dialog', { name: /add relationship/i })).not.toBeVisible();
  }

  /* React's TableNode / RelationshipLine listen for native pointer events
   * (onPointerDown on the header / resize handle, window pointermove/up).
   * Playwright's page.mouse dispatches mouse events, so we drive the drag
   * with pointer events dispatched directly on the elements, which bubble
   * up to the window listeners used by the drag/resize handlers.
   */
  async function dragByPointer(
    page: Page,
    locator: Locator,
    dx: number,
    dy: number,
    steps = 8,
  ) {
    const el = locator.first();
    const box = await el.boundingBox();
    expect(box).toBeTruthy();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    const pointerId = 9;

    await el.dispatchEvent('pointerdown', {
      button: 0,
      buttons: 1,
      detail: 1,
      clientX: startX,
      clientY: startY,
      pointerId,
      pointerType: 'mouse',
      bubbles: true,
      cancelable: true,
    });

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await page.locator('body').dispatchEvent('pointermove', {
        button: 0,
        buttons: 1,
        detail: 1,
        clientX: startX + dx * t,
        clientY: startY + dy * t,
        pointerId,
        pointerType: 'mouse',
        bubbles: true,
        cancelable: true,
      });
      await page.waitForTimeout(8);
    }

    await page.locator('body').dispatchEvent('pointerup', {
      button: 0,
      buttons: 0,
      detail: 1,
      pointerId,
      pointerType: 'mouse',
      bubbles: true,
      cancelable: true,
    });
  }

  test('moves a table by dragging its header; the canvas and model reflect the new position', async ({
    page,
  }) => {
    await addTable(page, 'users', ['id']);

    const table = page.getByRole('region', { name: 'Table users' });
    const header = table.locator('.table-header');

    // Every control is fully visible on the canvas.
    await expect(header).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete table users' })).toBeVisible();
    await expect(page.locator('.resize-handle')).toBeVisible();

    const before = await table.boundingBox();
    expect(before).toBeTruthy();

    // Drag the table down-right by grabbing its header.
    await dragByPointer(page, header, 160, 110);

    await page.waitForTimeout(300);
    const after = await table.boundingBox();
    expect(after).toBeTruthy();
    expect(after!.x).toBeGreaterThan(before!.x);
    expect(after!.y).toBeGreaterThan(before!.y);

    await page.screenshot({
      path: '/artifacts/story-008-move-table.png',
      fullPage: true,
    });
  });

  test('resizes a table by dragging the bottom-right resize handle; the canvas and model reflect the new size', async ({
    page,
  }) => {
    await addTable(page, 'users', ['id']);

    const table = page.getByRole('region', { name: 'Table users' });
    const resizeHandle = page.locator('.resize-handle').first();

    await expect(resizeHandle).toBeVisible();

    const before = await table.boundingBox();
    expect(before).toBeTruthy();

    // Grow the table by dragging the resize handle down-right.
    await dragByPointer(page, resizeHandle, 130, 90);

    await page.waitForTimeout(300);
    const after = await table.boundingBox();
    expect(after).toBeTruthy();
    expect(after!.width).toBeGreaterThan(before!.width);
    expect(after!.height).toBeGreaterThan(before!.height);

    await page.screenshot({
      path: '/artifacts/story-008-resize-table.png',
      fullPage: true,
    });
  });

  test('deletes a table and cascades removal of its relationships; the model reflects the change', async ({
    page,
  }) => {
    await addTable(page, 'users', ['id']);
    await addTable(page, 'orders', ['id', 'user_id']);

    await addRelationship(page, 'users', 'id', 'orders', 'user_id');

    const relationshipLine = page.locator('svg path.relationship-line');
    await expect(relationshipLine).toHaveCount(1);

    // Delete the source table through its header delete button.
    await page.getByRole('button', { name: 'Delete table users' }).click();

    await expect(page.getByRole('region', { name: 'Table users' })).not.toBeVisible();
    // Cascade: the relationship referencing the deleted table is removed too.
    await expect(relationshipLine).toHaveCount(0);
    // The unrelated target table remains on the canvas.
    await expect(page.getByRole('region', { name: 'Table orders' })).toBeVisible();

    await page.screenshot({
      path: '/artifacts/story-008-delete-table-cascade.png',
      fullPage: true,
    });
  });

  test('deletes a relationship by clicking its line; the model reflects the removal', async ({
    page,
  }) => {
    await addTable(page, 'users', ['id']);
    await addTable(page, 'orders', ['id', 'user_id']);

    await addRelationship(page, 'users', 'id', 'orders', 'user_id');

    const relationshipLine = page.locator('svg path.relationship-line');
    await expect(relationshipLine).toHaveCount(1);
    await expect(relationshipLine.first()).toBeVisible();

    // Click the relationship line to delete it. Dispatch the click directly on
    // the path element so the React onClick handler (RelationshipLine onDelete
    // -> removeRelationship) fires even where table columns overlap the line.
    await relationshipLine.first().dispatchEvent('click');

    await expect(relationshipLine).toHaveCount(0);
    // Both tables stay on the canvas; only the relationship is gone.
    await expect(page.getByRole('region', { name: 'Table users' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Table orders' })).toBeVisible();

    await page.screenshot({
      path: '/artifacts/story-008-delete-relationship.png',
      fullPage: true,
    });
  });
});
