import { expect, test } from '@playwright/test'

test('loads complete totals and expands a faculty', async ({ page }) => {
  const errors = []
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Платный приём — 2026' })).toBeVisible()
  await expect(page.getByText('143 023 403 ₽').first()).toBeVisible()
  await expect(page.getByText('1 856').first()).toBeVisible()
  await page.locator('.faculty-card__summary').first().click()
  await expect(page.getByTestId('direction-table')).toBeVisible()
  expect(errors).toEqual([])
})

test('magistracy uses its own PFHD goal', async ({ page }) => {
  await page.goto('/')
  if ((await page.viewportSize()).width < 768) await page.getByRole('button', { name: /Фильтры/ }).click()
  await page.getByTestId('filter-level').selectOption('Магистратура')
  await expect(page.getByText('246 / 1 352').first()).toBeVisible()
  await expect(page.getByText('Цель выбранного академического среза')).toBeVisible()
})

test('priority and citizenship filters update the faculty slice', async ({ page }) => {
  await page.goto('/')
  if ((await page.viewportSize()).width < 768) await page.getByRole('button', { name: /Фильтры/ }).click()
  await page.getByTestId('filter-priority').selectOption('2')
  await page.getByTestId('filter-citizenship').selectOption('Иностранное')
  await expect(page.getByTestId('faculty-list')).toBeVisible()
  await expect(page.getByText('Каждый факультет показан один раз.')).toBeVisible()
  await page.getByRole('button', { name: 'Сбросить' }).click()
  await expect(page.getByTestId('filter-priority')).toHaveValue('Все')
  await expect(page.getByTestId('filter-citizenship')).toHaveValue('Все')
})

test('usability: faculties are unique and Favorsky programs stay accessible', async ({ page }) => {
  const favorsky = 'Институт графики и искусства книги имени В. А. Фаворского'
  const fdr = 'Передовая инженерная школа технологического лидерства «FDR»'
  await page.goto('/')
  await expect(page.getByText('Почему итог отличается от прежнего среза')).toHaveCount(0)
  await expect(page.locator('.level-heading, .form-heading')).toHaveCount(0)
  const titles = await page.locator('.faculty-card__title b').allTextContents()
  expect(new Set(titles).size).toBe(titles.length)
  expect(titles.filter((title) => title === fdr)).toHaveLength(1)
  expect(titles.filter((title) => title === favorsky)).toHaveLength(1)

  if ((await page.viewportSize()).width < 768) await page.getByRole('button', { name: /Фильтры/ }).click()
  await page.getByTestId('filter-level').selectOption('Бакалавриат и специалитет')
  await page.getByTestId('filter-faculty').selectOption(favorsky)
  await expect(page.getByRole('heading', { name: favorsky })).toBeVisible()
  await page.locator('.faculty-card__summary').filter({ hasText: favorsky }).click()
  const table = page.getByTestId('direction-table')
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'После удаления дублей' })).toHaveCount(0)
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
test('tuition shows one annual amount per separate study form', async ({ page }) => {
  await page.goto('/')
  await page.locator('#tuition summary').click()
  await expect(page.locator('#tuition th', { hasText: 'Стоимость за год' })).toBeVisible()
  await expect(page.locator('#tuition tbody tr')).toHaveCount(126)
  const prices = await page.locator('#tuition tbody tr td:nth-child(2)').allTextContents()
  expect(prices.every((value) => /^\d[\d\s]* ₽$/.test(value))).toBe(true)
  const forms = await page.locator('#tuition tbody tr td:nth-child(3)').allTextContents()
  expect(forms.every((value) => ['Очная', 'Очно-заочная', 'Заочная'].includes(value))).toBe(true)
})
