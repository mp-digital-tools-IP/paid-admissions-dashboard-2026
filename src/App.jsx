import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Buildings,
  CaretDown,
  ChartLineUp,
  CheckCircle,
  CurrencyRub,
  Database,
  Funnel,
  List,
  ShieldCheck,
  Target,
  TrendUp,
  UsersThree,
  Wallet,
  X,
} from './icons.jsx'
import {
  ALL,
  completionLabel,
  defaultFilters,
  filterPlan,
  filterSegments,
  groupDirections,
  groupFaculty,
  planTotals,
  sumRows,
} from './dataUtils.js'

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const count = new Intl.NumberFormat('ru-RU')
const dateTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Moscow' })

function formatMoney(value) {
  return `${money.format(value || 0)} ₽`
}

function percent(value, target) {
  return target ? `${((value / target) * 100).toFixed(1).replace('.', ',')}%` : 'Нет плана'
}

function Select({ label, value, options, onChange, testId }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId}>
        <option value={ALL}>{ALL}</option>
        {options.map((option) => (
          <option key={typeof option === 'string' ? option : option.value} value={typeof option === 'string' ? option : option.value}>
            {typeof option === 'string' ? option : option.label}
          </option>
        ))}
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

function TrendChart({ points }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * ratio
    canvas.height = height * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.clearRect(0, 0, width, height)
    const padding = { left: 20, right: 12, top: 18, bottom: 25 }
    const series = [
      { key: 'payment', color: '#ed1b2f' },
      { key: 'portfolio', color: '#1b1b1b' },
    ]
    const max = Math.max(1, ...points.flatMap((point) => series.map((item) => point.metrics[item.key] || 0)))
    ctx.strokeStyle = '#e5e5e5'
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i += 1) {
      const y = padding.top + ((height - padding.top - padding.bottom) * i) / 3
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke()
    }
    series.forEach((item) => {
      ctx.strokeStyle = item.color
      ctx.lineWidth = 3
      ctx.beginPath()
      points.forEach((point, index) => {
        const x = points.length === 1 ? width / 2 : padding.left + ((width - padding.left - padding.right) * index) / (points.length - 1)
        const y = height - padding.bottom - ((height - padding.top - padding.bottom) * (point.metrics[item.key] || 0)) / max
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
      })
      ctx.stroke()
    })
    ctx.fillStyle = '#686868'; ctx.font = '12px Gilroy, sans-serif'; ctx.fillText(points.at(-1)?.date || 'Нет данных', padding.left, height - 6)
  }, [points])
  return <canvas ref={canvasRef} className="trend-canvas" aria-label="Динамика фактической оплаты и портфеля подписанных договоров" />
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
              <span className="faculty-card__title"><Buildings size={20} /><span><b>{faculty.name}</b>{faculty.joint && <em>Совместная программа — план не делится между факультетами</em>}</span></span>
              <span><small>ПФХД</small><b>{count.format(faculty.pfhdTarget)}</b></span>
              <span><small>Подписано</small><b>{count.format(faculty.signed)}</b></span>
              <span><small>Оплачено</small><b>{count.format(faculty.paid)}</b></span>
              <span><small>Оплата</small><b>{formatMoney(faculty.payment)}</b></span>
              <CaretDown className={isOpen ? 'rotate' : ''} size={20} />
            </button>
            {isOpen && (
              <div className="table-scroll" data-testid="direction-table">
                <table>
                  <thead><tr><th>Направление / форма</th><th>Стоимость семестра</th><th>ПФХД</th><th>Маркетинг</th><th>Активные</th><th>Подписанные</th><th>Оплаченные</th><th>Скидка</th><th>Портфель</th><th>Оплата</th><th>Выполнение</th></tr></thead>
                  <tbody>
                    {directions.map((row) => (
                      <tr key={row.key}>
                        <td><b>{row.code} · {row.directionName}</b><small>{row.level} · {row.form}</small></td>
                        <td>{row.listPriceMin == null ? '—' : row.listPriceMin === row.listPriceMax ? formatMoney(row.listPriceMin) : `${formatMoney(row.listPriceMin)}–${formatMoney(row.listPriceMax)}`}</td>
                        <td>{count.format(row.pfhdTarget)}</td><td>{count.format(row.marketingTarget)}</td><td>{count.format(row.active)}</td><td>{count.format(row.signed)}</td><td>{count.format(row.paid)}</td>
                        <td>{row.active ? `${count.format(row.discounted)} · ${Math.round((row.discounted / row.active) * 100)}%` : '—'}</td><td>{formatMoney(row.portfolio)}</td><td>{formatMoney(row.payment)}</td><td><span className={row.pfhdTarget ? 'status' : 'status status--neutral'}>{completionLabel(row.paid, row.pfhdTarget)}</span></td>
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

function Quality({ quality }) {
  const items = [
    ['Точные дубли договоров', quality.duplicateContracts, 'Исключены из расчёта'],
    ['Несопоставленные направления', quality.unmatchedDirections, 'Обновление блокируется, если больше нуля'],
    ['Ошибки групповых формул ПФХД', quality.planReconciliation.formulaErrors, quality.planReconciliation.status],
    ['Расхождения суммы после скидки', quality.discountFormulaMismatches, 'Показаны как факт, без исправления'],
    ['Частичные оплаты', quality.partialPayments, 'Оплата меньше суммы договора'],
    ['Оплаты сверх суммы договора', quality.overpayments, 'Не ограничиваются искусственно'],
    ['Оплата без статуса «Подписан»', quality.paymentsWithoutSignedStatus, 'Требует операционной проверки'],
    ['Сопоставленные коды', quality.matchedDirectionCodes, 'Все фактические коды выгрузки'],
  ]
  return (
    <section className="panel" id="quality" data-testid="quality-panel">
      <div className="panel__heading"><div><span className="eyebrow">Контроль загрузки</span><h2>Качество данных</h2></div><span className="source-badge"><ShieldCheck size={16} /> Без персональных данных</span></div>
      <div className="quality-grid">
        {items.map(([label, value, detail]) => <article key={label}><strong>{count.format(value)}</strong><b>{label}</b><small>{detail}</small></article>)}
      </div>
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

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, ...(key === 'level' || key === 'faculty' ? { direction: ALL } : {}) }))
  const filteredSegments = useMemo(() => data ? filterSegments(data.current.segments, filters) : [], [data, filters])
  const filteredPlan = useMemo(() => data ? filterPlan(data.plan.records, filters) : [], [data, filters])
  const actual = useMemo(() => sumRows(filteredSegments), [filteredSegments])
  const plans = useMemo(() => planTotals(filteredPlan), [filteredPlan])
  const facultyRows = useMemo(() => groupFaculty(filteredPlan, filteredSegments), [filteredPlan, filteredSegments])

  if (error) return <main className="load-state"><Database size={42} /><h1>Данные недоступны</h1><p>{error}</p></main>
  if (!data) return <main className="load-state"><span className="loader" /><p>Загружаем проверенный срез…</p></main>

  const levels = [...new Set(data.plan.records.map((row) => row.level))]
  const forms = [...new Set(data.plan.records.filter((row) => filters.level === ALL || row.level === filters.level).map((row) => row.form))]
  const faculties = [...new Set(data.plan.records.filter((row) => (filters.level === ALL || row.level === filters.level) && (filters.form === ALL || row.form === filters.form)).flatMap((row) => row.facultyScopes))].sort((a, b) => a.localeCompare(b, 'ru'))
  const directions = [...new Map(data.plan.records.filter((row) => (filters.level === ALL || row.level === filters.level) && (filters.form === ALL || row.form === filters.form) && (filters.faculty === ALL || row.facultyScopes.includes(filters.faculty))).map((row) => [`${row.code}|${row.directionName}`, { value: `${row.code}|${row.directionName}`, label: `${row.code} · ${row.directionName}` }])).values()]
  const target = data.current.metrics.financialTarget
  const progress = (actual.payment / target) * 100
  const signedProgress = plans.pfhdTarget ? (actual.signed / plans.pfhdTarget) * 100 : null
  const paidProgress = plans.pfhdTarget ? (actual.paid / plans.pfhdTarget) * 100 : null

  return (
    <div className="app-shell">
      {menuOpen && <button className="backdrop" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <button className="mobile-close" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}><X size={22} /></button>
        <img src={`${import.meta.env.BASE_URL}assets/polytech_logo_main_RGB_RUS.png`} alt="Московский Политех" />
        <div className="sidebar__product"><span>Оперативный дашборд</span><b>Платный приём · 2026</b></div>
        <nav aria-label="Разделы"><a href="#overview" onClick={() => setMenuOpen(false)}><ChartLineUp size={20} /> Обзор</a><a href="#faculties" onClick={() => setMenuOpen(false)}><UsersThree size={20} /> Факультеты</a><a href="#quality" onClick={() => setMenuOpen(false)}><ShieldCheck size={20} /> Качество данных</a></nav>
        <div className="sidebar__footer"><ShieldCheck size={18} /><span><b>Без персональных данных</b><small>Публичные агрегаты</small></span></div>
      </aside>

      <main className="workspace" id="overview">
        <header className="topbar">
          <button className="burger" aria-label="Открыть меню" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><List size={24} /></button>
          <div><span className="eyebrow">Проект по учебной деятельности</span><h1>Платный приём — 2026</h1><p>Договоры, оплаты и выполнение плана ПФХД по направлениям</p></div>
          <div className="snapshot"><span>Срез выгрузки</span><b>{dateTime.format(new Date(data.current.snapshotAt))}</b><small>Агрегаты опубликованы {dateTime.format(new Date(data.current.publishedAt))}</small></div>
        </header>

        <section className="filter-panel">
          <button className="filter-toggle" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen}><Funnel size={19} /> Фильтры <CaretDown className={filtersOpen ? 'rotate' : ''} /></button>
          <div className={`filters ${filtersOpen ? 'filters--open' : ''}`}>
            <Select label="Уровень" value={filters.level} options={levels} onChange={(value) => updateFilter('level', value)} testId="filter-level" />
            <Select label="Форма" value={filters.form} options={forms} onChange={(value) => updateFilter('form', value)} testId="filter-form" />
            <Select label="Факультет" value={filters.faculty} options={faculties} onChange={(value) => updateFilter('faculty', value)} testId="filter-faculty" />
            <Select label="Направление" value={filters.direction} options={directions} onChange={(value) => updateFilter('direction', value)} testId="filter-direction" />
            <Select label="Гражданство" value={filters.citizenship} options={['Россия', 'Иностранное']} onChange={(value) => updateFilter('citizenship', value)} testId="filter-citizenship" />
            <Select label="Скидка" value={filters.discount} options={['Без скидки', 'Есть скидка']} onChange={(value) => updateFilter('discount', value)} testId="filter-discount" />
          </div>
          {(filters.citizenship !== ALL || filters.discount !== ALL) && <p className="filter-note">Гражданство и скидка сужают фактические договоры; план ПФХД остаётся планом выбранного направления.</p>}
        </section>

        <section className="kpi-strip" aria-label="Ключевые показатели">
          <Metric icon={CurrencyRub} label="Оплачено" value={formatMoney(actual.payment)} detail={`${percent(actual.payment, target)} от цели 178 млн ₽`} tone="red" progress={progress} />
          <Metric icon={Target} label="Осталось до цели" value={formatMoney(Math.max(target - actual.payment, 0))} detail={actual.payment > target ? `Сверх цели ${formatMoney(actual.payment - target)}` : 'До финансового плана ПФХД'} />
          <Metric icon={Wallet} label="Портфель" value={formatMoney(actual.portfolio)} detail="Подписанные договоры после скидки" />
          <Metric icon={UsersThree} label="Договоры" value={`${count.format(actual.active)} / ${count.format(actual.signed)} / ${count.format(actual.paid)}`} detail="Активные / подписанные / оплаченные" />
          <Metric icon={CheckCircle} label="План в договорах" value={`${count.format(plans.pfhdTarget)} / ${count.format(plans.marketingTarget)}`} detail="ПФХД / маркетинговая цель" />
          <Metric icon={TrendUp} label="Выполнение ПФХД" value={`${signedProgress == null ? 'Нет плана' : `${Math.round(signedProgress)}%`} / ${paidProgress == null ? 'Нет плана' : `${Math.round(paidProgress)}%`}`} detail="По подписанным / по оплаченным" progress={paidProgress} />
          <Metric icon={ChartLineUp} label="Результат 2025" value={formatMoney(data.current.metrics.reference2025)} detail="Справочный ориентир, не цель 2026 года" tone="soft" />
        </section>

        <section className="dashboard-grid">
          <article className="panel chart-panel">
            <div className="panel__heading"><div><span className="eyebrow">День за днём</span><h2>Финансовая динамика</h2></div><div className="legend"><span><i className="red" /> Оплата</span><span><i /> Портфель</span></div></div>
            <TrendChart points={data.history.points} />
            <div className="trend-bottom"><span>Подписано <b>{count.format(actual.signed)}</b></span><span>Оплачено <b>{count.format(actual.paid)}</b></span><small>История начинается с первого загруженного среза</small></div>
          </article>
          <article className="panel target-panel"><span className="eyebrow">Финансовая цель</span><h2>178 млн ₽ — минимум кампании</h2><div className="target-ring" style={{ '--progress': `${Math.min(progress, 100) * 3.6}deg` }}><div><b>{progress.toFixed(1).replace('.', ',')}%</b><span>оплачено</span></div></div><p>Портфель подписанных договоров уже составляет <b>{formatMoney(actual.portfolio)}</b>. Факт оплаты учитывается отдельно и не ограничивается суммой договора.</p></article>
        </section>

        <section className="panel" id="faculties">
          <div className="panel__heading"><div><span className="eyebrow">Оперативный срез</span><h2>Факультеты и направления</h2><p>Нажмите на факультет, чтобы раскрыть направления и формы обучения.</p></div><span className="source-badge"><Database size={16} /> Выгрузка договоров</span></div>
          {facultyRows.length ? <FacultyTable facultyRows={facultyRows} planRows={filteredPlan} segments={filteredSegments} /> : <div className="empty">В выбранном срезе нет договоров и плановых записей.</div>}
        </section>

        <Quality quality={data.current.quality} />
        <footer className="page-footer"><span>Московский Политех · платный приём 2026</span><span><ShieldCheck size={16} /> Только агрегированные данные</span></footer>
      </main>
    </div>
  )
}
