// Submit Idea form widgets — lever dropdown with icons, route strip, ERP part search, vendor search, attachments.
import React, { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Attachment, Lever, LeverGroup, Part, RouteKey, Supplier, User } from '../../lib/types'
import { LEVER_GROUP_STYLE, STAGE, STAGE_SHORT, TRACKER_STAGES } from '../../lib/masters'
import { Badge, Icon, SourceTag, Tooltip, cn } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { inrPrice, num, nowIso, uid } from '../../lib/format'

const GROUP_ORDER: LeverGroup[] = ['Commercial', 'Supply base', 'Engineering', 'Logistics & packing', 'Operational']
const ROUTE_COLOR: Record<RouteKey, string> = { Commercial: '#7c3aed', 'Supplier change': '#0d9488', Technical: '#4f46e5', Internal: '#db2777', 'To be confirmed': '#64748b' }

export function RouteBadge({ route }: { route: RouteKey }) {
  return <Badge color={ROUTE_COLOR[route]} icon="Route">{route}</Badge>
}

/** Field 6 "Category" — lever master as a dropdown with icons, grouped by lever group; shows the route the idea will take */
export function LeverSelect({ levers, value, onChange, error, placeholder = 'Choose a category' }: { levers: Lever[]; value: string; onChange: (id: string) => void; error?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const sel = levers.find((l) => l.id === value)
  const active = levers.filter((l) => l.active)
  const k = q.trim().toLowerCase()
  const groups = GROUP_ORDER.map((g) => ({ g, items: active.filter((l) => l.group === g && (!k || l.name.toLowerCase().includes(k) || l.route.toLowerCase().includes(k) || g.toLowerCase().includes(k))) })).filter((x) => x.items.length)
  const gs = sel ? LEVER_GROUP_STYLE[sel.group] : null
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={cn('input !h-auto min-h-[36px] flex items-center gap-2.5 text-left py-1.5', error && '!border-red-400', open && '!border-brand-500 shadow-[0_0_0_3px_rgb(36_89_224/.14)]')}>
        {sel && gs ? (
          <>
            <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0" style={{ background: gs.color, color: '#fff' }}><Icon name={sel.icon} size={14} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-ink truncate">{sel.name}</span>
              <span className="block text-[11.5px] truncate" style={{ color: gs.text }}>{sel.group} · {sel.route} route</span>
            </span>
          </>
        ) : (
          <span className="flex-1 flex items-center gap-2 text-muted"><Icon name="Shapes" size={15} />{placeholder}</span>
        )}
        <Icon name="ChevronDown" size={15} className={cn('text-muted transition-transform shrink-0', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute left-0 top-[calc(100%+4px)] z-40 card shadow-2xl overflow-hidden w-[min(580px,calc(100vw-32px))]">
              <div className="p-2 border-b border-line">
                <div className="relative">
                  <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} placeholder="Search categories, groups or routes…" className="input !h-8 !pl-8 text-[13px]" />
                </div>
              </div>
              <div className="max-h-[340px] overflow-y-auto py-1">
                {groups.map(({ g, items }) => {
                  const s = LEVER_GROUP_STYLE[g]
                  return (
                    <div key={g} className="py-1">
                      <div className="flex items-center gap-1.5 px-3 h-6 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: s.text }}>
                        <Icon name={s.icon} size={11} />{g}
                      </div>
                      {items.map((l) => (
                        <button key={l.id} type="button" onClick={() => { onChange(l.id); setOpen(false); setQ('') }} className={cn('w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-50', l.id === value && 'bg-slate-50')}>
                          <span className="h-6 w-6 rounded-md grid place-items-center shrink-0" style={{ background: s.soft, color: s.color }}><Icon name={l.icon} size={13} /></span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-medium text-ink truncate">{l.name}</span>
                            <span className="block text-[11px] text-muted truncate">Evaluator {l.evaluator} · NPD sample {l.npdSample}</span>
                          </span>
                          <span className="hidden sm:inline-flex"><RouteBadge route={l.route} /></span>
                          {l.id === value ? <Icon name="Check" size={14} className="text-brand-600 shrink-0" /> : <span className="w-3.5" />}
                        </button>
                      ))}
                    </div>
                  )
                })}
                {!groups.length && <div className="px-3 py-6 text-center text-[12.5px] text-muted">No category matches “{q}”</div>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The six workflow stages — the same for every idea — so the submitter knows what happens next */
export function RouteStrip({ route, compact }: { route: RouteKey; compact?: boolean }) {
  void route
  const stages = TRACKER_STAGES
  return (
    <div className="flex flex-wrap items-center gap-1">
      {stages.map((s, i) => {
        const tone = s === STAGE.approval ? 'bg-brand-50 text-brand-700 border-brand-200' : s === STAGE.rnd ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : s === STAGE.execution || s === STAGE.implemented ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-ink-2 border-line'
        return (
          <React.Fragment key={s}>
            <Tooltip content={<><div className="font-semibold">Step {i + 1}</div>{s}</>}>
              <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={cn('inline-flex items-center rounded-md border font-semibold whitespace-nowrap', compact ? 'h-6 px-1.5 text-[11px]' : 'h-7 px-2 text-[12px]', tone)}>
                {STAGE_SHORT[s] ?? s}
              </motion.span>
            </Tooltip>
            {i < stages.length - 1 && <Icon name="ArrowRight" size={compact ? 11 : 12} className="text-slate-400" />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/** Field 14 — ERP part master; searchable by code, description, commodity */
export function PartSearch({ parts, commodity, selected, onPick, restrictNote }: { parts: Part[]; commodity: string; selected: string[]; onPick: (p: Part) => void; restrictNote?: string }) {
  const commodities = useStore((s) => s.commodities)
  const suppliers = useStore((s) => s.suppliers)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    const k = q.trim().toLowerCase()
    const cname = (code: string) => commodities.find((c) => c.code === code)?.name.toLowerCase() ?? ''
    const list = k
      ? parts.filter((p) => p.code.includes(k) || p.description.toLowerCase().includes(k) || p.commodity.toLowerCase().includes(k) || cname(p.commodity).includes(k))
      : parts.filter((p) => !commodity || p.commodity === commodity)
    return [...list].sort((a, b) => Number(b.commodity === commodity) - Number(a.commodity === commodity)).slice(0, 8)
  }, [q, parts, commodity, commodities])
  const pick = (p: Part) => { if (selected.includes(p.code)) return; onPick(p); setQ(''); setIdx(0); ref.current?.focus() }
  return (
    <div className="relative">
      <div className="relative">
        <Icon name="ScanSearch" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input ref={ref} value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
            if (e.key === 'Enter' && results[idx]) { e.preventDefault(); pick(results[idx]) }
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Search ERP part master by code, description or commodity…" className="input !pl-9 !pr-24" />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] font-semibold text-muted">ERP part master</span>
      </div>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 card shadow-2xl overflow-hidden">
              {restrictNote && <div className="px-3 py-1.5 text-[11px] text-muted bg-slate-50 border-b border-line">{restrictNote}</div>}
              <div className="max-h-[320px] overflow-y-auto py-1">
                {results.map((p, i) => {
                  const taken = selected.includes(p.code)
                  const sup = suppliers.find((s) => s.code === p.supplierCode)
                  return (
                    <button key={p.code} type="button" disabled={taken} onMouseEnter={() => setIdx(i)} onClick={() => pick(p)} className={cn('w-full flex items-center gap-3 px-3 py-2 text-left', i === idx && !taken && 'bg-brand-50/60', taken && 'opacity-50 cursor-default')}>
                      <span className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 grid place-items-center shrink-0"><Icon name="Box" size={15} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2"><span className="font-mono text-[12px] font-semibold text-ink">{p.code}</span><span className="text-[10.5px] font-bold px-1.5 rounded bg-slate-100 text-slate-600">{p.commodity}</span></span>
                        <span className="block text-[12.5px] text-ink-2 truncate">{p.description}</span>
                        <span className="block text-[11px] text-muted truncate">{p.supplierCode} · {sup?.name ?? '—'}</span>
                      </span>
                      <span className="text-right shrink-0 hidden sm:block">
                        <span className="block text-[12px] font-semibold num">{inrPrice(p.lbp ?? p.poPrice)} <span className="text-muted font-normal">/ {p.uom}</span></span>
                        <span className="block text-[10.5px] text-muted">{p.lbp != null ? 'LBP' : 'PO price'} · MRN {num(p.lastFyMrnQty)}</span>
                      </span>
                      {taken && <Icon name="Check" size={14} className="text-emerald-600 shrink-0" />}
                    </button>
                  )
                })}
                {!results.length && <div className="px-3 py-6 text-center text-[12.5px] text-muted">No part in the ERP part master matches “{q}”</div>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Field 17 — vendor master search, or "new supplier" with name */
export function SupplierSearch({ suppliers, commodity, value, onChange, exclude, error }: { suppliers: Supplier[]; commodity: string; value: { code?: string; name: string; isNew: boolean } | null; onChange: (v: { code?: string; name: string; isNew: boolean } | null) => void; exclude: string[]; error?: boolean }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const k = q.trim().toLowerCase()
  const results = useMemo(() => {
    const list = suppliers.filter((s) => !k || s.code.toLowerCase().includes(k) || s.name.toLowerCase().includes(k) || s.city.toLowerCase().includes(k) || s.commodities.some((c) => c.toLowerCase().includes(k)))
    return [...list].sort((a, b) => Number(b.commodities.includes(commodity)) - Number(a.commodities.includes(commodity))).slice(0, 7)
  }, [suppliers, k, commodity])
  if (value) {
    const s = value.code ? suppliers.find((x) => x.code === value.code) : null
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-slate-50/60 px-3 py-2">
        <span className={cn('h-8 w-8 rounded-lg grid place-items-center shrink-0', value.isNew ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-700')}><Icon name={value.isNew ? 'UserPlus' : 'Factory'} size={15} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink truncate">{value.name}</span>
          <span className="block text-[11.5px] text-muted truncate">{value.isNew ? 'New supplier — not yet in vendor master (VMS)' : `${value.code} · ${s?.city ?? ''} · ${s?.commodities.join(', ') ?? ''}`}</span>
        </span>
        {value.isNew ? <SourceTag color="#ec8a1c">New supplier</SourceTag> : <SourceTag>Vendor master</SourceTag>}
        <button type="button" onClick={() => onChange(null)} className="text-[12px] font-semibold text-brand-700 hover:underline">Change</button>
      </div>
    )
  }
  return (
    <div className="relative">
      <Icon name="Factory" size={15} className="absolute left-3 top-[18px] -translate-y-1/2 text-muted" />
      <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} placeholder="Search vendor master by code, name or city — or type a new supplier name" className={cn('input !pl-9', error && '!border-red-400')} />
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 card shadow-2xl overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto py-1">
                {results.map((s) => {
                  const cur = exclude.includes(s.code)
                  return (
                    <button key={s.code} type="button" onClick={() => { onChange({ code: s.code, name: s.name, isNew: false }); setOpen(false); setQ('') }} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
                      <span className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Icon name="Factory" size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-semibold text-ink truncate">{s.name}</span>
                        <span className="block text-[11px] text-muted truncate">{s.code} · {s.city} · {s.commodities.join(', ')}</span>
                      </span>
                      {cur && <SourceTag color="#64748b">Current supplier</SourceTag>}
                      {s.commodities.includes(commodity) && !cur && <SourceTag color="#0d9488">In commodity</SourceTag>}
                    </button>
                  )
                })}
                {k.length >= 3 && (
                  <button type="button" onClick={() => { onChange({ name: q.trim(), isNew: true }); setOpen(false); setQ('') }} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-amber-50/60 border-t border-line">
                    <span className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 grid place-items-center shrink-0"><Icon name="UserPlus" size={14} /></span>
                    <span className="text-[12.5px]"><span className="font-semibold text-ink">New supplier:</span> “{q.trim()}”</span>
                  </button>
                )}
                {!results.length && k.length < 3 && <div className="px-3 py-4 text-center text-[12px] text-muted">Type at least 3 characters to add a new supplier</div>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Idea scope "Supplier" — searchable pick of a vendor-master supplier, filtered to the chosen commodity */
export function ScopeSupplierPicker({ suppliers, commodity, value, onChange, error }: { suppliers: Supplier[]; commodity: string; value: string; onChange: (code: string) => void; error?: boolean }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const k = q.trim().toLowerCase()
  const pool = useMemo(() => (commodity ? suppliers.filter((s) => s.commodities.includes(commodity)) : suppliers), [suppliers, commodity])
  const results = useMemo(() => pool.filter((s) => !k || s.code.toLowerCase().includes(k) || s.name.toLowerCase().includes(k) || s.city.toLowerCase().includes(k)).slice(0, 8), [pool, k])
  const sel = value ? suppliers.find((s) => s.code === value) : undefined
  if (sel) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-slate-50/60 px-3 py-1.5 min-h-[36px]">
        <span className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Icon name="Factory" size={14} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink truncate">{sel.name}</span>
          <span className="block text-[11px] text-muted truncate">{sel.code} · {sel.city}</span>
        </span>
        <button type="button" onClick={() => onChange('')} className="text-[12px] font-semibold text-brand-700 hover:underline shrink-0">Change</button>
      </div>
    )
  }
  return (
    <div className="relative">
      <Icon name="Factory" size={15} className="absolute left-3 top-[18px] -translate-y-1/2 text-muted" />
      <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && results[0]) { e.preventDefault(); onChange(results[0].code); setOpen(false); setQ('') } }}
        placeholder={commodity ? `Search ${pool.length} supplier${pool.length === 1 ? '' : 's'} of this commodity…` : 'Search suppliers by name, code or city…'} className={cn('input !pl-9', error && '!border-red-400')} />
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 card shadow-2xl overflow-hidden py-1">
              {results.map((s) => (
                <button key={s.code} type="button" onClick={() => { onChange(s.code); setOpen(false); setQ('') }} className="w-full flex items-center gap-3 px-3 py-1.5 text-left hover:bg-slate-50">
                  <span className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Icon name="Factory" size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-ink truncate">{s.name}</span>
                    <span className="block text-[11px] text-muted truncate">{s.code} · {s.city}</span>
                  </span>
                </button>
              ))}
              {pool.length > results.length && !k && <div className="px-3 py-1.5 text-[11px] text-muted border-t border-line">Type to search all {pool.length} suppliers</div>}
              {!results.length && <div className="px-3 py-4 text-center text-[12px] text-muted">{pool.length ? `No supplier matches “${q}”` : 'No supplier in the vendor master supplies this commodity'}</div>}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Field 13 — Attachments: images, PDF, drawings, quotes; up to 10 files, 10 MB each ───────────────
const MAX_FILES = 10
const MAX_BYTES = 10 * 1024 * 1024
const INLINE_BYTES = 200 * 1024 // non-image files kept inline only when small (browser storage)
export const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

function readAsDataUrl(f: File) {
  return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })
}
async function thumbnail(f: File): Promise<string | undefined> {
  try {
    const src = await readAsDataUrl(f)
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })
    const scale = Math.min(1, 480 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.82)
  } catch { return undefined }
}
export function fileIcon(a: { name: string; type: string }) {
  const n = a.name.toLowerCase()
  if (a.type.startsWith('image/')) return 'Image'
  if (n.endsWith('.pdf')) return 'FileText'
  if (/\.(xlsx?|csv)$/.test(n)) return 'FileSpreadsheet'
  if (/\.(dwg|dxf|step|stp|igs|iges)$/.test(n)) return 'DraftingCompass'
  return 'File'
}

export function Attachments({ value, onChange, me }: { value: Attachment[]; onChange: (a: Attachment[]) => void; me: User }) {
  const toast = useStore((s) => s.toast)
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const add = async (files: FileList | File[]) => {
    const list = Array.from(files)
    const room = MAX_FILES - value.length
    if (room <= 0) { toast('Up to 10 files per idea — remove one to add another', 'warning'); return }
    const tooBig = list.filter((f) => f.size > MAX_BYTES)
    if (tooBig.length) toast(`${tooBig.map((f) => f.name).join(', ')} exceeds 10 MB and was not attached`, 'error')
    const ok = list.filter((f) => f.size <= MAX_BYTES)
    if (ok.length > room) toast(`Only ${room} more file${room === 1 ? '' : 's'} allowed (10 per idea)`, 'warning')
    setBusy(true)
    const out: Attachment[] = []
    for (const f of ok.slice(0, room)) {
      const dataUrl = f.type.startsWith('image/') ? await thumbnail(f) : f.size <= INLINE_BYTES ? await readAsDataUrl(f).catch(() => undefined) : undefined
      out.push({ id: uid('att'), name: f.name, size: f.size, type: f.type || 'application/octet-stream', dataUrl, uploadedAt: nowIso(), by: me.name })
    }
    setBusy(false)
    if (out.length) onChange([...value, ...out])
  }
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) add(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={cn('flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 cursor-pointer transition-colors', drag ? 'border-brand-400 bg-brand-50/60' : 'border-slate-300 hover:border-brand-300 hover:bg-slate-50')}
      >
        <span className="h-8 w-8 rounded-lg bg-white border border-line grid place-items-center text-brand-600 shrink-0">{busy ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Upload" size={15} />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-ink">Drop files or <span className="text-brand-700 underline underline-offset-2">browse</span></span>
          <span className="block text-[11px] text-muted truncate">Images, PDF, drawings, quotes · up to 10 files, 10 MB each</span>
        </span>
        <span className="text-[11.5px] font-semibold text-muted num shrink-0">{value.length} / 10</span>
        <input ref={inputRef} type="file" multiple hidden accept="image/*,.pdf,.dwg,.dxf,.step,.stp,.igs,.xlsx,.xls,.csv,.doc,.docx" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = '' }} />
      </div>
      {!!value.length && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 mt-2">
          <AnimatePresence initial={false}>
            {value.map((a) => (
              <motion.div key={a.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="group relative rounded-lg border border-line bg-white overflow-hidden">
                <div className="h-16 bg-slate-50 grid place-items-center overflow-hidden">
                  {a.dataUrl && a.type.startsWith('image/') ? <img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover" /> : <Icon name={fileIcon(a)} size={22} className="text-slate-400" />}
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[11.5px] font-semibold text-ink truncate" title={a.name}>{a.name}</div>
                  <div className="text-[10.5px] text-muted">{fmtBytes(a.size)}</div>
                </div>
                <button type="button" onClick={() => onChange(value.filter((x) => x.id !== a.id))} className="absolute top-1 right-1 h-6 w-6 rounded-md bg-white/90 border border-line grid place-items-center text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">
                  <Icon name="X" size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
