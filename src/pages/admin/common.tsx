// M12 Admin & Masters — shared building blocks: read-only context, generic CRUD section (DataTable + modal form), multi-select chips, icon picker
import React, { createContext, useContext, useMemo, useState } from 'react'
import { Card, DataTable, Button, Modal, Field, Toggle, Icon, Badge, cn, type Column } from '../../components/ui'
import { useStore } from '../../store/useStore'

export const AdminRO = createContext(false)
export const useRO = () => useContext(AdminRO)

type Store = ReturnType<typeof useStore.getState>
export type ListKey = 'levers' | 'categories' | 'commodities' | 'plants' | 'users' | 'suppliers' | 'parts' | 'emailTemplates'

export interface FieldSpec<T = any> {
  key: string
  label: string
  type: 'text' | 'email' | 'number' | 'crore' | 'select' | 'multiselect' | 'toggle' | 'icon' | 'textarea'
  options?: [string, string][] | ((draft: T) => [string, string][])
  required?: boolean
  hint?: React.ReactNode
  wide?: boolean
  lockOnEdit?: boolean
  nullable?: boolean // number that may be empty (e.g. LBP)
  placeholder?: string
  show?: (draft: T) => boolean
  min?: number
}

/** Chip multi-select */
export function MultiChips({ value, options, onChange, disabled }: { value: string[]; options: [string, string][]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([k, l]) => {
        const on = value.includes(k)
        return (
          <button type="button" key={k} disabled={disabled} onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}
            className={cn('h-7 px-2.5 rounded-full text-[12px] font-semibold border transition inline-flex items-center gap-1', on ? 'bg-brand-grad text-white border-brand-600 shadow-sm' : 'bg-white text-ink-2 border-line hover:border-brand-200', disabled && 'opacity-60 cursor-not-allowed')}>
            {on && <Icon name="Check" size={12} />}{l}
          </button>
        )
      })}
    </div>
  )
}

export const ICON_CHOICES = [
  'Handshake', 'CalendarClock', 'ArrowLeftRight', 'Layers', 'Users', 'MapPin', 'Map', 'EyeOff', 'Lightbulb', 'Calculator', 'FlaskConical', 'Ruler', 'SlidersHorizontal', 'Truck', 'Package',
  'Workflow', 'Recycle', 'Cpu', 'Factory', 'Cog', 'Wrench', 'Zap', 'Leaf', 'Scale', 'Boxes', 'Gauge', 'Sparkles', 'Target', 'Timer', 'Globe', 'Container', 'Ship', 'Plane', 'Hammer', 'Magnet', 'Droplets',
  'Flame', 'Thermometer', 'BadgePercent', 'PiggyBank', 'Receipt', 'ScanLine', 'Bot', 'Warehouse', 'Split', 'Merge', 'Shrink', 'Feather',
]
export function IconPicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-8 sm:grid-cols-12 gap-1 rounded-lg border border-line p-1.5 bg-slate-50/60">
      {ICON_CHOICES.map((n) => (
        <button type="button" key={n} title={n} disabled={disabled} onClick={() => onChange(n)} className={cn('h-8 rounded-md grid place-items-center transition', value === n ? 'bg-brand-grad text-white shadow-sm' : 'bg-white text-ink-2 hover:bg-brand-50 hover:text-brand-700 border border-transparent hover:border-brand-100')}>
          <Icon name={n} size={15} />
        </button>
      ))}
    </div>
  )
}

export function FormField<T>({ f, draft, set, editing, ro }: { f: FieldSpec<T>; draft: any; set: (k: string, v: any) => void; editing: boolean; ro: boolean }) {
  const disabled = ro || (editing && f.lockOnEdit)
  const opts = typeof f.options === 'function' ? f.options(draft) : f.options ?? []
  const v = draft[f.key]
  let input: React.ReactNode
  switch (f.type) {
    case 'select':
      input = <select className="input" disabled={disabled} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)}>{!f.required && <option value="">—</option>}{f.required && v == null && <option value="">Select…</option>}{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      break
    case 'multiselect':
      input = <MultiChips value={v ?? []} options={opts} onChange={(x) => set(f.key, x)} disabled={disabled} />
      break
    case 'toggle':
      input = <div className="h-9 flex items-center"><Toggle checked={!!v} onChange={(x) => set(f.key, x)} disabled={disabled} label={v ? 'Active' : 'Inactive'} /></div>
      break
    case 'icon':
      input = <IconPicker value={v} onChange={(x) => set(f.key, x)} disabled={disabled} />
      break
    case 'textarea':
      input = <textarea className="input" rows={4} disabled={disabled} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
      break
    case 'number':
    case 'crore':
      input = (
        <div className="relative">
          {f.type === 'crore' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12.5px] text-muted">₹</span>}
          <input className={cn('input num', f.type === 'crore' && 'pl-6 pr-9')} type="number" step="any" min={f.min} disabled={disabled} value={v == null || Number.isNaN(v) ? '' : v} placeholder={f.nullable ? 'Not available' : f.placeholder}
            onChange={(e) => set(f.key, e.target.value === '' ? (f.nullable ? null : '') : Number(e.target.value))} />
          {f.type === 'crore' && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-muted">Cr</span>}
        </div>
      )
      break
    default:
      input = <input className="input" type={f.type === 'email' ? 'email' : 'text'} disabled={disabled} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
  }
  return <Field label={f.label} required={f.required} hint={f.hint} className={cn(f.wide && 'sm:col-span-2')}>{input}</Field>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Generic master CRUD — DataTable everywhere, modal forms, toast + undo */
export function CrudSection<T extends Record<string, any>>({
  title, subtitle, icon, rows, idKey = 'id', columns, fields, storeKey, makeNew, entity, blockDelete, toUi, fromUi, extra, toolbar, searchKeys, preview, validate, onSaved,
}: {
  title: string; subtitle?: React.ReactNode; icon: string; rows: T[]; idKey?: string; columns: Column<T>[]; fields: FieldSpec<T>[]; storeKey: ListKey
  makeNew: () => T; entity: string; blockDelete?: (row: T) => string | null; toUi?: (row: T) => any; fromUi?: (d: any) => T; extra?: React.ReactNode; toolbar?: React.ReactNode
  searchKeys?: (row: T) => string; preview?: (draft: any) => React.ReactNode; validate?: (d: any, isNew: boolean) => string | null; onSaved?: (row: T, isNew: boolean) => void
}) {
  const ro = useRO()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const toast = useStore((s) => s.toast)
  const [open, setOpen] = useState<{ draft: any; isNew: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const shown = useMemo(() => (q.trim() && searchKeys ? rows.filter((r) => searchKeys(r).toLowerCase().includes(q.trim().toLowerCase())) : rows), [rows, q, searchKeys])
  const conv = (r: T) => (toUi ? toUi(r) : { ...r })
  const set = (k: string, v: any) => setOpen((o) => (o ? { ...o, draft: { ...o.draft, [k]: v } } : o))
  const save = () => {
    if (!open) return
    const d = open.draft
    for (const f of fields) {
      if (f.show && !f.show(d)) continue
      const v = d[f.key]
      if (f.required && (v == null || v === '' || (Array.isArray(v) && !v.length))) return setErr(`${f.label} is required`)
      if (f.type === 'email' && v && !EMAIL_RE.test(v)) return setErr(`${f.label} is not a valid email`)
      if ((f.type === 'number' || f.type === 'crore') && v !== '' && v != null && (Number.isNaN(Number(v)) || (f.min != null && Number(v) < f.min))) return setErr(`${f.label} must be ${f.min != null ? `≥ ${f.min}` : 'a number'}`)
    }
    if (open.isNew && rows.some((r) => String(r[idKey]).toLowerCase() === String(d[idKey]).trim().toLowerCase())) return setErr(`${entity} ${d[idKey]} already exists`)
    const v2 = validate?.(d, open.isNew)
    if (v2) return setErr(v2)
    const item = fromUi ? fromUi(d) : d
    if (typeof item[idKey] === 'string') (item as any)[idKey] = item[idKey].trim()
    const prev = (useStore.getState() as Store)[storeKey] as any[]
    upsert(storeKey as any, item, idKey)
    onSaved?.(item, open.isNew)
    toast(`${entity} ${open.isNew ? 'added' : 'updated'} · ${item.name ?? item.description ?? item[idKey]}`, 'success', () => useStore.setState({ [storeKey]: prev } as any))
    setOpen(null)
  }
  const del = () => {
    if (!open) return
    const row = rows.find((r) => r[idKey] === open.draft[idKey])
    const why = row && blockDelete?.(row)
    if (why) return setErr(why)
    const prev = (useStore.getState() as Store)[storeKey] as any[]
    remove(storeKey, open.draft[idKey], idKey)
    toast(`${entity} ${open.draft.name ?? open.draft[idKey]} deleted`, 'warning', () => useStore.setState({ [storeKey]: prev } as any))
    setOpen(null)
  }
  const editCols: Column<T>[] = [...columns, { key: '__edit', label: '', width: 44, render: () => <Icon name={ro ? 'Eye' : 'PencilLine'} size={14} className="text-muted" /> }]
  return (
    <Card title={title} subtitle={subtitle} icon={icon} className="rounded-2xl" actions={!ro && <Button size="sm" variant="primary" icon="Plus" onClick={() => { setErr(null); setOpen({ draft: conv(makeNew()), isNew: true }) }}>Add {entity.toLowerCase()}</Button>}>
      {extra}
      <DataTable rows={shown} rowKey={(r) => String(r[idKey])} columns={editCols} exportName={`COIN_${title.replace(/[^A-Za-z0-9]+/g, '_')}`} maxHeight={560}
        onRowClick={(r) => { setErr(null); setOpen({ draft: conv(r), isNew: false }) }}
        toolbar={<>
          {searchKeys && (
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input !h-8 pl-8 w-[240px] text-[12.5px]" placeholder={`Search ${title.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          {toolbar}
        </>} />
      <Modal open={!!open} onClose={() => setOpen(null)} size="lg" icon={icon} title={open?.isNew ? `Add ${entity.toLowerCase()}` : ro ? `${entity} (read-only)` : `Edit ${entity.toLowerCase()}`}
        subtitle={open && !open.isNew ? String(open.draft[idKey]) : 'Saved to the master immediately; every change can be undone for 5 seconds'}
        footer={<>
          {!ro && open && !open.isNew && <Button variant="danger" icon="Trash2" className="mr-auto" onClick={del}>Delete</Button>}
          <Button onClick={() => setOpen(null)}>{ro ? 'Close' : 'Cancel'}</Button>
          {!ro && <Button variant="primary" icon="Save" onClick={save}>{open?.isNew ? `Add ${entity.toLowerCase()}` : 'Save changes'}</Button>}
        </>}>
        {open && (
          <div className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.filter((f) => !f.show || f.show(open.draft)).map((f) => <FormField key={f.key} f={f} draft={open.draft} set={set} editing={!open.isNew} ro={ro} />)}
            </div>
            {preview?.(open.draft)}
            {err && <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12.5px] px-3 py-2"><Icon name="CircleAlert" size={14} />{err}</div>}
          </div>
        )}
      </Modal>
    </Card>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? <Badge color="#0f9f6e" dot>Active</Badge> : <Badge color="#6b7280" dot>Inactive</Badge>
}

export function SectionIntro({ children, icon = 'Info' }: { children: React.ReactNode; icon?: string }) {
  return <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-3 py-2 text-[12.5px] text-ink-2 mb-3"><Icon name={icon} size={14} className="text-brand-600 mt-0.5 shrink-0" /><div>{children}</div></div>
}
