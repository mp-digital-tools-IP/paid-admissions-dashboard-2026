import { describe, expect, it } from 'vitest'
import { ALL, JOINT_FACULTY, completionLabel, displayFaculty, filterPlan, filterSegments, groupFaculty, planTotals, sumRows } from './dataUtils.js'

const filters = { level: ALL, form: ALL, faculty: ALL, direction: ALL, citizenship: ALL, discount: ALL }
const joint = { level: 'Магистратура', form: 'Очная', code: '01.04.01', directionName: 'Тест', facultyScopes: ['А', 'Б'], joint: true, pfhdTarget: 10, marketingTarget: 20 }
const actual = { ...joint, citizenship: 'Россия', discount: 'Без скидки', active: 3, signed: 2, paid: 1, discounted: 0, portfolio: 100, payment: 50, contractAmount: 100, listPriceTotal: 120, listPriceMin: 40, listPriceMax: 40 }

describe('dashboard aggregation', () => {
  it('counts a joint plan once at university level', () => {
    expect(planTotals(filterPlan([joint], filters)).pfhdTarget).toBe(10)
    expect(displayFaculty(joint)).toBe(JOINT_FACULTY)
  })
  it('keeps a joint plan visible in either faculty filter', () => {
    expect(filterPlan([joint], { ...filters, faculty: 'А' })).toHaveLength(1)
    expect(filterPlan([joint], { ...filters, faculty: 'Б' })).toHaveLength(1)
  })
  it('filters factual dimensions without changing plan helpers', () => {
    expect(filterSegments([actual], { ...filters, citizenship: 'Иностранное' })).toHaveLength(0)
    expect(sumRows([actual]).payment).toBe(50)
  })
  it('keeps university and faculty bucket totals aligned', () => {
    const faculty = groupFaculty([joint], [actual])
    expect(faculty.reduce((sum, row) => sum + row.pfhdTarget, 0)).toBe(10)
    expect(faculty.reduce((sum, row) => sum + row.payment, 0)).toBe(50)
  })
  it('does not calculate a percentage for zero plan', () => {
    expect(completionLabel(3, 0)).toBe('Нет плана')
  })
})
