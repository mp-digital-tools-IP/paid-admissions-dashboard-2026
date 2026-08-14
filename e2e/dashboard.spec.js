import { expect, test } from '@playwright/test'

test('loads verified totals and expands a faculty', async ({ page }) => {
  const errors = []
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Платный приём — 2026' })).toBeVisible()
  await expect(page.getByText('113 288 873 ₽')).toBeVisible()
  await page.locator('.faculty-card__summary').first().click()
  await expect(page.getByTestId('direction-table')).toBeVisible()
  expect(errors).toEqual([])
})

test('filters and quality block work', async ({ page }) => {
  await page.goto('/')
  if ((await page.viewportSize()).width < 768) await page.getByRole('button', { name: /Фильтры/ }).click()
  await page.getByTestId('filter-citizenship').selectOption('Иностранное')
  await expect(page.getByTestId('quality-panel')).toBeVisible()
})

test('has no page-wide horizontal overflow', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('mobile menu opens and closes', async ({ page }) => {
  test.skip((await page.viewportSize()).width >= 768)
  await page.goto('/')
  const burger = page.getByRole('button', { name: 'Открыть меню' })
  await burger.click()
  await expect(burger).toHaveAttribute('aria-expanded', 'true')
  await page.locator('.mobile-close').click()
  await expect(burger).toHaveAttribute('aria-expanded', 'false')
})
