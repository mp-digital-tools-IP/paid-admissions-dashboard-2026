import { useEffect, useMemo, useState } from 'react'
import {
  Buildings, CaretDown, ChartLineUp, CheckCircle, CurrencyRub, Database, Funnel,
  List, ShieldCheck, Target, TrendUp, UsersThree, Wallet, X,
} from './icons.jsx'
import {
  ALL, FORM_ORDER, LEVEL_ORDER, canonicalFaculty, completionLabel, defaultFilters, filterPlan, filterSegments,
  groupDirections, groupFaculty, planTotals, sumRows, uniquePeopleFor,
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
                  <thead><tr><th>Направление</th><th>Стоимость семестра</th><th>ПФХД</th><th>Маркетинг</th><th>Договоры</th><th>Подписаны</th><th>Оплачены</th><th>Приоритеты 1 / 2 / другие</th><th>Россия / иностранное</th><th>Портфель</th><th>Оплата</th><th>Выполнение</th></tr></thead>
                  <tbody>
                    {directions.map((row) => (
                      <tr key={row.key} className={row.unmatched ? 'row-warning' : ''}>
                        <td><b>{row.code} · {row.directionName}</b><small>{row.level} · {row.form}{row.unmatched ? ' · Нет плана ПФХД' : ''}</small></td>
                        <td>{row.listPriceMin == null ? '—' : row.listPriceMin === row.listPriceMax ? formatMoney(row.listPriceMin) : `${formatMoney(row.listPriceMin)}–${formatMoney(row.listPriceMax)}`}</td>
                        <td>{count.format(row.pfhdTarget)}</td><td>{count.format(row.marketingTarget)}</td><td>{count.format(row.contracts)}</td><td>{count.format(row.signed)}</td><td>{count.format(row.paid)}</td>
                        <td>{count.format(row.priorityOne)} / {count.format(row.priorityTwo)} / {count.format(row.priorityOther)}</td>
                        <td>{count.format(row.russiaContracts)} / {count.format(row.foreignContracts)}</td><td>{formatMoney(row.portfolio)}</td><td>{formatMoney(row.reportedPayment)}</td>
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


function TuitionReference({ segments }) {
  const grouped = new Map()
  for (const row of segments) {
    const key = `${row.level}|${row.code}`
    const current = grouped.get(key) || { key, level: row.level, code: row.code, directionName: row.directionName, rows: [] }
    current.rows.push(row)
    grouped.set(key, current)
  }
  const rows = [...grouped.values()].map((row) => ({
    ...row,
    form: FORM_ORDER.filter((form) => row.rows.some((item) => item.form === form)).join(', '),
    ...sumRows(row.rows),
  })).sort((a, b) => {
    const level = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
    return level || a.code.localeCompare(b.code, 'ru')
  })
  return (
    <details className="panel reference-panel" id="tuition">
      <summary><span><span className="eyebrow">Справочно</span><b>Стоимость обучения</b></span><CaretDown size={20} /></summary><p className="reference-intro">Стоимость семестра из текущей выгрузки договоров. Таблица реагирует на выбранные фильтры.</p>
      <div className="table-scroll compact-table"><table><thead><tr><th>Направление</th><th>Уровень</th><th>Форма</th><th>Стоимость семестра</th><th>Договоры с данными</th><th>Сумма без скидки</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.key}><td><b>{row.code} · {row.directionName}</b></td><td>{row.level}</td><td>{row.form}</td><td>{row.listPriceMin == null ? '—' : row.listPriceMin === row.listPriceMax ? formatMoney(row.listPriceMin) : `${formatMoney(row.listPriceMin)}–${formatMoney(row.listPriceMax)}`}</td><td>{count.format(row.contracts)}</td><td>{formatMoney(row.listPriceTotal)}</td></tr>)}
      </tbody></table></div>
    </details>
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
  const facultyRows = useMemo(() => data ? groupFaculty(filteredPlan, filteredSegments, data.current, filters) : [], [data, filteredPlan, filteredSegments, filters])

  if (error) return <main className="load-state"><Database size={42} /><h1>Данные недоступны</h1><p>{error}</p></main>
  if (!data) return <main className="load-state"><span className="loader" /><p>Загружаем проверенный срез…</p></main>

  const levels = LEVEL_ORDER.filter((level) => data.plan.records.some((row) => row.level === level))
  const forms = FORM_ORDER.filter((form) => data.plan.records.some((row) => (filters.level === ALL || row.level === filters.level) && row.form === form))
  const basePlan = data.plan.records.filter((row) => (filters.level === ALL || row.level === filters.level) && (filters.form === ALL || row.form === filters.form))
  const faculties = [...new Set(basePlan.flatMap((row) => row.facultyScopes.map(canonicalFaculty)))].sort((a, b) => a.localeCompare(b, 'ru'))
  const directionRows = filterPlan(basePlan, { ...defaultFilters, level: filters.level, form: filters.form, faculty: filters.faculty })
  const directions = [...new Map(directionRows.map((row) => [row.code, { value: row.code, label: `${row.code} · ${row.directionName}` }])).values()].sort((a, b) => a.value.localeCompare(b.value, 'ru'))
  const priorities = (data.current.dimensions.priorities || []).map((value) => ({ value: String(value), label: value === 0 ? '0 / не указан' : `Приоритет ${value}` }))
  const isGlobal = Object.values(filters).every((value) => value === ALL)
  const globalTarget = data.current.metrics.financialTarget
  const financialProgress = isGlobal ? (actual.reportedPayment / globalTarget) * 100 : null
  const paidProgress = plans.pfhdTarget ? (actual.paid / plans.pfhdTarget) * 100 : null

  return (
    <div className="app-shell">
      {menuOpen && <button className="backdrop" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <button className="mobile-close" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}><X size={22} /></button>
        <img src={`${import.meta.env.BASE_URL}assets/polytech_logo_main_RGB_RUS.png`} alt="Московский Политех" />
        <div className="sidebar__product"><span>Оперативный дашборд</span><b>Платный приём · 2026</b></div>
        <nav aria-label="Разделы"><a href="#overview" onClick={() => setMenuOpen(false)}><ChartLineUp size={20} /> Обзор</a><a href="#faculties" onClick={() => setMenuOpen(false)}><UsersThree size={20} /> Факультеты</a><a href="#tuition" onClick={() => setMenuOpen(false)}><Wallet size={20} /> Стоимость</a></nav>
        <div className="sidebar__footer"><ShieldCheck size={18} /><span><b>Без персональных данных</b><small>Публичные агрегаты</small></span></div>
      </aside>

      <main className="workspace" id="overview">
        <header className="topbar">
          <button className="burger" aria-label="Открыть меню" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><List size={24} /></button>
          <div><span className="eyebrow">Проект по учебной деятельности</span><h1>Платный приём — 2026</h1><p>Общая картина университета и оперативные срезы факультетов</p></div>
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
            <button className="reset-filters" type="button" onClick={() => setFilters(defaultFilters)} disabled={isGlobal}><X size={17} /> Сбросить</button>
          </div>
          <p className="filter-note">Все цифры ниже сразу пересчитываются по выбранному срезу. ПФХД и маркетинговая цель зависят от уровня, формы, факультета и направления.</p>
        </section>

        <section className="kpi-strip" aria-label="Ключевые показатели">
          <Metric icon={CurrencyRub} label="Оплачено по выгрузке" value={formatMoney(actual.reportedPayment)} detail={isGlobal ? `${percent(actual.reportedPayment, globalTarget)} от общей цели 178 млн ₽` : 'Финансовый факт выбранного среза'} tone="red" progress={financialProgress} />
          <Metric icon={CheckCircle} label="ПФХД / маркетинг" value={`${count.format(plans.pfhdTarget)} / ${count.format(plans.marketingTarget)}`} detail="Цель выбранного академического среза" />
          <Metric icon={Target} label={isGlobal ? 'Осталось до 178 млн ₽' : 'Осталось до ПФХД'} value={isGlobal ? formatMoney(Math.max(globalTarget - actual.reportedPayment, 0)) : `${count.format(Math.max(plans.pfhdTarget - actual.paid, 0))} договоров`} detail={isGlobal ? 'Общая финансовая цель университета' : `${percent(actual.paid, plans.pfhdTarget)} по оплаченным договорам`} progress={isGlobal ? null : paidProgress} />
          <Metric icon={Wallet} label="Портфель" value={formatMoney(actual.portfolio)} detail="Уникальные подписанные договоры после скидки" />
          <Metric icon={UsersThree} label="Уникальные люди" value={count.format(uniquePeople)} detail={`${count.format(actual.contracts)} уникальных договоров в срезе`} />
          <Metric icon={TrendUp} label="Договоры" value={`${count.format(actual.active)} / ${count.format(actual.signed)} / ${count.format(actual.paid)}`} detail="Активные / подписанные / оплаченные" />
        </section>
        <p className="year-reference">Для сравнения: оплачено в 2025 году — <b>{formatMoney(data.current.metrics.reference2025)}</b></p>

        <section className="panel" id="faculties">
          <div className="panel__heading"><div><span className="eyebrow">Оперативный срез</span><h2>{filters.faculty === ALL ? 'Факультеты и направления' : filters.faculty}</h2><p>Каждый факультет показан один раз. Уровень, форма, приоритет и гражданство меняются фильтрами выше.</p></div><span className="source-badge"><Database size={16} /> ПФХД + договоры</span></div>
          {facultyRows.length ? <FacultyTable facultyRows={facultyRows} planRows={filteredPlan} segments={filteredSegments} /> : <div className="empty">В выбранном срезе нет договоров и плановых записей.</div>}
        </section>

        <TuitionReference segments={filteredSegments} />
        <footer className="page-footer"><span>Московский Политех · платный приём 2026</span><span><ShieldCheck size={16} /> Только агрегированные данные</span></footer>
      </main>
    </div>
  )
}
