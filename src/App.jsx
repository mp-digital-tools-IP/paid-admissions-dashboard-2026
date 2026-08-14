import { useEffect, useMemo, useState } from 'react'
import {
  Buildings, CaretDown, ChartLineUp, CheckCircle, CurrencyRub, Database, Funnel,
  List, ShieldCheck, Target, TrendUp, UsersThree, Wallet, X,
} from './icons.jsx'
import {
  ALL, FORM_ORDER, LEVEL_ORDER, completionLabel, defaultFilters, filterPlan, filterSegments,
  groupDirections, groupFaculty, planTotals, scopeGroups, sumRows, uniquePeopleFor,
} from './dataUtils.js'

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const count = new Intl.NumberFormat('ru-RU')
const dateTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Moscow' })

const formatMoney = (value) => `${money.format(value || 0)} ₽`
const percent = (value, target) => target ? `${((value / target) * 100).toFixed(1).replace('.', ',')}%` : 'Нет плана'

function Select({ label, value, options, onChange, testId }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId}>
        <option value={ALL}>{ALL}</option>
        {options.map((option) => {
          const key = typeof option === 'string' || typeof option === 'number' ? String(option) : String(option.value)
          const labelText = typeof option === 'string' || typeof option === 'number' ? String(option) : option.label
          return <option key={key} value={key}>{labelText}</option>
        })}
      </select>
    </label>
  )
}

function Metric({ icon: Icon, label, value, detail, tone = 'dark', progress }) {
  return (
    <article className={`metric metric--${tone}`}>
      <div className="metric__top"><span>{label}</span><Icon size={22} weight="bold" /></div>
      <strong>{value}</strong>
      {progress != null && <div className="metric__progress"><i style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} /></div>}
      <small>{detail}</small>
    </article>
  )
}

const chartMetrics = [
  { key: 'reportedPayment', label: 'Оплата', type: 'money', tone: 'red' },
  { key: 'portfolio', label: 'Портфель', type: 'money', tone: 'black' },
  { key: 'contractAmount', label: 'Стоимость договоров', type: 'money', tone: 'gray' },
  { key: 'paid', label: 'Оплаченные договоры', type: 'count', tone: 'orange' },
  { key: 'pfhdTarget', label: 'ПФХД', type: 'count', tone: 'blue' },
  { key: 'marketingTarget', label: 'Маркетинговый план', type: 'count', tone: 'green' },
]

function ComparisonChart({ rows }) {
  const [selected, setSelected] = useState(() => new Set(['reportedPayment', 'portfolio', 'paid', 'pfhdTarget']))
  const toggle = (key) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(key) && next.size > 1) next.delete(key)
    else next.add(key)
    return next
  })
  const visible = chartMetrics.filter((item) => selected.has(item.key))
  const maxima = Object.fromEntries(visible.map((item) => [item.key, Math.max(1, ...rows.map((row) => row[item.key] || 0))]))
  return (
    <article className="panel comparison-panel" data-testid="comparison-chart">
      <div className="panel__heading">
        <div><span className="eyebrow">Текущий срез</span><h2>План и факт по уровням и формам</h2><p>Показатели можно включать и выключать. Денежные и количественные ряды подписаны отдельно.</p></div>
      </div>
      <div className="metric-toggles" aria-label="Показатели диаграммы">
        {chartMetrics.map((item) => <label key={item.key}><input type="checkbox" checked={selected.has(item.key)} onChange={() => toggle(item.key)} /><i className={`tone-${item.tone}`} />{item.label}</label>)}
      </div>
      <div className="comparison-chart">
        {rows.map((row) => (
          <article key={row.key} className="comparison-row">
            <header><b>{row.level}</b><span>{row.form}</span></header>
            <div>
              {visible.map((item) => {
                const value = row[item.key] || 0
                return (
                  <div className="comparison-bar" key={item.key}>
                    <span>{item.label}</span><div><i className={`tone-${item.tone}`} style={{ width: `${(value / maxima[item.key]) * 100}%` }} /></div>
                    <b>{item.type === 'money' ? formatMoney(value) : count.format(value)}</b>
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </article>
  )
}

function FacultyTable({ facultyRows, planRows, segments }) {
  const [open, setOpen] = useState(null)
  return (
    <div className="faculty-list" data-testid="faculty-list">
      {facultyRows.map((faculty) => {
        const directions = groupDirections(planRows, segments, faculty.name)
        const isOpen = open === faculty.name
        return (
          <article className={`faculty-card ${faculty.joint ? 'faculty-card--joint' : ''}`} key={faculty.name}>
            <button className="faculty-card__summary" type="button" onClick={() => setOpen(isOpen ? null : faculty.name)} aria-expanded={isOpen}>
              <span className="faculty-card__title"><Buildings size={20} /><span><b>{faculty.name}</b>{faculty.joint && <em>Совместная программа — план считается один раз</em>}</span></span>
              <span><small>ПФХД</small><b>{count.format(faculty.pfhdTarget)}</b></span>
              <span><small>Люди</small><b>{count.format(faculty.uniquePeople)}</b></span>
              <span><small>Гражданство</small><b>{count.format(faculty.russiaPeople)} / {count.format(faculty.foreignPeople)}</b><small>Россия / иностранное</small></span>
              <span><small>Договоры</small><b>{count.format(faculty.contracts)}</b></span>
              <span><small>Оплата</small><b>{formatMoney(faculty.reportedPayment)}</b></span>
              <CaretDown className={isOpen ? 'rotate' : ''} size={20} />
            </button>
            {isOpen && (
              <div className="table-scroll" data-testid="direction-table">
                <table>
                  <thead><tr><th>Направление</th><th>Стоимость семестра</th><th>ПФХД</th><th>Маркетинг</th><th>Договоры</th><th>Подписаны</th><th>Оплачены</th><th>Приоритеты 1 / 2 / другие</th><th>Россия / иностранное</th><th>Портфель</th><th>Оплата по выгрузке</th><th>После удаления дублей</th><th>Выполнение</th></tr></thead>
                  <tbody>
                    {directions.map((row) => (
                      <tr key={row.key} className={row.unmatched ? 'row-warning' : ''}>
                        <td><b>{row.code} · {row.directionName}</b><small>{row.form}{row.unmatched ? ' · Нет соответствия в ПФХД' : ''}</small></td>
                        <td>{row.listPriceMin == null ? '—' : row.listPriceMin === row.listPriceMax ? formatMoney(row.listPriceMin) : `${formatMoney(row.listPriceMin)}–${formatMoney(row.listPriceMax)}`}</td>
                        <td>{count.format(row.pfhdTarget)}</td><td>{count.format(row.marketingTarget)}</td><td>{count.format(row.contracts)}</td><td>{count.format(row.signed)}</td><td>{count.format(row.paid)}</td>
                        <td>{count.format(row.priorityOne)} / {count.format(row.priorityTwo)} / {count.format(row.priorityOther)}</td>
                        <td>{count.format(row.russiaContracts)} / {count.format(row.foreignContracts)}</td><td>{formatMoney(row.portfolio)}</td><td>{formatMoney(row.reportedPayment)}</td><td>{formatMoney(row.uniqueContractPayment)}</td>
                        <td><span className={row.pfhdTarget ? 'status' : 'status status--neutral'}>{completionLabel(row.paid, row.pfhdTarget)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function FacultySections({ planRows, segments, snapshot, filters }) {
  const groups = scopeGroups(planRows, segments)
  return (
    <div className="scope-sections">
      {groups.map((group, index) => {
        const groupPlan = planRows.filter((row) => row.level === group.level && row.form === group.form)
        const groupSegments = segments.filter((row) => row.level === group.level && row.form === group.form)
        const groupFilters = { ...filters, level: group.level, form: group.form }
        const facultyRows = groupFaculty(groupPlan, groupSegments, snapshot, groupFilters)
        const showLevel = index === 0 || groups[index - 1].level !== group.level
        return (
          <section className="scope-section" key={group.key}>
            {showLevel && <h3 className="level-heading">{group.level}</h3>}
            <div className="form-heading"><div><b>{group.form}</b><span>ПФХД {count.format(group.pfhdTarget)} · маркетинг {count.format(group.marketingTarget)}</span></div><span>Оплата {formatMoney(group.reportedPayment)}</span></div>
            <FacultyTable facultyRows={facultyRows} planRows={groupPlan} segments={groupSegments} />
          </section>
        )
      })}
    </div>
  )
}

function Reconciliation({ current }) {
  const q = current.quality
  const op = q.reconciliation.operationalPriorityOne
  return (
    <section className="panel reconciliation" id="reconciliation">
      <div className="panel__heading"><div><span className="eyebrow">Полная картина</span><h2>Почему итог отличается от прежнего среза</h2><p>143 023 403 ₽ — сумма всех детальных строк. Итоговая строка Excel используется только для сверки и второй раз не складывается.</p></div><span className="source-badge"><Database size={16} /> Сверка с Excel: {formatMoney(q.sourceSummaryPayment)}</span></div>
      <div className="reconciliation-flow">
        <article><small>Все детальные строки</small><strong>{formatMoney(q.reconciliation.reported.payment)}</strong><span>{count.format(q.reconciliation.reported.rows)} строк</span></article>
        <article><small>Уникальные договоры</small><strong>{formatMoney(q.reconciliation.uniqueContracts.payment)}</strong><span>{count.format(q.reconciliation.uniqueContracts.contracts)} договоров</span></article>
        <article><small>Прежний операционный срез</small><strong>{formatMoney(op.uniqueContractPayment)}</strong><span>Приоритет 1, без отозванных и отменённых, без дублей</span></article>
      </div>
      <div className="reconciliation-steps">
        {q.reconciliation.steps.map((item) => <article key={item.label}><b>{formatMoney(item.payment)}</b><span>{item.label}</span><small>{count.format(item.rows)} строк</small></article>)}
      </div>
    </section>
  )
}

function PriorityTable({ rows }) {
  return (
    <section className="panel" id="priorities">
      <div className="panel__heading"><div><span className="eyebrow">Приоритеты</span><h2>Договоры и оплаты по всем приоритетам</h2><p>Приоритет 0 означает, что значение в выгрузке не указано.</p></div></div>
      <div className="table-scroll compact-table"><table><thead><tr><th>Приоритет</th><th>Строки</th><th>Уникальные люди</th><th>Уникальные договоры</th><th>Портфель</th><th>Оплата по выгрузке</th><th>После удаления дублей</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.value}><td><b>{row.value === '0' ? '0 / не указан' : row.value}</b></td><td>{count.format(row.rows)}</td><td>{count.format(row.uniquePeople)}</td><td>{count.format(row.uniqueContracts)}</td><td>{formatMoney(row.portfolio)}</td><td>{formatMoney(row.reportedPayment)}</td><td>{formatMoney(row.uniqueContractPayment)}</td></tr>)}
      </tbody></table></div>
    </section>
  )
}

function TuitionReference({ segments }) {
  const grouped = new Map()
  for (const row of segments) {
    const key = `${row.level}|${row.form}|${row.code}`
    const current = grouped.get(key) || { key, level: row.level, form: row.form, code: row.code, directionName: row.directionName, rows: [] }
    current.rows.push(row)
    grouped.set(key, current)
  }
  const rows = [...grouped.values()].map((row) => ({ ...row, ...sumRows(row.rows) })).sort((a, b) => {
    const level = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
    const form = FORM_ORDER.indexOf(a.form) - FORM_ORDER.indexOf(b.form)
    return level || form || a.code.localeCompare(b.code, 'ru')
  })
  return (
    <section className="panel" id="tuition">
      <div className="panel__heading"><div><span className="eyebrow">Справочный раздел</span><h2>Стоимость обучения</h2><p>В таблице показана стоимость семестра из текущей выгрузки договоров. Официальный приказ о годовой стоимости используется как отдельный справочный источник и не подменяет фактические суммы договоров.</p></div><span className="source-badge"><Database size={16} /> Стоимость семестра из договоров</span></div>
      <div className="table-scroll compact-table"><table><thead><tr><th>Направление</th><th>Уровень</th><th>Форма</th><th>Стоимость семестра</th><th>Договоры с данными</th><th>Сумма без скидки</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.key}><td><b>{row.code} · {row.directionName}</b></td><td>{row.level}</td><td>{row.form}</td><td>{row.listPriceMin == null ? '—' : row.listPriceMin === row.listPriceMax ? formatMoney(row.listPriceMin) : `${formatMoney(row.listPriceMin)}–${formatMoney(row.listPriceMax)}`}</td><td>{count.format(row.contracts)}</td><td>{formatMoney(row.listPriceTotal)}</td></tr>)}
      </tbody></table></div>
    </section>
  )
}

function Quality({ quality }) {
  const items = [
    ['Точные дубли договоров', quality.duplicateContracts, `${formatMoney(quality.duplicatePayment)} показаны в расхождении`],
    ['Несопоставленные направления', quality.unmatchedDirections, `${quality.unmatchedRows} строк · ${formatMoney(quality.unmatchedPayment)}`],
    ['Ошибки групповых формул ПФХД', quality.planReconciliation.formulaErrors, quality.planReconciliation.status],
    ['Расхождения суммы после скидки', quality.discountFormulaMismatches, 'Показаны как факт, без исправления'],
    ['Частичные оплаты', quality.partialPayments, 'Оплата меньше суммы договора'],
    ['Оплаты сверх суммы договора', quality.overpayments, 'Не ограничиваются искусственно'],
    ['Оплата без статуса «Подписан»', quality.paymentsWithoutSignedStatus, 'Требует операционной проверки'],
    ['Сопоставленные коды', quality.matchedDirectionCodes, 'Фактические коды выгрузки'],
  ]
  return (
    <section className="panel" id="quality" data-testid="quality-panel">
      <div className="panel__heading"><div><span className="eyebrow">Контроль загрузки</span><h2>Качество данных</h2></div><span className="source-badge"><ShieldCheck size={16} /> Без персональных данных</span></div>
      <div className="quality-grid">{items.map(([label, value, detail]) => <article key={label}><strong>{count.format(value)}</strong><b>{label}</b><small>{detail}</small></article>)}</div>
    </section>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(defaultFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    Promise.all([
      fetch(`${base}data/plan.json`).then((response) => response.ok ? response.json() : Promise.reject(new Error('plan.json'))),
      fetch(`${base}data/current.json`).then((response) => response.ok ? response.json() : Promise.reject(new Error('current.json'))),
      fetch(`${base}data/history.json`).then((response) => response.ok ? response.json() : Promise.reject(new Error('history.json'))),
    ]).then(([plan, current, history]) => setData({ plan, current, history })).catch(() => setError('Не удалось загрузить проверенный срез. Действующий сайт не изменён.'))
  }, [])

  const updateFilter = (key, value) => setFilters((current) => {
    if (key === 'level') return { ...current, level: value, form: ALL, faculty: ALL, direction: ALL }
    if (key === 'form') return { ...current, form: value, faculty: ALL, direction: ALL }
    if (key === 'faculty') return { ...current, faculty: value, direction: ALL }
    return { ...current, [key]: value }
  })
  const filteredSegments = useMemo(() => data ? filterSegments(data.current.segments, filters) : [], [data, filters])
  const filteredPlan = useMemo(() => data ? filterPlan(data.plan.records, filters) : [], [data, filters])
  const actual = useMemo(() => sumRows(filteredSegments), [filteredSegments])
  const plans = useMemo(() => planTotals(filteredPlan), [filteredPlan])
  const uniquePeople = useMemo(() => data ? uniquePeopleFor(data.current, filters) : 0, [data, filters])
  const chartRows = useMemo(() => scopeGroups(filteredPlan, filteredSegments), [filteredPlan, filteredSegments])

  if (error) return <main className="load-state"><Database size={42} /><h1>Данные недоступны</h1><p>{error}</p></main>
  if (!data) return <main className="load-state"><span className="loader" /><p>Загружаем проверенный срез…</p></main>

  const levels = LEVEL_ORDER.filter((level) => data.plan.records.some((row) => row.level === level))
  const forms = FORM_ORDER.filter((form) => data.plan.records.some((row) => (filters.level === ALL || row.level === filters.level) && row.form === form))
  const basePlan = data.plan.records.filter((row) => (filters.level === ALL || row.level === filters.level) && (filters.form === ALL || row.form === filters.form))
  const faculties = [...new Set(basePlan.flatMap((row) => row.facultyScopes))].sort((a, b) => a.localeCompare(b, 'ru'))
  const directions = [...new Map(basePlan.filter((row) => filters.faculty === ALL || row.facultyScopes.includes(filters.faculty)).map((row) => [row.code, { value: row.code, label: `${row.code} · ${row.directionName}` }])).values()].sort((a, b) => a.value.localeCompare(b.value, 'ru'))
  const priorities = data.current.dimensions.priorities.map((value) => ({ value: String(value), label: value === 0 ? '0 / не указан' : `Приоритет ${value}` }))
  const isGlobal = Object.values(filters).every((value) => value === ALL)
  const globalTarget = data.current.metrics.financialTarget
  const financialProgress = isGlobal ? (actual.reportedPayment / globalTarget) * 100 : null
  const paidProgress = plans.pfhdTarget ? (actual.paid / plans.pfhdTarget) * 100 : null
  const duplicateDelta = actual.reportedPayment - actual.uniqueContractPayment

  return (
    <div className="app-shell">
      {menuOpen && <button className="backdrop" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <button className="mobile-close" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}><X size={22} /></button>
        <img src={`${import.meta.env.BASE_URL}assets/polytech_logo_main_RGB_RUS.png`} alt="Московский Политех" />
        <div className="sidebar__product"><span>Оперативный дашборд</span><b>Платный приём · 2026</b></div>
        <nav aria-label="Разделы"><a href="#overview" onClick={() => setMenuOpen(false)}><ChartLineUp size={20} /> Обзор</a><a href="#faculties" onClick={() => setMenuOpen(false)}><UsersThree size={20} /> Факультеты</a><a href="#tuition" onClick={() => setMenuOpen(false)}><Wallet size={20} /> Стоимость</a><a href="#priorities" onClick={() => setMenuOpen(false)}><Target size={20} /> Приоритеты</a><a href="#quality" onClick={() => setMenuOpen(false)}><ShieldCheck size={20} /> Качество данных</a></nav>
        <div className="sidebar__footer"><ShieldCheck size={18} /><span><b>Без персональных данных</b><small>Публичные агрегаты</small></span></div>
      </aside>

      <main className="workspace" id="overview">
        <header className="topbar">
          <button className="burger" aria-label="Открыть меню" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><List size={24} /></button>
          <div><span className="eyebrow">Проект по учебной деятельности</span><h1>Платный приём — 2026</h1><p>Полная картина по договорам, людям, приоритетам и оплатам</p></div>
          <div className="snapshot"><span>Срез выгрузки</span><b>{dateTime.format(new Date(data.current.snapshotAt))}</b><small>Агрегаты опубликованы {dateTime.format(new Date(data.current.publishedAt))}</small></div>
        </header>

        <section className="filter-panel">
          <button className="filter-toggle" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen}><Funnel size={19} /> Фильтры <CaretDown className={filtersOpen ? 'rotate' : ''} /></button>
          <div className={`filters ${filtersOpen ? 'filters--open' : ''}`}>
            <Select label="Уровень" value={filters.level} options={levels} onChange={(value) => updateFilter('level', value)} testId="filter-level" />
            <Select label="Форма" value={filters.form} options={forms} onChange={(value) => updateFilter('form', value)} testId="filter-form" />
            <Select label="Факультет / институт" value={filters.faculty} options={faculties} onChange={(value) => updateFilter('faculty', value)} testId="filter-faculty" />
            <Select label="Направление" value={filters.direction} options={directions} onChange={(value) => updateFilter('direction', value)} testId="filter-direction" />
            <Select label="Приоритет" value={filters.priority} options={priorities} onChange={(value) => updateFilter('priority', value)} testId="filter-priority" />
            <Select label="Гражданство" value={filters.citizenship} options={['Россия', 'Иностранное']} onChange={(value) => updateFilter('citizenship', value)} testId="filter-citizenship" />
            <Select label="Скидка" value={filters.discount} options={['Без скидки', 'Есть скидка']} onChange={(value) => updateFilter('discount', value)} testId="filter-discount" />
          </div>
          <p className="filter-note">Фактические показатели реагируют на все фильтры. Цель ПФХД пересчитывается по уровню, форме, факультету и направлению; она не делится искусственно по гражданству, скидке или приоритету.</p>
        </section>

        <div className="level-order" aria-label="Порядок уровней">{LEVEL_ORDER.map((level, index) => <span key={level}><b>{index + 1}</b>{level}</span>)}</div>

        <section className="kpi-strip" aria-label="Ключевые показатели">
          <Metric icon={CurrencyRub} label="Оплачено по выгрузке" value={formatMoney(actual.reportedPayment)} detail={isGlobal ? `${percent(actual.reportedPayment, globalTarget)} от общей цели 178 млн ₽` : 'Финансовый факт выбранного среза'} tone="red" progress={financialProgress} />
          <Metric icon={CheckCircle} label="ПФХД / маркетинг" value={`${count.format(plans.pfhdTarget)} / ${count.format(plans.marketingTarget)}`} detail="Цель выбранного академического среза" />
          <Metric icon={Target} label={isGlobal ? 'Осталось до 178 млн ₽' : 'Осталось до ПФХД'} value={isGlobal ? formatMoney(Math.max(globalTarget - actual.reportedPayment, 0)) : `${count.format(Math.max(plans.pfhdTarget - actual.paid, 0))} договоров`} detail={isGlobal ? 'Общая финансовая цель университета' : `${percent(actual.paid, plans.pfhdTarget)} по оплаченным договорам`} progress={isGlobal ? null : paidProgress} />
          <Metric icon={Wallet} label="Портфель" value={formatMoney(actual.portfolio)} detail="Уникальные подписанные договоры после скидки" />
          <Metric icon={UsersThree} label="Уникальные люди" value={count.format(uniquePeople)} detail={`${count.format(actual.contracts)} уникальных договоров в срезе`} />
          <Metric icon={TrendUp} label="Договоры" value={`${count.format(actual.active)} / ${count.format(actual.signed)} / ${count.format(actual.paid)}`} detail="Активные / подписанные / оплаченные" />
          <Metric icon={Database} label="После удаления дублей" value={formatMoney(actual.uniqueContractPayment)} detail={`Разница ${formatMoney(duplicateDelta)} · ${count.format(data.current.quality.duplicateContracts)} повторов`} tone="soft" />
          <Metric icon={ChartLineUp} label="Результат 2025" value={formatMoney(data.current.metrics.reference2025)} detail="Справочный ориентир, не цель 2026 года" tone="soft" />
        </section>

        <ComparisonChart rows={chartRows} />
        <Reconciliation current={data.current} />

        <section className="panel" id="faculties">
          <div className="panel__heading"><div><span className="eyebrow">Оперативный срез</span><h2>Уровни, формы, факультеты и направления</h2><p>Разделы идут в порядке: бакалавриат и специалитет, магистратура, аспирантура. Внутри — очная, очно-заочная и заочная формы.</p></div><span className="source-badge"><Database size={16} /> ПФХД + выгрузка договоров</span></div>
          {chartRows.length ? <FacultySections planRows={filteredPlan} segments={filteredSegments} snapshot={data.current} filters={filters} /> : <div className="empty">В выбранном срезе нет договоров и плановых записей.</div>}
        </section>

        <TuitionReference segments={filteredSegments} />
        <PriorityTable rows={data.current.breakdowns.priorities} />
        <Quality quality={data.current.quality} />
        <footer className="page-footer"><span>Московский Политех · платный приём 2026</span><span><ShieldCheck size={16} /> Только агрегированные данные</span></footer>
      </main>
    </div>
  )
}
