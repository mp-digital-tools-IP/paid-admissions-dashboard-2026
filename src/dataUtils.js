export const ALL = 'Все'
export const JOINT_FACULTY = 'Совместные программы'

export const defaultFilters = {
  level: ALL,
  form: ALL,
  faculty: ALL,
  direction: ALL,
  citizenship: ALL,
  discount: ALL,
}

export function displayFaculty(row) {
  return row.joint || row.facultyScopes.length > 1 ? JOINT_FACULTY : row.facultyScopes[0]
}

export function matchesBase(row, filters) {
  return (
    (filters.level === ALL || row.level === filters.level) &&
    (filters.form === ALL || row.form === filters.form) &&
    (filters.faculty === ALL || row.facultyScopes.includes(filters.faculty)) &&
    (filters.direction === ALL || `${row.code}|${row.directionName}` === filters.direction)
  )
}

export function filterSegments(segments, filters) {
  return segments.filter(
    (row) =>
      matchesBase(row, filters) &&
      (filters.citizenship === ALL || row.citizenship === filters.citizenship) &&
      (filters.discount === ALL || row.discount === filters.discount),
  )
}

export function filterPlan(records, filters) {
  return records.filter((row) => matchesBase(row, filters))
}

export function sumRows(rows) {
  return rows.reduce(
    (sum, row) => ({
      active: sum.active + (row.active || 0),
      signed: sum.signed + (row.signed || 0),
      paid: sum.paid + (row.paid || 0),
      discounted: sum.discounted + (row.discounted || 0),
      portfolio: sum.portfolio + (row.portfolio || 0),
      payment: sum.payment + (row.payment || 0),
      contractAmount: sum.contractAmount + (row.contractAmount || 0),
      listPriceTotal: sum.listPriceTotal + (row.listPriceTotal || 0),
      listPriceMin:
        row.listPriceMin == null
          ? sum.listPriceMin
          : sum.listPriceMin == null
            ? row.listPriceMin
            : Math.min(sum.listPriceMin, row.listPriceMin),
      listPriceMax:
        row.listPriceMax == null
          ? sum.listPriceMax
          : sum.listPriceMax == null
            ? row.listPriceMax
            : Math.max(sum.listPriceMax, row.listPriceMax),
    }),
    {
      active: 0,
      signed: 0,
      paid: 0,
      discounted: 0,
      portfolio: 0,
      payment: 0,
      contractAmount: 0,
      listPriceTotal: 0,
      listPriceMin: null,
      listPriceMax: null,
    },
  )
}

export function planTotals(rows) {
  return rows.reduce(
    (sum, row) => ({
      pfhdTarget: sum.pfhdTarget + row.pfhdTarget,
      marketingTarget: sum.marketingTarget + row.marketingTarget,
    }),
    { pfhdTarget: 0, marketingTarget: 0 },
  )
}

export function groupFaculty(planRows, segments) {
  const names = new Set([
    ...planRows.map(displayFaculty),
    ...segments.map(displayFaculty),
  ])
  return [...names]
    .sort((a, b) => (a === JOINT_FACULTY ? 1 : b === JOINT_FACULTY ? -1 : a.localeCompare(b, 'ru')))
    .map((name) => {
      const plans = planRows.filter((row) => displayFaculty(row) === name)
      const actuals = segments.filter((row) => displayFaculty(row) === name)
      return { name, ...planTotals(plans), ...sumRows(actuals), joint: name === JOINT_FACULTY }
    })
}

export function groupDirections(planRows, segments, facultyName) {
  const keyOf = (row) => `${row.level}|${row.form}|${row.code}|${row.directionName}`
  const keys = new Set([
    ...planRows.filter((row) => displayFaculty(row) === facultyName).map(keyOf),
    ...segments.filter((row) => displayFaculty(row) === facultyName).map(keyOf),
  ])
  return [...keys]
    .map((key) => {
      const plans = planRows.filter((row) => displayFaculty(row) === facultyName && keyOf(row) === key)
      const actuals = segments.filter((row) => displayFaculty(row) === facultyName && keyOf(row) === key)
      const [level, form, code, directionName] = key.split('|')
      return { key, level, form, code, directionName, ...planTotals(plans), ...sumRows(actuals) }
    })
    .sort((a, b) => `${a.code}${a.directionName}${a.form}`.localeCompare(`${b.code}${b.directionName}${b.form}`, 'ru'))
}

export function completionLabel(value, plan) {
  if (!plan) return 'Нет плана'
  return `${Math.round((value / plan) * 100)}%`
}
