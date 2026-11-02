import * as fs from 'fs';
import { test, expect } from '@playwright/test';

test.describe('Visual QA - Export to JSON', () => {
  test('renders app with Export to JSON button visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Verify the Export to JSON button is visible in the header
    const exportButton = page.getByRole('button', { name: /export diagram to json/i });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toHaveAttribute('aria-label', 'Export diagram to JSON');

    // Full-page screenshot
    await page.screenshot({ path: '/artifacts/story-009-ui-full.png', fullPage: true });

    // Verify no console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    expect(errors).toHaveLength(0);
  });

  test('exports JSON with complete diagram model and downloads successfully', async ({ page, context }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Set up download handling
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export diagram to json/i }).click();
    const download = await downloadPromise;

    // Verify filename
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.json$/);
    expect(filename).toContain('diagram');

    // Read and verify content
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const content = fs.readFileSync(filePath!, 'utf-8');
    const json = JSON.parse(content);

    // Verify structure
    expect(json.version).toBe('1.0.0');
    expect(json.diagram.id).toBeDefined();
    expect(json.diagram.name).toBeDefined();
    expect(Array.isArray(json.diagram.tables)).toBe(true);
    expect(Array.isArray(json.diagram.relationships)).toBe(true);
    expect(Array.isArray(json.diagram.uniqueConstraints)).toBe(true);
    expect(Array.isArray(json.diagram.indexes)).toBe(true);
    expect(json.diagram.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(json.diagram.updatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);

    // Screenshot after export click
    await page.screenshot({ path: '/artifacts/story-009-after-export.png', fullPage: true });
  });

  test('exported JSON contains no database credentials', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export diagram to json/i }).click();
    const download = await downloadPromise;

    const filePath = await download.path();
    const content = fs.readFileSync(filePath!, 'utf-8').toLowerCase();

    for (const credential of ['host', 'port', 'database', '"user"', 'password']) {
      expect(content).not.toContain(credential);
    }
  });
});
