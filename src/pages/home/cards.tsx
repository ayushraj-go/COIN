// Sourcing Home cards: hero gauge, bucket cards, KPI group A strip, leakage callout, finance & management panels
import React, { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useStore } from '../../store/useStore'
import type { Bucket } from '../../lib/types'
import { BUCKET_STYLE, ideaAnnualised, isHard } from '../../lib/calc'
import { KPIS, LEAKAGE_NOTE } from '../../lib/scope'
import { addMonthsYm, fmtDate, fmtDateTime, inrShort, monthLabel, monthLong, monthShort, pct, sum, thirdWorkingDay } from '../../lib/format'
import { Badge, Button, Card, Count, EmptyState, Gauge, Icon, InfoTip, LeverChip, Money, ProgressBar, SavingsTypeBadge, SlaPill, Sparkline, StageBadge, Stagger, cn } from '../../components/ui'
import type { HomeData } from './data'
import { BUCKETS } from './data'
import { BucketFilterChip, slaFrom, useDrill } from './shared'

const kpi = (id: string) => KPIS.find((k) => k.id === id)
const KTip = ({ id, extra }: { id: string; extra?: React.ReactNode }) => {
  const k = kpi(id)
  if (!k) return null
  return <InfoTip title={`${k.id} · ${k.kpi}`} formula={k.formula}><span>Cut by: {k.cut}{extra ? <><br />{extra}</> : null}</span></InfoTip>
}

/** Plain-language scope of the active filters */
export function useScopeLabel() {
  const { filters, commodities, categories, users, plants } = useStore()
  const me = useStore((s) => s.users.find((u) => u.id === s.userId))
  const parts: string[] = []
  if (filters.commodity !== 'All') parts.push(commodities.find((c) => c.code === filters.commodity)?.name ?? filters.commodity)
  else if (filters.categoryId !== 'All') parts.push(categories.find((c) => c.id === filters.categoryId)?.name ?? filters.categoryId)
  else if (me && !me.roles.some((r) => ['head', 'finance', 'mgmt', 'admin'].includes(r)) && me.commodities.length) parts.push(`My commodities: ${me.commodities.map((c) => commodities.find((x) => x.code === c)?.name.split(' (')[0] ?? c).join(', ')}`)
  else parts.push('All commodities')
  if (filters.buyerId !== 'All') parts.push(`Buyer ${users.find((u) => u.id === filters.buyerId)?.name ?? ''}`)
  if (filters.plant !== 'All') parts.push(plants.find((p) => p.id === filters.plant)?.name ?? filters.plant)
  if (filters.buyingType !== 'All') parts.push(filters.buyingType)
  if (filters.quarter !== 'All') parts.push(`${filters.quarter} submissions`)
  return parts.join(' · ')
}

// ─── Bucket cards (count + ₹) — click filters the page below ──────────────────
const BUCKET_ICON: Record<string, string> = { Pipeline: 'Filter', 'In Execution': 'Rocket', Implemented: 'CircleCheckBig', Dropped: 'CircleSlash' }
const BUCKET_TIP: Record<string, string> = {
  Pipeline: 'Submitted and moving through buyer validation, feasibility, technical evaluation or approval. Value = Σ annualised impact.',
  'In Execution': 'Approved ideas in the Execution Hub — NPD sample, PAP price revision or execution — until marked Done or Dropped.',
  Implemented: 'Marked Done with an effective date and approved price; realisation now flows from actual MRN.',
  Dropped: 'Dropped or rejected with a mandatory reason code; its value no longer counts as committed.',
}

function BucketCard({ bucket, d, active, onClick }: { bucket: Exclude<Bucket, 'Draft'>; d: HomeData; active: boolean; onClick: () => void }) {
  const st = BUCKET_STYLE[bucket]
  const ref = useRef<HTMLButtonElement>(null)
  const count = d.summary.counts[bucket]
  const value = d.summary.values[bucket]
  const totalActive = sum(BUCKETS.filter((b) => b !== 'Dropped').map((b) => d.summary.values[b]))
  const flow = d.flows[bucket]
  const good = flow.delta == null ? null : bucket === 'Dropped' ? flow.delta <= 0 : flow.delta >= 0
  return (
    <button ref={ref} onClick={onClick}
      onMouseMove={(e) => { const r = ref.current!.getBoundingClientRect(); ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`); ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`) }}
      className={cn('group relative overflow-hidden card text-left p-4 h-full w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgb(36_89_224/.55)] focus-ring')}
      style={{ background: `linear-gradient(160deg, ${st.soft} 0%, #ffffff 58%)`, ...(active ? { boxShadow: `inset 0 0 0 1.5px ${st.color}` } : {}) }}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${st.color}, ${st.color}55)` }} />
      <div className="relative flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${st.color}, ${st.text})`, boxShadow: `0 6px 14px -8px ${st.color}` }}><Icon name={BUCKET_ICON[bucket]} size={14} strokeWidth={2.2} /></span>
          <span className="text-[13px] font-semibold text-ink truncate">{bucket}</span>
          <span onClick={(e) => e.stopPropagation()}><InfoTip title={bucket}>{BUCKET_TIP[bucket]}</InfoTip></span>
        </span>
        {flow.delta != null && (
          <span title="₹ inflow into this bucket: last 3 months vs prior 3 months" className={cn('inline-flex items-center gap-0.5 text-[11px] font-medium rounded-full px-1.5 h-5 shrink-0 border', good ? 'text-[#067647] bg-[#ecfdf3] border-[#abefc6]' : 'text-[#b42318] bg-[#fef3f2] border-[#fecdca]')}>
            <Icon name={flow.delta >= 0 ? 'TrendingUp' : 'TrendingDown'} size={11} />{Math.abs(flow.delta).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="relative flex items-end justify-between gap-2 mt-3">
        <div className="min-w-0">
          <div className="text-[22px] leading-none font-bold tracking-tight text-ink"><Money value={value} /></div>
          <div className="text-[11.5px] text-muted mt-1.5 flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-bold text-ink-2 num"><Count value={count} /></span> idea{count === 1 ? '' : 's'}
            {bucket !== 'Dropped' && totalActive > 0 && <span>· {pct((value / totalActive) * 100, 0)} of active</span>}
          </div>
        </div>
        <div className="shrink-0 opacity-90"><Sparkline data={flow.values} color={st.color} width={78} height={26} /></div>
      </div>
      {active && <div className="relative mt-2 text-[10.5px] font-semibold flex items-center gap-1" style={{ color: st.text }}><Icon name="ArrowDown" size={11} />Filtering the page below</div>}
    </button>
  )
}

export function BucketCards({ d, sel, onSel, layout = 'grid2', className }: { d: HomeData; sel: Bucket | null; onSel: (b: Bucket | null) => void; layout?: 'grid2' | 'row'; className?: string }) {
  return (
    <Stagger className={cn(layout === 'grid2' ? 'grid grid-cols-2 auto-rows-fr gap-3' : 'grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      {BUCKETS.map((b) => <BucketCard key={b} bucket={b} d={d} active={sel === b} onClick={() => onSel(sel === b ? null : b)} />)}
    </Stagger>
  )
}

// ─── Top 5 ideas by value ─────────────────────────────────────────────────────
export function TopIdeasCard({ d, sel, onClear, className }: { d: HomeData; sel: Bucket | null; onClear: () => void; className?: string }) {
  const openIdea = useStore((s) => s.openIdea)
  const drill = useDrill()
  const base = sel ? d.active.filter((i) => i.bucket === sel) : d.active.filter((i) => i.bucket !== 'Dropped')
  const top = [...base].sort((a, b) => ideaAnnualised(b) - ideaAnnualised(a)).slice(0, 5)
  const max = top[0] ? ideaAnnualised(top[0]) : 1
  return (
    <Card className={cn('h-full', className)} bodyClass="flex flex-col" icon="Crown"
      title={<span className="flex items-center gap-2">Top 5 ideas by value<BucketFilterChip bucket={sel} onClear={onClear} /></span>}
      subtitle={`${sel ?? 'Pipeline, In Execution and Implemented'} · by annualised impact`}
      actions={<Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => drill(sel ? { bucket: sel } : {})}>View all</Button>}>
      {top.length ? (
        <div className="flex flex-col">
          {top.map((i, k) => {
            const v = ideaAnnualised(i)
            const st = BUCKET_STYLE[i.bucket]
            return (
              <button key={i.id} onClick={() => openIdea(i.id)} className="group flex items-center gap-3 py-2 px-1.5 -mx-1.5 rounded-lg hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
                <span className="h-7 w-7 rounded-lg grid place-items-center text-[12px] font-bold shrink-0 num" style={{ background: k === 0 ? 'linear-gradient(135deg, #f6ecd9, #e9d3a6)' : '#f1f5f9', color: k === 0 ? '#7a5a22' : '#475569', boxShadow: k === 0 ? 'inset 0 0 0 1px #d9bf8a' : undefined }}>{k + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10.5px] text-muted shrink-0">{i.id}</span>
                    <span className="text-[12.5px] font-semibold text-ink truncate group-hover:text-brand-700">{i.title}</span>
                  </span>
                  <span className="flex items-center gap-2 mt-1 min-w-0 overflow-hidden">
                    <StageBadge stage={i.stage} bucket={i.bucket} />
                    <span className="hidden sm:inline-flex"><LeverChip leverId={i.leverId} compact /></span>
                    {i.savingsType !== 'Hard' && <SavingsTypeBadge type={i.savingsType} />}
                  </span>
                </span>
                <span className="w-[112px] shrink-0 text-right">
                  <span className="block text-[13.5px] font-bold text-ink num">{inrShort(v)}</span>
                  <ProgressBar value={(v / max) * 100} height={4} color={st.color} className="mt-1" />
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <EmptyState icon="Lightbulb" title={`No ideas in ${sel ?? 'this scope'} yet`} desc="Clear the bucket filter or widen the filters above." className="py-6" />
      )}
      {top.length > 0 && (() => {
        const all = sum(base.map((x) => ideaAnnualised(x))) || 1
        const topSum = sum(top.map((x) => ideaAnnualised(x)))
        return (
          <div className="mt-auto pt-2.5 border-t border-line">
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="text-muted flex items-center gap-1">Top 5 concentration<InfoTip title="Concentration">Share of the scope's annualised impact carried by the five largest ideas — a high share means the FY rests on a few ideas.</InfoTip></span>
              <span className="text-ink-2"><b className="text-ink num">{inrShort(topSum)}</b> · <b className="num">{pct((topSum / all) * 100)}</b> of {base.length} ideas' value</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mt-1.5 gap-px">
              {top.map((x, k) => <motion.div key={x.id} initial={{ width: 0 }} animate={{ width: `${(ideaAnnualised(x) / all) * 100}%` }} transition={{ duration: 0.8, delay: k * 0.05 }} title={`${x.id} · ${inrShort(ideaAnnualised(x))}`} style={{ background: BUCKET_STYLE[x.bucket].color, opacity: 1 - k * 0.12 }} />)}
            </div>
          </div>
        )
      })()}
    </Card>
  )
}

// ─── Finance: savings to validate + realisation ───────────────────────────────
export function SavingsToValidateCard({ d, className }: { d: HomeData; className?: string }) {
  const nav = useNavigate()
  const rule = useStore((s) => s.slaRules.find((r) => r.stage === 'Finance validation'))
  const pending = d.ledger.filter((l) => l.financeStatus === 'Pending')
  const queried = d.ledger.filter((l) => l.financeStatus === 'Queried')
  const byStatus = { Validated: sum(d.ledger.filter((l) => l.financeStatus === 'Validated').map((l) => l.realised)), Pending: sum(pending.map((l) => l.realised)), Queried: sum(queried.map((l) => l.realised)) }
  const total = byStatus.Validated + byStatus.Pending + byStatus.Queried || 1
  const months = [...new Set(pending.map((l) => l.month))].sort()
  const exc = { 'Price leakage': 0, 'No MRN received': 0, 'Volume below 50% of plan': 0 } as Record<string, number>
  pending.forEach((l) => l.exceptions.forEach((e) => (exc[e] = (exc[e] ?? 0) + 1)))
  const ideasPending = new Set(pending.map((l) => l.ideaId)).size
  return (
    <Card className={cn('h-full', className)} icon="BadgeIndianRupee" bodyClass="flex flex-col"
      title={<span className="flex items-center gap-1.5">Savings to validate<InfoTip title="Finance validation" formula="Only Finance-validated realised hard savings are reported as realised">Realised saving per part = (baseline − approved price) × MRN quantity. Finance validates or queries each idea's month.</InfoTip></span>}
      subtitle={rule ? `SLA ${rule.slaDays} working days · reminder day ${rule.reminderDay} · escalation to ${rule.escalateTo} on day ${rule.escalateDay}` : undefined}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[26px] leading-none font-extrabold tracking-tight text-ink"><Money value={byStatus.Pending} /></div>
          <div className="text-[12px] text-muted mt-1.5"><b className="text-ink-2 num">{pending.length}</b> ledger lines · <b className="text-ink-2 num">{ideasPending}</b> ideas awaiting validation</div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
          {(['Validated', 'Pending', 'Queried'] as const).map((k) => <motion.div key={k} initial={{ width: 0 }} animate={{ width: `${(byStatus[k] / total) * 100}%` }} transition={{ duration: 0.9 }} style={{ background: k === 'Validated' ? '#0f9f6e' : k === 'Pending' ? '#ec8a1c' : '#e0364f' }} />)}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-600" />Validated {inrShort(byStatus.Validated)}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />Pending {inrShort(byStatus.Pending)}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-600" />Queried {inrShort(byStatus.Queried)}</span>
        </div>
      </div>
      <div className="mt-3 flex-1">
        {months.map((m) => {
          const rows = pending.filter((l) => l.month === m)
          const sla = slaFrom(rows.map((x) => x.postedAt).sort()[0], rule)
          return (
            <div key={m} className="flex items-center justify-between gap-2 py-1.5 border-b border-dashed border-slate-200 last:border-0 rounded -mx-1 px-1">
              <span className="text-[12.5px] font-semibold text-ink">{monthLong(m)}</span>
              <span className="text-[11.5px] text-muted num">{rows.length} lines</span>
              <span className="text-[12.5px] font-bold text-ink num">{inrShort(sum(rows.map((x) => x.realised)))}</span>
              <SlaPill state={sla.state} left={sla.left} working={sla.working} />
            </div>
          )
        })}
        {!months.length && <div className="text-[12.5px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="CheckCheck" size={14} />Nothing pending — every posted month is validated.</div>}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {Object.entries(exc).map(([k, v]) => <Badge key={k} color={v ? (k === 'Price leakage' ? '#e0364f' : '#ec8a1c') : '#94a3b8'} icon={k === 'Price leakage' ? 'TriangleAlert' : k === 'No MRN received' ? 'PackageX' : 'TrendingDown'}>{k} · {v}</Badge>)}
      </div>
      {queried.length > 0 && <div className="text-[11.5px] text-muted mt-2">{queried.length} line{queried.length === 1 ? '' : 's'} queried back to buyers.</div>}
    </Card>
  )
}

export function RealisationCard({ d, className }: { d: HomeData; className?: string }) {
  const lrm = useStore((s) => s.settings.lastRealisationMonth)
  const nav = useNavigate()
  const s = d.summary
  const rate = d.periodCommitted ? (s.realised / d.periodCommitted) * 100 : 0
  const nextMonth = addMonthsYm(lrm, 1)
  const nextRun = thirdWorkingDay(addMonthsYm(lrm, 2))
  const vShare = s.realised ? (s.realisedValidated / s.realised) * 100 : 0
  const max = Math.max(d.periodCommitted, s.realised, 1)
  const bars = [
    { label: `Committed ${monthShort(d.trend[0]?.month ?? lrm)}–${monthLabel(lrm)}`, v: d.periodCommitted, c: '#ec8a1c' },
    { label: 'Realised (MRN-based)', v: s.realised, c: '#0f9f6e' },
    { label: 'Finance validated', v: s.realisedValidated, c: '#0b7a55' },
    { label: 'Price leakage', v: s.leakage, c: '#e0364f' },
  ]
  return (
    <Card className={cn('h-full', className)} bodyClass="flex flex-col" icon="Scale"
      title={<span className="flex items-center gap-1.5">Realisation<KTip id="D3" /></span>}
      subtitle={`FY to date through ${monthLong(lrm)} · realisation rate = realised ÷ committed for the period`}>
      <div className="flex items-end gap-4">
        <div>
          <div className="text-[30px] leading-none font-extrabold tracking-tight" style={{ color: rate >= 95 ? '#0b7a55' : rate >= 80 ? '#c2410c' : '#e0364f' }}><Count value={rate} digits={1} suffix="%" /></div>
          <div className="text-[11.5px] text-muted mt-1">Realisation rate</div>
        </div>
        <div>
          <div className="text-[20px] leading-none font-bold tracking-tight text-ink"><Count value={vShare} digits={1} suffix="%" /></div>
          <div className="text-[11.5px] text-muted mt-1">of realised validated</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {bars.map((b) => (
          <div key={b.label} className="rounded-lg border border-line px-2.5 py-1.5 min-w-0">
            <div className="text-[10.5px] text-muted truncate" title={b.label}>{b.label}</div>
            <div className="text-[13.5px] font-bold num" style={{ color: b.c }}>{inrShort(b.v)}</div>
            <ProgressBar value={(b.v / max) * 100} height={3} color={b.c} className="mt-1" />
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted mb-1">Realised by month · validation status</div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(58px,1fr))] gap-1.5">
          {d.trend.filter((t) => t.realised != null && (t.realised > 0 || (t.validated ?? 0) > 0)).map((t) => {
            const done = (t.validated ?? 0) >= (t.realised ?? 0) - 1
            return (
              <div key={t.month} title={`${monthLong(t.month)} · realised ${inrShort(t.realised ?? 0)} · validated ${inrShort(t.validated ?? 0)}`} className={cn('rounded-lg border px-1.5 py-1 text-center', done ? 'border-emerald-200 bg-emerald-50/60' : 'border-orange-200 bg-orange-50/60')}>
                <div className="text-[10.5px] font-semibold text-muted">{monthShort(t.month)}</div>
                <div className="text-[11.5px] font-bold text-ink num leading-tight">{inrShort(t.realised ?? 0, 1)}</div>
                <div className={cn('text-[10px] font-semibold', done ? 'text-emerald-700' : 'text-orange-600')}>{done ? 'Validated' : 'Pending'}</div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-auto pt-3" />
      <div className="rounded-lg bg-slate-50 border border-line px-3 py-2 text-[11.5px] text-muted flex items-center gap-2">
        <Icon name="CalendarClock" size={14} className="text-ink-2 shrink-0" />
        <span>Next run: <b className="text-ink-2">{fmtDate(nextRun)}</b> (3rd working day) pulls {monthLong(nextMonth)} MRN.</span>
      </div>
    </Card>
  )
}
