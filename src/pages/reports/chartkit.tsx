// Shared chart kit for Reports and Admin: recharts styling (Section 14), drill-down to the Idea Register, idea-list modal, mini visuals.
import React, { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, DataTable, Button, StageBadge, LeverChip, Icon, cn, type Column } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { ideaAnnualised } from '../../lib/calc'
import { inrShort, fmtDate } from '../../lib/format'
import type { Filters, Idea } from '../../lib/types'

// ─── recharts styling ─────────────────────────────────────────────────────────
export const TICK = { fontSize: 11, fill: '#64748b' }
export const AX = { axisLine: false, tickLine: false, tick: TICK } as const
export const GRID = { vertical: false, stroke: '#eceef6' } as const
/** ₹ in crore with Indian digit grouping for very large values (₹ 12,435 Cr); otherwise the standard lakh / crore short form */
export const inrBig = (v: number) => (Math.abs(v) >= 1e10 ? `${v < 0 ? '−' : ''}₹ ${Math.round(Math.abs(v) / 1e7).toLocaleString('en-IN')} Cr` : inrShort(v))

/** Compact ₹ axis ticks in lakh / crore that never wrap: ₹120 Cr, ₹8.5 Cr, ₹45 L */
export const moneyTick = (v: number) => {
  if (!v) return '0'
  const a = Math.abs(v), s = v < 0 ? '−' : ''
  const f = (x: number) => (x >= 10 || Number.isInteger(x) ? x.toFixed(0) : x.toFixed(1))
  if (a >= 1e7) return `${s}₹${f(a / 1e7)} Cr`
  if (a >= 1e5) return `${s}₹${f(a / 1e5)} L`
  return `${s}₹${Math.round(a).toLocaleString('en-IN')}`
}
export const pctTick = (v: number) => `${Math.round(v)}%`
export const CURSOR = { fill: 'rgb(36 89 224 / .06)' }

export const PALETTE = ['#2459e0', '#bf8f3f', '#0f9f6e', '#ec8a1c', '#7c3aed', '#0d9488', '#db2777', '#0284c7', '#4f46e5', '#ca8a04', '#059669', '#9333ea', '#64748b']

/** Custom white rounded tooltip */
export function ChartTip({ active, payload, label, fmt, title, hint = 'Click to open the ideas behind it', hide = [] as string[] }: any) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p: any) => !hide.includes(p.dataKey) && p.value != null)
  return (
    <div className="rounded-xl bg-white border border-line shadow-[0_12px_30px_-12px_rgb(15_23_42/.35)] px-3 py-2 text-[12px] min-w-[170px]">
      <div className="font-semibold text-ink mb-1">{title ? title(label, payload) : label}</div>
      {items.map((p: any, k: number) => (
        <div key={k} className="flex items-center justify-between gap-4 leading-5">
          <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill || p.payload?.color }} />{p.name}</span>
          <span className="font-semibold num text-ink">{fmt ? fmt(p.value, p) : p.value}</span>
        </div>
      ))}
      {hint && <div className="text-[10.5px] text-slate-400 mt-1 pt-1 border-t border-slate-100">{hint}</div>}
    </div>
  )
}

export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted', className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: i.color }} /> : <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

// ─── Drill-down URL contract (Idea Register honours these) ────────────────────
export type Drill = Partial<Record<'bucket' | 'stage' | 'commodity' | 'category' | 'lever' | 'group' | 'route' | 'buyer' | 'supplier' | 'dept' | 'campaign' | 'savingsType' | 'dropReason' | 'health' | 'sla' | 'plant' | 'q', string>>
export const ideasUrl = (p: Drill) => {
  const q = new URLSearchParams()
  Object.entries(p).forEach(([k, v]) => v != null && v !== '' && q.set(k, v))
  const s = q.toString()
  return s ? `/ideas?${s}` : '/ideas'
}
export function useDrill() {
  const nav = useNavigate()
  return useCallback((p: Drill) => nav(ideasUrl(p)), [nav])
}

// ─── Idea list modal (for segments the URL contract cannot express, e.g. a month) ───
interface ListState { title: string; subtitle?: string; ideas: Idea[]; url?: string }
export function useIdeaList() {
  const [st, setSt] = useState<ListState | null>(null)
  const nav = useNavigate()
  const openIdea = useStore((s) => s.openIdea)
  const commodities = useStore((s) => s.commodities)
  const cols: Column<Idea>[] = [
    { key: 'id', label: 'Idea ID', render: (i) => <span className="font-mono text-[11.5px] font-semibold text-brand-700">{i.id}</span> },
    { key: 'title', label: 'Title', render: (i) => <span className="block max-w-[340px] truncate font-medium text-ink" title={i.title}>{i.title}</span> },
    { key: 'commodity', label: 'Commodity', value: (i) => commodities.find((c) => c.code === i.commodity)?.name ?? i.commodity },
    { key: 'lever', label: 'Category', value: (i) => i.leverId, render: (i) => <LeverChip leverId={i.leverId} /> },
    { key: 'stage', label: 'Stage', value: (i) => i.stage, render: (i) => <StageBadge stage={i.stage} bucket={i.bucket} /> },
    { key: 'value', label: 'Annualised', align: 'right', value: (i) => ideaAnnualised(i), render: (i) => <span className="num font-semibold">{inrShort(ideaAnnualised(i))}</span> },
    { key: 'submitted', label: 'Submitted', value: (i) => i.submittedAt ?? i.createdAt, render: (i) => fmtDate((i.submittedAt ?? i.createdAt).slice(0, 10)) },
  ]
  const el = (
    <Modal open={!!st} onClose={() => setSt(null)} size="xl" icon="ListFilter" title={st?.title ?? ''} subtitle={st?.subtitle ?? `${st?.ideas.length ?? 0} ideas · click a row to open the idea`}
      footer={<>
        <Button onClick={() => setSt(null)}>Close</Button>
        {st?.url && <Button variant="primary" icon="Table2" onClick={() => { const u = st.url!; setSt(null); nav(u) }}>Open in Idea Register</Button>}
      </>}>
      <DataTable rows={st?.ideas ?? []} rowKey={(i) => i.id} columns={cols} maxHeight={440} exportName={st ? `COIN_${st.title.replace(/[^A-Za-z0-9]+/g, '_')}` : undefined}
        onRowClick={(i) => { setSt(null); openIdea(i.id) }} />
    </Modal>
  )
  const show = useCallback((title: string, ideas: Idea[], url?: string, subtitle?: string) => setSt({ title, ideas, url, subtitle }), [])
  return { show, el }
}

// ─── Filter description for exports ───────────────────────────────────────────
export function filterText(f: Filters, lookups: { plants: { id: string; name: string }[]; categories: { id: string; name: string }[]; commodities: { code: string; name: string }[]; users: { id: string; name: string }[]; levers: { id: string; name: string }[] }) {
  const parts = [`FY ${f.fy}`]
  if (f.quarter !== 'All') parts.push(`Quarter ${f.quarter}`)
  if (f.plant !== 'All') parts.push(`Plant ${lookups.plants.find((p) => p.id === f.plant)?.name ?? f.plant}`)
  if (f.categoryId !== 'All') parts.push(`Commodity group ${lookups.categories.find((c) => c.id === f.categoryId)?.name ?? f.categoryId}`)
  if (f.commodity !== 'All') parts.push(`Commodity ${lookups.commodities.find((c) => c.code === f.commodity)?.name ?? f.commodity}`)
  if (f.buyerId !== 'All') parts.push(`Buyer ${lookups.users.find((u) => u.id === f.buyerId)?.name ?? f.buyerId}`)
  if (f.leverId !== 'All') parts.push(`Category ${lookups.levers.find((l) => l.id === f.leverId)?.name ?? f.leverId}`)
  if (f.buyingType !== 'All') parts.push(f.buyingType)
  return parts.join(' | ')
}

// ─── Mini visuals (library previews, KPI tiles) ───────────────────────────────
export function MiniBars({ data, color = '#2459e0', height = 44, width = 150, colors, gap = 3 }: { data: number[]; color?: string; height?: number; width?: number; colors?: string[]; gap?: number }) {
  const max = Math.max(1e-9, ...data.map((d) => Math.abs(d)))
  const n = Math.max(1, data.length)
  const bw = Math.max(2, (width - gap * (n - 1)) / n)
  return (
    <svg width={width} height={height} className="overflow-visible">
      {data.map((d, i) => {
        const h = Math.max(1.5, (Math.abs(d) / max) * (height - 2))
        return <rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h} rx={Math.min(3, bw / 2)} fill={colors?.[i] ?? color} opacity={colors ? 1 : 0.35 + 0.65 * (Math.abs(d) / max)} />
      })}
    </svg>
  )
}
export function MiniHBars({ data, width = 150, rowH = 8, gap = 5 }: { data: { v: number; max?: number; color: string; track?: string }[]; width?: number; rowH?: number; gap?: number }) {
  const max = Math.max(1e-9, ...data.map((d) => d.max ?? d.v))
  return (
    <svg width={width} height={data.length * (rowH + gap)}>
      {data.map((d, i) => (
        <g key={i}>
          <rect x={0} y={i * (rowH + gap)} width={width} height={rowH} rx={rowH / 2} fill={d.track ?? '#eceef6'} />
          <rect x={0} y={i * (rowH + gap)} width={Math.max(2, (Math.min(d.v, max) / max) * width)} height={rowH} rx={rowH / 2} fill={d.color} />
        </g>
      ))}
    </svg>
  )
}
export function MiniDonut({ parts, size = 56, stroke = 9, label }: { parts: { v: number; color: string }[]; size?: number; stroke?: number; label?: React.ReactNode }) {
  const total = parts.reduce((a, p) => a + p.v, 0) || 1
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  let off = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eceef6" strokeWidth={stroke} />
        {parts.map((p, i) => {
          const len = (p.v / total) * c
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />
          off += len
          return el
        })}
      </svg>
      {label != null && <div className="absolute inset-0 grid place-items-center text-[11px] font-bold text-ink num">{label}</div>}
    </div>
  )
}

/** Horizontal meter row used in scorecards and KPI breakdowns */
export function MeterRow({ label, value, display, max, color = '#2459e0', onClick, sub, marker }: { label: React.ReactNode; value: number; display: React.ReactNode; max: number; color?: string; onClick?: () => void; sub?: React.ReactNode; marker?: number }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={cn('w-full text-left group rounded-md px-1 -mx-1 py-[3px]', onClick && 'hover:bg-slate-50 cursor-pointer')}>
      <div className="flex items-center justify-between gap-2 text-[12px] leading-4">
        <span className="truncate text-ink-2 group-hover:text-ink">{label}</span>
        <span className="num font-semibold text-ink shrink-0">{display}</span>
      </div>
      <div className="relative mt-1 h-[5px] rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${w}%`, background: color }} />
        {marker != null && max > 0 && <div className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-slate-600 rounded" style={{ left: `${Math.min(100, (marker / max) * 100)}%` }} />}
      </div>
      {sub && <div className="text-[10.5px] text-muted mt-0.5 truncate">{sub}</div>}
    </button>
  )
}

export function SectionNote({ icon = 'Info', children, tone = 'slate' }: { icon?: string; children: React.ReactNode; tone?: 'slate' | 'amber' | 'red' | 'green' | 'blue' }) {
  const t = { slate: 'bg-slate-50 border-slate-200 text-slate-600', amber: 'bg-amber-50 border-amber-200 text-amber-800', red: 'bg-red-50 border-red-200 text-red-700', green: 'bg-emerald-50 border-emerald-200 text-emerald-800', blue: 'bg-blue-50 border-blue-200 text-blue-800' }[tone]
  return <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] leading-snug', t)}><Icon name={icon} size={14} className="mt-px shrink-0" /><div className="min-w-0">{children}</div></div>
}

/** jsPDF standard fonts are WinAnsi only — map symbols outside it to plain text */
export const pdfText = (v: any) => String(v ?? '')
  .replace(/Σ\s?/g, 'Sum ').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/×/g, 'x').replace(/→/g, '->').replace(/[−–—]/g, '-')
  .replace(/…/g, '...').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/÷/g, '/')

export const FREQ_STYLE: Record<string, string> = { Live: '#0f9f6e', 'Live / monthly': '#0d9488', Monthly: '#3b74f2', Weekly: '#7c3aed', Quarterly: '#ec8a1c', Annual: '#bf8f3f', 'Per campaign': '#db2777' }
