import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const output = process.argv[2] || 'audit'
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const report = { consoleErrors: [], failedResources: [], viewports: {} }

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 1100 },
  mobile: { width: 390, height: 844 },
})) {
  const page = await browser.newPage({ viewport })
  page.on('console', (message) => message.type() === 'error' && report.consoleErrors.push(`${name}: ${message.text()}`))
  page.on('requestfailed', (request) => report.failedResources.push(`${name}: ${request.url()}`))
  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true })
  report.viewports[name] = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    metrics: document.querySelectorAll('.metric').length,
    faculties: document.querySelectorAll('.faculty-card').length,
  }))
  await page.close()
}

await browser.close()
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2), 'utf8')
console.log(JSON.stringify(report, null, 2))
