export const ALL = 'Все'
export const JOINT_FACULTY = 'Совместные программы'
export const LEVEL_ORDER = ['Бакалавриат и специалитет', 'Магистратура', 'Аспирантура']
export const FORM_ORDER = ['Очная', 'Очно-заочная', 'Заочная']

export const defaultFilters = {
  level: ALL,
  form: ALL,
  faculty: ALL,
  direction: ALL,
  citizenship: ALL,
  discount: ALL,
  priority: ALL,
}

export function displayFaculty(row) {
  return row.joint || row.facultyScopes.length > 1 ? JOINT_FACULTY : row.facultyScopes[0]
}

export function matchesBase(row, filters) {
  return (
    (filters.level === ALL || row.level === filters.level) &&
    (filters.form === ALL || row.form === filters.form) &&
    (filters.faculty === ALL || row.facultyScopes.includes(filters.faculty) || (filters.faculty === JOINT_FACULTY && displayFaculty(row) === JOINT_FACULTY)) &&
    (filters.direction === ALL || row.code === filters.direction)
  )
}

export function filterSegments(segments, filters) {
  return segments.filter(
    (row) =>
      matchesBase(row, filters) &&
      (filters.citizenship === ALL || row.citizenship === filters.citizenship) &&
      (filters.discount === ALL || row.discount === filters.discount) &&
      (filters.priority === ALL || String(row.priority) === String(filters.priority)),
  )
}

export function filterPlan(records, filters) {
  return records.filter((row) => matchesBase(row, filters))
}

export function sumRows(rows) {
  return rows.reduce(
    (sum, row) => {
      for (const key of ['rows', 'contracts', 'active', 'signed', 'paid', 'discounted', 'portfolio', 'reportedPayment', 'uniqueContractPayment', 'contractAmount', 'listPriceTotal']) {
        sum[key] += row[key] || 0
      }
      if (row.listPriceMin != null) sum.listPriceMin = sum.listPriceMin == null ? row.listPriceMin : Math.min(sum.listPriceMin, row.listPriceMin)
      if (row.listPriceMax != null) sum.listPriceMax = sum.listPriceMax == null ? row.listPriceMax : Math.max(sum.listPriceMax, row.listPriceMax)
      return sum
    },
    { rows: 0, contracts: 0, active: 0, signed: 0, paid: 0, discounted: 0, portfolio: 0, reportedPayment: 0, uniqueContractPayment: 0, contractAmount: 0, listPriceTotal: 0, listPriceMin: null, listPriceMax: null },
  )
}

export function planTotals(rows) {
  return rows.reduce(
    (sum, row) => ({ pfhdTarget: sum.pfhdTarget + row.pfhdTarget, marketingTarget: sum.marketingTarget + row.marketingTarget }),
    { pfhdTarget: 0, marketingTarget: 0 },
  )
}

function cubeValue(value) {
  return value === ALL || value == null ? '*' : String(value)
}

export function uniquePeopleFor(snapshot, filters) {
  const cube = snapshot.peopleCube
  if (!cube) return snapshot.metrics.uniquePeople || 0
  const key = [
    cubeValue(filters.level), cubeValue(filters.form), cubeValue(filters.faculty), cubeValue(filters.direction),
    cubeValue(filters.citizenship), cubeValue(filters.discount), cubeValue(filters.priority),
  ].join(cube.separator)
  return cube.counts[key] || 0
}

export function groupFaculty(planRows, segments, snapshot, filters) {
  const names = new Set([...planRows.map(displayFaculty), ...segments.map(displayFaculty)])
  return [...names]
    .sort((a, b) => (a === JOINT_FACULTY ? 1 : b === JOINT_FACULTY ? -1 : a.localeCompare(b, 'ru')))
    .map((name) => {
      const plans = planRows.filter((row) => displayFaculty(row) === name)
      const actuals = segments.filter((row) => displayFaculty(row) === name)
      const cubeFaculty = name === JOINT_FACULTY && filters.faculty !== ALL ? filters.faculty : name
      const facultyFilters = { ...filters, faculty: cubeFaculty }
      return {
        name,
        ...planTotals(plans),
        ...sumRows(actuals),
        joint: name === JOINT_FACULTY,
        uniquePeople: uniquePeopleFor(snapshot, facultyFilters),
        russiaPeople: uniquePeopleFor(snapshot, { ...facultyFilters, citizenship: 'Россия' }),
        foreignPeople: uniquePeopleFor(snapshot, { ...facultyFilters, citizenship: 'Иностранное' }),
      }
    })
}

export function groupDirections(planRows, segments, facultyName) {
  const belongs = (row) => displayFaculty(row) === facultyName
  const keyOf = (row) => `${row.level}|${row.form}|${row.code}`
  const keys = new Set([...planRows.filter(belongs).map(keyOf), ...segments.filter(belongs).map(keyOf)])
  return [...keys]
    .map((key) => {
      const plans = planRows.filter((row) => belongs(row) && keyOf(row) === key)
      const actuals = segments.filter((row) => belongs(row) && keyOf(row) === key)
      const [level, form, code] = key.split('|')
      const directionName = plans[0]?.directionName || actuals[0]?.directionName || 'Без названия'
      return {
        key, level, form, code, directionName,
        ...planTotals(plans), ...sumRows(actuals),
        russiaContracts: sumRows(actuals.filter((row) => row.citizenship === 'Россия')).contracts,
        foreignContracts: sumRows(actuals.filter((row) => row.citizenship === 'Иностранное')).contracts,
        priorityOne: sumRows(actuals.filter((row) => row.priority === 1)).contracts,
        priorityTwo: sumRows(actuals.filter((row) => row.priority === 2)).contracts,
        priorityOther: sumRows(actuals.filter((row) => row.priority !== 1 && row.priority !== 2)).contracts,
        unmatched: actuals.some((row) => !row.matchedPlan),
      }
    })
    .sort((a, b) => {
      const level = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
      if (level) return level
      const form = FORM_ORDER.indexOf(a.form) - FORM_ORDER.indexOf(b.form)
      return form || `${a.code}${a.directionName}`.localeCompare(`${b.code}${b.directionName}`, 'ru')
    })
}

export function scopeGroups(planRows, segments) {
  const result = []
  for (const level of LEVEL_ORDER) {
    for (const form of FORM_ORDER) {
      const plans = planRows.filter((row) => row.level === level && row.form === form)
      const actuals = segments.filter((row) => row.level === level && row.form === form)
      if (!plans.length && !actuals.length) continue
      result.push({ key: `${level}|${form}`, level, form, ...planTotals(plans), ...sumRows(actuals) })
    }
  }
  return result
}

export function completionLabel(value, plan) {
  if (!plan) return 'Нет плана'
  return `${Math.round((value / plan) * 100)}%`
}
