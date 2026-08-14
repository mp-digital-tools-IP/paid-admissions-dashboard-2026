function makeIcon(glyph) {
  return function Icon({ size = 20, className = '' }) {
    return <span className={`glyph-icon ${className}`} style={{ fontSize: `${size}px` }} aria-hidden="true">{glyph}</span>
  }
}

export const Buildings = makeIcon('▦')
export const CaretDown = makeIcon('⌄')
export const ChartLineUp = makeIcon('↗')
export const CheckCircle = makeIcon('✓')
export const CurrencyRub = makeIcon('₽')
export const Database = makeIcon('◫')
export const Funnel = makeIcon('▽')
export const List = makeIcon('☰')
export const ShieldCheck = makeIcon('◇')
export const Target = makeIcon('◎')
export const TrendUp = makeIcon('↗')
export const UsersThree = makeIcon('●')
export const Wallet = makeIcon('▰')
export const X = makeIcon('×')
