// Dashboard body for IN and CO — the internal vs external breakup, in one panel:
// a split bar (internal vs external), then Internal ideas (by commodity / department / individual) beside
// External (supplier) ideas: count, value and share, campaign-sourced ideas, top contributing suppliers.
// IN values = forecast impact; CO values = MRN-realised savings (with committed alongside).
import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { Idea } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { ideaAnnualised, ideaCommitted } from '../../lib/calc'
import { sourceBreakdown, type Seg } from '../../lib/workflow'
import { pct, sum } from '../../lib/format'
import { Avatar, Icon, InfoTip, Modal, Segmented, cn } from '../../components/ui'
import { DrillModal, useDrill } from './shared'
import { useRowsFit } from './fit'

type Tab = 'commodity' | 'department' | 'individual'
const INT = 'var(--color-brand-700)', EXT = 'var(--color-accent-500)'

/** ₹ in Cr / L; small amounts stay in lakh so every figure in the panel reads the same way */
export function money(n: number) {
  const a = Math.abs(n)
  if (!a) return '₹ 0'
  if (a >= 1e7) return `₹ ${(n / 1e7).toFixed(2)} Cr`
  return `₹ ${(n / 1e5).toFixed(2)} L`
}

const Bar = ({ w, color, delay = 0, h = 'h-2' }: { w: number; color: string; delay?: number; h?: string }) => (
  <span className={cn('block rounded-full bg-slate-100 overflow-hidden', h)}>
    <motion.span className="block h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.max(w > 0 ? 2 : 0, Math.min(100, w))}%` }} transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }} />
  </span>
)

/** `fill`: the card takes its parent's height (one-screen dashboards) and shows as many rows as fit — the rest open in a list */
export function SourcesCard({ ideas, mode, fy, className, fill }: { ideas: Idea[]; mode: 'IN' | 'CO'; fy: string; className?: string; fill?: boolean }) {
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const users = useStore((s) => s.users)
  const ledger = useStore((s) => s.ledger)
  const drill = useDrill()
  const [tab, setTab] = useState<Tab>('commodity')
  const [all, setAll] = useState(false)
  const [modal, setModal] = useState<{ title: string; ids: string[] } | null>(null)
  const realisedBy = useMemo(() => { const m = new Map<string, number>(); ledger.forEach((l) => m.set(l.ideaId, (m.get(l.ideaId) ?? 0) + l.realised)); return m }, [ledger])
  const value = (i: Idea) => (mode === 'IN' ? ideaAnnualised(i) : realisedBy.get(i.id) ?? 0)
  const committed = (ids: string[]) => sum(ids.map((id) => { const i = ideas.find((x) => x.id === id); return i ? ideaCommitted(i, fy) : 0 }))
  const s = useMemo(() => sourceBreakdown(ideas, suppliers, value), [ideas, suppliers, mode, realisedBy]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = s.internal.value + s.external.value
  const intShare = total ? (s.internal.value / total) * 100 : 0
  const unit = mode === 'IN' ? 'forecast' : 'realised (MRN)'
  const bucketParam = mode === 'CO' ? { bucket: 'In Execution,Implemented' } : {}
  const segs: Seg[] = tab === 'commodity' ? s.internal.byCommodity : tab === 'department' ? s.internal.byDepartment : s.internal.byIndividual
  const [rowsRef, fitRows] = useRowsFit(34, 8, 3, segs.length, 30)
  const shown = segs.slice(0, fill ? fitRows : 8)
  const maxSeg = Math.max(1, ...segs.map((x) => (mode === 'IN' ? x.value : x.value || x.count)))
  const segTotal = sum(segs.map((x) => x.value)) || 1
  const label = (x: Seg) => (tab === 'commodity' ? commodities.find((c) => c.code === x.key)?.name ?? x.key : x.label)
  const drillSeg = (x: Seg) => drill({ ...bucketParam, ...(tab === 'commodity' ? { commodity: x.key } : tab === 'department' ? { dept: x.key } : { submitter: x.key }), supplierOnly: 'false' })
  const extSuppliers = useMemo(() => {
    const m = new Map<string, { code: string; n: number; v: number }>()
    ideas.filter((i) => i.isSupplierSubmission).forEach((i) => { const k = i.supplierCode ?? '—'; const r = m.get(k) ?? { code: k, n: 0, v: 0 }; r.n++; r.v += value(i); m.set(k, r) })
    return [...m.values()].sort((a, b) => b.v - a.v || b.n - a.n)
  }, [ideas, mode, realisedBy]) // eslint-disable-line react-hooks/exhaustive-deps
  const [supRef, fitSup] = useRowsFit(32, 5, 1, extSuppliers.length, 0)
  const topSuppliers = extSuppliers.slice(0, fill ? fitSup : 5)
  const supMax = Math.max(1, ...topSuppliers.map((x) => x.v))
  const supName = (code: string) => suppliers.find((x) => x.code === code)?.name ?? code
  const segRow = (x: Seg, k: number) => {
    const u = tab === 'individual' ? users.find((y) => y.id === x.key) : undefined
    const w = ((mode === 'IN' ? x.value : x.value || x.count) / maxSeg) * 100
    return (
      <button key={x.key} onClick={() => drillSeg(x)} className="group grid grid-cols-[18px_minmax(96px,1fr)_minmax(36px,30%)_80px_28px] items-center gap-x-3 rounded-lg px-2 h-[34px] text-left hover:bg-brand-50/70 transition-colors">
        <span className="text-[11px] font-semibold text-muted num">{k + 1}</span>
        <span className="flex items-center gap-2 min-w-0">
          {u ? <Avatar name={u.name} color={u.avatarColor} size={20} /> : <span className="h-5 min-w-[30px] px-1 rounded-md grid place-items-center text-[9.5px] font-bold shrink-0 bg-brand-50 text-brand-700 font-mono">{tab === 'commodity' ? x.key : x.key.slice(0, 3).toUpperCase()}</span>}
          <span className="text-[12.5px] font-medium text-ink truncate group-hover:text-brand-700">{label(x)}</span>
          {u && <span className="hidden sm:inline text-[11px] text-muted truncate">{u.department}</span>}
        </span>
        <span className="flex items-center gap-2 min-w-0"><span className="flex-1 min-w-0"><Bar w={w} color={k < 3 ? INT : 'var(--color-brand-400)'} delay={k * 0.03} /></span><span className="text-[11px] text-muted num w-8 text-right">{pct((x.value / segTotal) * 100, 0)}</span></span>
        <span className="text-right text-[12.5px] font-semibold text-ink num whitespace-nowrap">{money(x.value)}</span>
        <span className="text-right text-[12px] text-muted num">{x.count}</span>
      </button>
    )
  }
  const t1 = s.external.tier1, t2 = s.external.tier2
  const extCount = s.external.count || 1

  return (
    <section className={cn('card overflow-hidden', fill && 'h-full flex flex-col', className)}>
      {/* header + split bar */}
      <div className="px-5 pt-4 pb-4 [@media(max-height:820px)]:pt-3 [@media(max-height:820px)]:pb-3 border-b border-line shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-8 w-8 rounded-[10px] grid place-items-center bg-brand-50 text-brand-700 shrink-0"><Icon name="GitFork" size={15} /></span>
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">{mode === 'IN' ? 'Internal vs external idea breakup' : 'Internal vs external savings breakup'}
                <InfoTip title="Internal vs external">Internal = ideas raised inside Amber (by commodity, department and employee). External = ideas from suppliers, including those received through campaigns and workshops. {mode === 'IN' ? 'Values are forecast impact.' : 'Values are MRN-realised savings for ideas in execution or implemented.'}</InfoTip>
              </h3>
              <p className="text-[11.5px] text-muted"><b className="text-ink-2 num">{s.internal.count + s.external.count}</b> ideas · <b className="text-ink-2 num">{money(total)}</b> {unit}</p>
            </div>
          </div>
        </div>
        <div className="mt-3.5 [@media(max-height:820px)]:mt-2.5 flex h-2.5 rounded-full overflow-hidden bg-slate-100">
          <motion.span className="h-full" style={{ background: INT }} initial={{ width: 0 }} animate={{ width: `${intShare}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
          <motion.span className="h-full" style={{ background: EXT }} initial={{ width: 0 }} animate={{ width: `${total ? 100 - intShare : 0}%` }} transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px]">
          <span className="flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: INT }} /><b className="text-ink">Internal</b><span className="num">{pct(intShare, 0)}</span><span className="text-muted">· {s.internal.count} ideas · <span className="num">{money(s.internal.value)}</span></span></span>
          <span className="flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: EXT }} /><b className="text-ink">External</b><span className="num">{pct(total ? 100 - intShare : 0, 0)}</span><span className="text-muted">· {s.external.count} ideas · <span className="num">{money(s.external.value)}</span></span></span>
        </div>
      </div>

      <div className={cn('grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]', fill && 'flex-1 min-h-0')}>
        {/* internal */}
        <div className="px-5 py-4 [@media(max-height:820px)]:py-3 xl:border-r border-line min-w-0 min-h-0 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: INT }} /><span className="text-[13px] font-semibold text-ink">Internal ideas</span><span className="text-[11.5px] text-muted">by commodity, department or employee</span></div>
            <Segmented size="sm" value={tab} onChange={(k) => { setTab(k as Tab); setAll(false) }} options={[{ key: 'commodity', label: 'Commodity' }, { key: 'department', label: 'Department' }, { key: 'individual', label: 'Individual' }]} />
          </div>
          <div className="grid grid-cols-[18px_minmax(96px,1fr)_minmax(36px,30%)_80px_28px] items-center gap-x-3 px-2 pb-1 text-[11px] text-muted">
            <span>#</span><span>{tab === 'commodity' ? 'Commodity' : tab === 'department' ? 'Department' : 'Employee'}</span><span>Share</span><span className="text-right">{mode === 'IN' ? 'Forecast' : 'Realised'}</span><span className="text-right">Ideas</span>
          </div>
          <div ref={rowsRef} className={cn('flex flex-col', fill && 'flex-1 min-h-0 overflow-hidden')}>
            {shown.map(segRow)}
            {!segs.length && <div className="text-[12.5px] text-muted py-6 text-center">No internal ideas in this scope.</div>}
            {segs.length > shown.length && (
              <button onClick={() => setAll(true)} className="mt-1 ml-2 self-start inline-flex items-center gap-1 h-6 text-[12px] font-semibold text-brand-700 hover:text-brand-800">
                Show all {segs.length}<Icon name="ArrowUpRight" size={13} />
              </button>
            )}
          </div>
        </div>

        {/* external */}
        <div className="px-5 py-4 [@media(max-height:820px)]:py-3 border-t xl:border-t-0 border-line min-w-0 min-h-0 flex flex-col gap-3.5 [@media(max-height:820px)]:gap-2.5">
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: EXT }} /><span className="text-[13px] font-semibold text-ink">External (supplier) ideas</span></div>
          {/* summary — count, value and share of the total */}
          <button onClick={() => setModal({ title: 'External (supplier) ideas', ids: [...t1.ids, ...t2.ids] })} className="text-left grid grid-cols-3 gap-2 rounded-xl border border-line px-3.5 py-2.5 [@media(max-height:820px)]:py-2 hover:border-[var(--color-slate-300)] hover:bg-slate-50/60 transition-colors">
            <span className="min-w-0"><span className="block text-[11px] text-muted">Ideas</span><span className="block text-[20px] font-bold text-ink num leading-tight">{s.external.count}</span></span>
            <span className="min-w-0"><span className="block text-[11px] text-muted">{mode === 'IN' ? 'Forecast value' : 'Realised (MRN)'}</span><span className="block text-[15px] font-bold text-ink num leading-tight mt-0.5">{money(s.external.value)}</span>{mode === 'CO' && <span className="block text-[11px] text-muted num">{money(committed([...t1.ids, ...t2.ids]))} committed</span>}</span>
            <span className="min-w-0"><span className="block text-[11px] text-muted">Share of total</span><span className="block text-[15px] font-bold text-ink num leading-tight mt-0.5">{pct(total ? 100 - intShare : 0, 0)}</span></span>
          </button>

          <button onClick={() => setModal({ title: 'Campaign-sourced supplier ideas', ids: s.external.viaCampaign.ids })}
            className="flex items-center gap-3 rounded-xl bg-accent-50/70 border border-accent-100 px-3.5 py-2.5 [@media(max-height:820px)]:py-1.5 text-left hover:bg-accent-50 transition-colors">
            <span className="h-8 w-8 rounded-[10px] grid place-items-center shrink-0 bg-white text-accent-600 border border-accent-100"><Icon name="Megaphone" size={15} /></span>
            <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold text-ink">Campaign-sourced ideas</span><span className="block text-[11.5px] text-muted">{pct((s.external.viaCampaign.count / extCount) * 100, 0)} of supplier ideas from campaigns and workshops</span></span>
            <span className="text-right shrink-0"><span className="block text-[18px] font-bold text-ink num leading-tight">{s.external.viaCampaign.count}</span><span className="block text-[11px] text-muted num">{money(s.external.viaCampaign.value)}</span></span>
          </button>

          <div className={cn('min-w-0', fill && 'flex-1 min-h-0 flex flex-col')}>
            <div className="text-[11.5px] font-medium text-muted mb-1">Top contributing suppliers</div>
            <div ref={supRef} className={cn(fill && 'flex-1 min-h-0 overflow-hidden')}>
            {topSuppliers.map((x) => (
              <button key={x.code} onClick={() => drill({ ...bucketParam, supplier: x.code, supplierOnly: 'true' })} className="group w-full grid grid-cols-[minmax(0,1fr)_minmax(40px,26%)_78px] items-center gap-x-3 rounded-lg px-2 -mx-2 h-[32px] text-left hover:bg-slate-50">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[12.5px] font-medium text-ink truncate group-hover:text-brand-700">{supName(x.code)}</span>
                </span>
                <Bar w={(x.v / supMax) * 100} color="var(--color-accent-400)" h="h-1.5" />
                <span className="text-right text-[12px] num"><b className="text-ink">{money(x.v)}</b><span className="text-muted"> · {x.n}</span></span>
              </button>
            ))}
            {!extSuppliers.length && <div className="text-[12.5px] text-muted py-3">No supplier ideas in this scope.</div>}
            </div>
          </div>
        </div>
      </div>

      <Modal open={all} onClose={() => setAll(false)} size="lg" icon="GitFork" title={`Internal ideas by ${tab}`} subtitle={`${segs.length} ${tab === 'individual' ? 'employees' : tab === 'department' ? 'departments' : 'commodities'} · ${money(s.internal.value)} ${unit}`}>
        <div className="flex flex-col">{segs.map(segRow)}</div>
      </Modal>
      <DrillModal open={!!modal} onClose={() => setModal(null)} title={modal?.title ?? ''} ideas={ideas.filter((i) => modal?.ids.includes(i.id))} valueFn={value} valueLabel={mode === 'IN' ? 'Forecast' : 'Realised (MRN)'} />
    </section>
  )
}
