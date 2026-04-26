import { expect, test } from '@playwright/test';

const drawSegment = async (
  canvas,
  start,
  end,
) => {
  await canvas.click({ position: start });
  await canvas.click({ position: end });
};

const dragCatalogItemToCanvas = async (
  page,
  itemTestId,
  canvasBox,
  dropPoint,
) => {
  const source = page.getByTestId(itemTestId);
  const sourceBox = await source.boundingBox();
  if (!sourceBox) {
    throw new Error(`Missing catalog item: ${itemTestId}`);
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + dropPoint.x, canvasBox.y + dropPoint.y, { steps: 10 });
  await page.mouse.up();
};

test('recreates the reference house layout and keeps 2D interactions stable', async ({ page }) => {
  await page.goto('/');

  const canvas = page.getByTestId('canvas-2d');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Canvas 2D was not rendered');
  }

  await page.getByTestId('wall-tool-toggle').click();

  await drawSegment(canvas, { x: 170, y: 140 }, { x: 620, y: 140 });
  await drawSegment(canvas, { x: 620, y: 140 }, { x: 620, y: 420 });
  await drawSegment(canvas, { x: 620, y: 420 }, { x: 170, y: 420 });
  await drawSegment(canvas, { x: 170, y: 420 }, { x: 170, y: 140 });
  await drawSegment(canvas, { x: 390, y: 140 }, { x: 390, y: 320 });

  await expect(page.getByTestId('canvas-object-wall')).toHaveCount(5);

  await page.getByTestId('sidebar-category-furniture').click();
  await dragCatalogItemToCanvas(page, 'catalog-item-sofa', canvasBox, { x: 260, y: 230 });

  await page.getByTestId('sidebar-category-doors').click();
  await dragCatalogItemToCanvas(page, 'catalog-item-window', canvasBox, { x: 500, y: 140 });

  await page.getByTestId('sidebar-category-furniture').click();
  const sofa = page.getByTestId('canvas-object-sofa');
  await expect(sofa).toHaveCount(1);

  const sofaBox = await sofa.boundingBox();
  if (!sofaBox) {
    throw new Error('Placed sofa was not visible');
  }

  await page.mouse.move(sofaBox.x + sofaBox.width / 2, sofaBox.y + sofaBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sofaBox.x + sofaBox.width / 2 + 140, sofaBox.y + sofaBox.height / 2 + 40, { steps: 8 });
  await page.mouse.up();

  await page.getByTestId('view-toggle-3d').click();
  await expect(page.getByTestId('canvas-3d')).toBeVisible();

  await page.getByTestId('view-toggle-2d').click();
  await expect(page.getByTestId('canvas-2d')).toBeVisible();
  await expect(page.getByTestId('canvas-object-wall')).toHaveCount(5);
  await expect(page.getByTestId('canvas-object-sofa')).toHaveCount(1);
  await expect(page.getByTestId('canvas-object-window')).toHaveCount(1);

  await page.getByTestId('save-project').click();

  const savedProject = await page.evaluate(() => {
    const raw = window.localStorage.getItem('home3d_design');
    return raw ? JSON.parse(raw) : null;
  });

  expect(savedProject?.objects).toHaveLength(7);
  expect(savedProject?.objects.filter((obj) => obj.type === 'wall')).toHaveLength(5);
});
