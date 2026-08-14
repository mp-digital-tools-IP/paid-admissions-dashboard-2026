import { describe, expect, it } from 'vitest'
import { ALL, JOINT_FACULTY, completionLabel, displayFaculty, filterPlan, filterSegments, planTotals, sumRows, uniquePeopleFor } from './dataUtils.js'

const filters = { level: ALL, form: ALL, faculty: ALL, direction: ALL, citizenship: ALL, discount: ALL, priority: ALL }
const joint = { level: 'Магистратура', form: 'Очная', code: '01.04.01', directionName: 'Тест', facultyScopes: ['А', 'Б'], joint: true, pfhdTarget: 10, marketingTarget: 20 }
const actual = { ...joint, citizenship: 'Россия', discount: 'Без скидки', priority: 1, rows: 3, contracts: 3, active: 3, signed: 2, paid: 1, discounted: 0, portfolio: 100, reportedPayment: 50, uniqueContractPayment: 50, contractAmount: 100, listPriceTotal: 120, listPriceMin: 40, listPriceMax: 40 }

describe('dashboard aggregation', () => {
  it('counts a joint plan once at university level', () => {
    expect(planTotals(filterPlan([joint], filters)).pfhdTarget).toBe(10)
    expect(displayFaculty(joint)).toBe(JOINT_FACULTY)
  })
  it('keeps a joint plan visible in either faculty filter', () => {
    expect(filterPlan([joint], { ...filters, faculty: 'А' })).toHaveLength(1)
    expect(filterPlan([joint], { ...filters, faculty: 'Б' })).toHaveLength(1)
  })
  it('filters priority and citizenship without changing the plan', () => {
    expect(filterSegments([actual], { ...filters, priority: '2' })).toHaveLength(0)
    expect(filterSegments([actual], { ...filters, citizenship: 'Иностранное' })).toHaveLength(0)
    expect(planTotals(filterPlan([joint], { ...filters, citizenship: 'Иностранное' })).pfhdTarget).toBe(10)
  })
  it('sums reported and unique-contract payments separately', () => {
    expect(sumRows([actual]).reportedPayment).toBe(50)
    expect(sumRows([actual]).uniqueContractPayment).toBe(50)
  })
  it('reads privacy-safe unique-person cube', () => {
    const snapshot = { peopleCube: { separator: '|', counts: { '*|*|*|*|*|*|*': 1856 } } }
    expect(uniquePeopleFor(snapshot, filters)).toBe(1856)
  })
  it('does not calculate a percentage for zero plan', () => {
    expect(completionLabel(3, 0)).toBe('Нет плана')
  })
})
