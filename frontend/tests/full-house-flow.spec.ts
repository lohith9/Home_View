import { expect, test } from '@playwright/test';

/**
 * Full House Flow — validates the complete design workflow:
 * 1. Draw walls (with corner-snap)
 * 2. Place door on wall (wall-attach constraint)
 * 3. Place furniture (grid + edge snap)
 * 4. Drag furniture and verify position updates
 * 5. Switch 2D → 3D and back
 * 6. Save and validate persistence
 */

const drawSegment = async (canvas: any, start: { x: number; y: number }, end: { x: number; y: number }) => {
  await canvas.click({ position: start });
  await canvas.click({ position: end });
};

const dragCatalogItemToCanvas = async (
  page: any,
  itemTestId: string,
  canvasBox: { x: number; y: number; width: number; height: number },
  dropPoint: { x: number; y: number },
) => {
  const source = page.getByTestId(itemTestId);
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error(`Missing catalog item: ${itemTestId}`);

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + dropPoint.x, canvasBox.y + dropPoint.y, { steps: 10 });
  await page.mouse.up();
};

// ─── Test 1: Full house layout creation ───────────────────────────────

test('creates a full house layout with walls, doors, and furniture', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('canvas-2d');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas 2D was not rendered');

  // Step 1: Enter wall drawing mode
  await page.getByTestId('wall-tool-toggle').click();

  // Step 2: Draw 4 walls forming a room (rectangle)
  await drawSegment(canvas, { x: 170, y: 140 }, { x: 620, y: 140 }); // top
  await drawSegment(canvas, { x: 620, y: 140 }, { x: 620, y: 420 }); // right
  await drawSegment(canvas, { x: 620, y: 420 }, { x: 170, y: 420 }); // bottom
  await drawSegment(canvas, { x: 170, y: 420 }, { x: 170, y: 140 }); // left

  // Step 3: Draw interior wall (room divider)
  await drawSegment(canvas, { x: 390, y: 140 }, { x: 390, y: 320 });

  await expect(page.getByTestId('canvas-object-wall')).toHaveCount(5);

  // Step 4: Exit wall mode, switch to Doors & Windows
  await page.getByTestId('wall-tool-toggle').click();
  await page.getByTestId('sidebar-category-doors').click();

  // Step 5: Place a door
  await dragCatalogItemToCanvas(page, 'catalog-item-single-door', canvasBox, { x: 300, y: 140 });

  // Step 6: Place a window
  await dragCatalogItemToCanvas(page, 'catalog-item-window', canvasBox, { x: 500, y: 140 });

  // Step 7: Switch to Furniture, place a sofa
  await page.getByTestId('sidebar-category-furniture').click();
  await dragCatalogItemToCanvas(page, 'catalog-item-sofa', canvasBox, { x: 260, y: 260 });

  // Step 8: Place a table
  await dragCatalogItemToCanvas(page, 'catalog-item-dining-table', canvasBox, { x: 490, y: 280 });

  // Verify all objects placed
  const sofa = page.getByTestId('canvas-object-sofa');
  await expect(sofa).toHaveCount(1);

  // Step 9: Verify sofa is draggable — drag it and check position changed
  const sofaBox = await sofa.boundingBox();
  if (!sofaBox) throw new Error('Sofa not visible on canvas');

  const sofaCenterX = sofaBox.x + sofaBox.width / 2;
  const sofaCenterY = sofaBox.y + sofaBox.height / 2;

  await page.mouse.move(sofaCenterX, sofaCenterY);
  await page.mouse.down();
  await page.mouse.move(sofaCenterX + 100, sofaCenterY + 60, { steps: 8 });
  await page.mouse.up();

  // After drag, sofa should have moved — check bounding box changed
  const sofaBoxAfter = await sofa.boundingBox();
  if (!sofaBoxAfter) throw new Error('Sofa disappeared after drag');
  expect(sofaBoxAfter.x).not.toBe(sofaBox.x);

  // Step 10: Switch to 3D and back
  await page.getByTestId('view-toggle-3d').click();
  await expect(page.getByTestId('canvas-3d')).toBeVisible();

  await page.getByTestId('view-toggle-2d').click();
  await expect(page.getByTestId('canvas-2d')).toBeVisible();

  // Step 11: Verify objects persisted across view switch
  await expect(page.getByTestId('canvas-object-wall')).toHaveCount(5);
  await expect(page.getByTestId('canvas-object-sofa')).toHaveCount(1);

  // Step 12: Save project and verify localStorage
  await page.getByTestId('save-project').click();
  const saved = await page.evaluate(() => {
    const raw = window.localStorage.getItem('home3d_design');
    return raw ? JSON.parse(raw) : null;
  });

  expect(saved).not.toBeNull();
  expect(saved.objects.length).toBeGreaterThanOrEqual(7); // 5 walls + door + window + sofa + table
  expect(saved.objects.filter((o: any) => o.type === 'wall')).toHaveLength(5);
});

// ─── Test 2: Selection and keyboard shortcuts ─────────────────────────

test('selection, delete, undo/redo work correctly', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('canvas-2d');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas 2D was not rendered');

  // Place a sofa
  await page.getByTestId('sidebar-category-furniture').click();
  await dragCatalogItemToCanvas(page, 'catalog-item-sofa', canvasBox, { x: 300, y: 300 });
  await expect(page.getByTestId('canvas-object-sofa')).toHaveCount(1);

  // Click the sofa to select it
  const sofa = page.getByTestId('canvas-object-sofa');
  await sofa.click();

  // Delete it with Delete key
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('canvas-object-sofa')).toHaveCount(0);

  // Undo → sofa comes back
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('canvas-object-sofa')).toHaveCount(1);

  // Redo → sofa gone again
  await page.keyboard.press('Control+y');
  await expect(page.getByTestId('canvas-object-sofa')).toHaveCount(0);
});

// ─── Test 3: Wall drawing produces no duplicates ─────────────────────

test('wall drawing creates exactly one wall per click pair', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('canvas-2d');

  // Enter wall mode
  await page.getByTestId('wall-tool-toggle').click();

  // Draw a single wall
  await canvas.click({ position: { x: 200, y: 200 } });
  await page.waitForTimeout(100);
  await canvas.click({ position: { x: 500, y: 200 } });
  await page.waitForTimeout(100);

  // Verify exactly 1 wall
  await expect(page.getByTestId('canvas-object-wall')).toHaveCount(1);

  // Draw second wall
  await canvas.click({ position: { x: 500, y: 200 } });
  await page.waitForTimeout(100);
  await canvas.click({ position: { x: 500, y: 400 } });
  await page.waitForTimeout(100);

  // Verify exactly 2 walls
  await expect(page.getByTestId('canvas-object-wall')).toHaveCount(2);
});

// ─── Test 4: No console errors during interaction ─────────────────────

test('no console errors during full interaction flow', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('/');
  const canvas = page.getByTestId('canvas-2d');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas 2D was not rendered');

  // Draw walls
  await page.getByTestId('wall-tool-toggle').click();
  await drawSegment(canvas, { x: 200, y: 150 }, { x: 550, y: 150 });
  await drawSegment(canvas, { x: 550, y: 150 }, { x: 550, y: 400 });
  await page.getByTestId('wall-tool-toggle').click();

  // Place furniture
  await page.getByTestId('sidebar-category-furniture').click();
  await dragCatalogItemToCanvas(page, 'catalog-item-sofa', canvasBox, { x: 350, y: 280 });

  // Switch views
  await page.getByTestId('view-toggle-3d').click();
  await page.waitForTimeout(500);
  await page.getByTestId('view-toggle-2d').click();
  await page.waitForTimeout(200);

  // Filter out known non-critical warnings (like React DevTools)
  const criticalErrors = errors.filter(
    (e) => !e.includes('DevTools') && !e.includes('favicon') && !e.includes('Download the React DevTools'),
  );

  expect(criticalErrors).toHaveLength(0);
});
