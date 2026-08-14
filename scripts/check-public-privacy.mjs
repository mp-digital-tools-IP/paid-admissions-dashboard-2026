import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const roots = ['public/data', 'dist']
const forbiddenKeys = [/"фио"\s*:/iu, /"номер договора"\s*:/iu, /"contractNumber"\s*:/u, /"телефон"\s*:/iu, /"email"\s*:/iu, /"почта"\s*:/iu, /"паспорт"\s*:/iu, /"снилс"\s*:/iu, /"инн"\s*:/iu, /"адрес"\s*:/iu]
const valuePatterns = [/\b[\w.+-]+@[\w.-]+\.[a-zа-я]{2,}\b/iu, /(?<!\d)(?:\+7|8)[\s()-]*\d{3}[\s()-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/u]

async function files(root) {
  try {
    const result = []
    for (const entry of await readdir(root)) {
      const full = path.join(root, entry)
      if ((await stat(full)).isDirectory()) result.push(...await files(full))
      else result.push(full)
    }
    return result
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

const failures = []
for (const root of roots) {
  for (const file of await files(root)) {
    if (!/\.(json|html|js|css|txt)$/i.test(file)) continue
    const text = await readFile(file, 'utf8')
    for (const pattern of [...forbiddenKeys, ...valuePatterns]) if (pattern.test(text)) failures.push(`${file}: ${pattern}`)
  }
}
if (failures.length) {
  console.error(`Privacy check failed:\n${failures.join('\n')}`)
  process.exit(1)
}
console.log('Privacy check passed: public artifacts contain aggregate fields only.')
