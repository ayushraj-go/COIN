// M12 — master data: Category, Commodity, Lever, Route, Department, Plant / BU, Users, Vendor master, Part master
import React, { useMemo, useState } from 'react'
import { Card, Badge, LeverChip, UserChip, Avatar, Icon, Button, Toggle, Stat, cn } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { ROUTE_STAGES, STAGE_SHORT, STAGE_SLA_KEY, MILESTONE_TEMPLATES, LEVER_GROUP_STYLE } from '../../lib/masters'
import { LEVER_INTRO, LEVER_FOOTNOTE, LEVER_SPLIT_NOTE, ROUTES_TABLE, ROLES } from '../../lib/scope'
import { ROLE_LABEL } from '../../lib/nav'
import { inrPrice, num } from '../../lib/format'
import type { Category, Commodity, Lever, LeverGroup, Part, Plant, RoleKey, RouteKey, Supplier, User } from '../../lib/types'
import { CrudSection, ActiveBadge, SectionIntro, useRO, type FieldSpec } from './common'
import { inrBig } from '../reports/chartkit'

const CR = 1e7
const LEVER_GROUPS: LeverGroup[] = ['Commercial', 'Supply base', 'Engineering', 'Logistics & packing', 'Operational']
const ROUTES: RouteKey[] = ['Commercial', 'Supplier change', 'Technical', 'Internal', 'To be confirmed']
const EVALUATORS = ['—', 'R&D', 'DQA', 'Quality', 'Process', 'Production', 'R&D + DQA', 'R&D + Quality', 'Quality + Process', 'To be confirmed']
const NPD = ['No', 'Yes', 'Yes (supplier qualification)', 'Trial only', 'To be confirmed']
const ALL_DEPTS = ['R&D', 'DQA', 'Quality', 'Process', 'Production', 'Sourcing', 'Finance', 'Management', 'Sourcing Excellence', 'Supplier']
const ROLE_KEYS = Object.keys(ROLE_LABEL) as RoleKey[]
const AVATAR = ['#2f5bc6', '#4470d6', '#0f9f6e', '#ec8a1c', '#7c3aed', '#0d9488', '#db2777', '#0284c7', '#4f46e5', '#bf8f3f']
const opt = (a: string[]): [string, string][] => a.map((x) => [x, x])

function useLookups() {
  const categories = useStore((s) => s.categories)
  const commodities = useStore((s) => s.commodities)
  const users = useStore((s) => s.users)
  const plants = useStore((s) => s.plants)
  const suppliers = useStore((s) => s.suppliers)
  const ideas = useStore((s) => s.ideas)
  const departments = useStore((s) => s.departments)
  return { categories, commodities, users, plants, suppliers, ideas, departments }
}

// ─── Category ─────────────────────────────────────────────────────────────────
export function CategoryAdmin() {
  const { categories, commodities, ideas } = useLookups()
  const fields: FieldSpec<Category>[] = [
    { key: 'id', label: 'Group code', type: 'text', required: true, lockOnEdit: true, placeholder: 'e.g. MET' },
    { key: 'name', label: 'Group name', type: 'text', required: true, placeholder: 'e.g. Metals' },
    { key: 'buyingType', label: 'Buying type', type: 'select', required: true, options: opt(['Direct', 'Indirect']) },
  ]
  return (
    <CrudSection<Category> title="Commodity group master" subtitle="Direct (BOM materials and components) and indirect buying" icon="FolderTree" entity="Category" storeKey="categories" rows={categories}
      makeNew={() => ({ id: '', name: '', buyingType: 'Direct' })} fields={fields}
      blockDelete={(c) => (commodities.some((x) => x.categoryId === c.id) ? 'Category has commodities mapped — move or delete them first' : null)}
      columns={[
        { key: 'id', label: 'Code', render: (c) => <span className="font-mono font-semibold text-brand-700">{c.id}</span> },
        { key: 'name', label: 'Commodity group', render: (c) => <span className="font-semibold text-ink">{c.name}</span> },
        { key: 'buyingType', label: 'Buying type', render: (c) => <Badge color={c.buyingType === 'Direct' ? '#2f5bc6' : '#bf8f3f'}>{c.buyingType}</Badge> },
        { key: 'commodities', label: 'Commodities', value: (c) => commodities.filter((x) => x.categoryId === c.id).map((x) => x.name).join(', '), render: (c) => <span className="text-ink-2">{commodities.filter((x) => x.categoryId === c.id).map((x) => x.code).join(' · ') || '—'}</span> },
        { key: 'ideas', label: 'Ideas', align: 'right', value: (c) => ideas.filter((i) => i.categoryId === c.id).length },
      ]} />
  )
}

// ─── Commodity ────────────────────────────────────────────────────────────────
export function CommodityAdmin() {
  const { categories, commodities, users, ideas } = useLookups()
  const buyers = users.filter((u) => u.roles.includes('buyer'))
  const leads = users.filter((u) => u.roles.includes('lead'))
  const fields: FieldSpec<any>[] = [
    { key: 'code', label: 'Commodity code', type: 'text', required: true, lockOnEdit: true, placeholder: 'e.g. FAS', hint: 'Used in idea IDs: COIN-FY27-FAS-0012' },
    { key: 'name', label: 'Commodity name', type: 'text', required: true },
    { key: 'categoryId', label: 'Commodity group', type: 'select', required: true, options: categories.map((c) => [c.id, `${c.name} (${c.buyingType})`] as [string, string]) },
    { key: 'buyerId', label: 'Commodity Buyer', type: 'select', required: true, options: buyers.map((u) => [u.id, u.name] as [string, string]) },
    { key: 'leadId', label: 'Commodity Lead', type: 'select', required: true, options: leads.map((u) => [u.id, u.name] as [string, string]) },
    { key: 'addressableSpend', label: 'Addressable spend (last FY)', type: 'crore', required: true, min: 0, hint: 'Denominator of KPI A2 — savings % of spend' },
  ]
  return (
    <CrudSection<Commodity> title="Commodity master" subtitle="Filtered by category on the submission form · buyer and lead own the commodity" icon="Boxes" entity="Commodity" storeKey="commodities" idKey="code" rows={commodities}
      makeNew={() => ({ code: '', name: '', categoryId: categories[0]?.id ?? '', target: 0, buyerId: buyers[0]?.id ?? '', leadId: leads[0]?.id ?? '', addressableSpend: 0 })}
      toUi={(c) => ({ ...c, addressableSpend: +(c.addressableSpend / CR).toFixed(2) })}
      fromUi={(d) => ({ ...d, code: String(d.code).trim().toUpperCase(), addressableSpend: Math.round(Number(d.addressableSpend) * CR) })}
      fields={fields} searchKeys={(c) => `${c.code} ${c.name}`}
      blockDelete={(c) => (ideas.some((i) => i.commodity === c.code) ? `${ideas.filter((i) => i.commodity === c.code).length} ideas reference this commodity — it cannot be deleted` : null)}
      columns={[
        { key: 'code', label: 'Code', render: (c) => <span className="font-mono font-semibold text-brand-700">{c.code}</span> },
        { key: 'name', label: 'Commodity', render: (c) => <span className="font-semibold text-ink">{c.name}</span> },
        { key: 'category', label: 'Commodity group', value: (c) => categories.find((x) => x.id === c.categoryId)?.name },
        { key: 'spend', label: 'Addressable spend', align: 'right', value: (c) => c.addressableSpend, render: (c) => <span className="num">{inrBig(c.addressableSpend)}</span> },
        { key: 'buyer', label: 'Buyer', value: (c) => users.find((u) => u.id === c.buyerId)?.name, render: (c) => <UserChip userId={c.buyerId} size={20} /> },
        { key: 'lead', label: 'Commodity Lead', value: (c) => users.find((u) => u.id === c.leadId)?.name, render: (c) => <UserChip userId={c.leadId} size={20} /> },
        { key: 'ideas', label: 'Ideas', align: 'right', value: (c) => ideas.filter((i) => i.commodity === c.code).length },
      ]} />
  )
}

// ─── Lever ────────────────────────────────────────────────────────────────────
function RouteStrip({ route }: { route: RouteKey }) {
  const stages = (ROUTE_STAGES[route] ?? []).filter((s) => s !== 'Buyer validation' || true)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {stages.map((s, k) => (
        <React.Fragment key={s}>
          {k > 0 && <Icon name="ChevronRight" size={12} className="text-slate-300" />}
          <span className={cn('h-6 px-2 rounded-md text-[11px] font-semibold inline-flex items-center', s === 'Approval' ? 'bg-gold-50 text-gold-700 border border-gold-200' : s === 'Implemented' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white text-ink-2 border border-line')} title={s}>{STAGE_SHORT[s] ?? s}</span>
        </React.Fragment>
      ))}
    </div>
  )
}
export function LeverAdmin() {
  const levers = useStore((s) => s.levers)
  const ideas = useStore((s) => s.ideas)
  const upsert = useStore((s) => s.upsert)
  const toast = useStore((s) => s.toast)
  const ro = useRO()
  const nextId = () => { const n = Math.max(0, ...levers.map((l) => Number(l.id.replace(/\D/g, '')) || 0)) + 1; return `L${String(n).padStart(2, '0')}` }
  const fields: FieldSpec<Lever>[] = [
    { key: 'id', label: 'Category ID', type: 'text', required: true, lockOnEdit: true },
    { key: 'name', label: 'Idea category', type: 'text', required: true, placeholder: 'e.g. Design-to-cost teardown' },
    { key: 'group', label: 'Category group', type: 'select', required: true, options: opt(LEVER_GROUPS) },
    { key: 'defaultSavingsType', label: 'Default savings type', type: 'select', required: true, options: opt(['Hard', 'Cost avoidance', 'One-time']), hint: 'Pre-fills the savings type on the form (editable)' },
    { key: 'savingsType', label: 'Savings type (master label)', type: 'text', required: true, placeholder: 'Hard / Avoidance', hint: 'As shown in the lever master, e.g. "Hard / Avoidance"' },
    { key: 'route', label: 'Route', type: 'select', required: true, options: opt(ROUTES), hint: "Decides the idea's stages after submission" },
    { key: 'evaluator', label: 'Technical evaluator', type: 'select', required: true, options: opt(EVALUATORS) },
    { key: 'npdSample', label: 'NPD sample', type: 'select', required: true, options: opt(NPD) },
    { key: 'active', label: 'Status', type: 'toggle' },
    { key: 'icon', label: 'Icon', type: 'icon', wide: true },
  ]
  const toggle = (l: Lever) => {
    if (ro) return
    const prev = useStore.getState().levers
    upsert('levers', { ...l, active: !l.active })
    toast(`${l.name} ${l.active ? 'deactivated — hidden on the submission form' : 'activated'}`, 'success', () => useStore.setState({ levers: prev }))
  }
  return (
    <div className="grid gap-3">
      <SectionIntro icon="Route">{LEVER_INTRO} <b>{LEVER_FOOTNOTE}</b></SectionIntro>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {LEVER_GROUPS.map((g) => {
          const st = LEVER_GROUP_STYLE[g]
          const ls = levers.filter((l) => l.group === g)
          return (
            <div key={g} className="rounded-xl border px-3 py-2 bg-white" style={{ borderColor: `${st.color}33` }}>
              <div className="flex items-center gap-2"><span className="h-7 w-7 rounded-lg grid place-items-center" style={{ background: st.soft, color: st.color }}><Icon name={st.icon} size={14} /></span><span className="text-[12.5px] font-semibold text-ink">{g}</span></div>
              <div className="text-[11px] text-muted mt-1">{ls.filter((l) => l.active).length} active · {ls.length} levers</div>
            </div>
          )
        })}
      </div>
      <CrudSection<Lever> title="Idea category master" subtitle="Section 5 · group, default savings type, route, evaluator, NPD sample, icon" icon="SlidersHorizontal" entity="Lever" storeKey="levers" rows={levers}
        makeNew={() => ({ id: nextId(), group: 'Engineering', name: '', savingsType: 'Hard', defaultSavingsType: 'Hard', route: 'Technical', evaluator: 'R&D', npdSample: 'Yes', icon: 'Lightbulb', active: true })}
        fields={fields} searchKeys={(l) => `${l.id} ${l.name} ${l.group} ${l.route}`}
        blockDelete={(l) => (ideas.some((i) => i.leverId === l.id) ? `${ideas.filter((i) => i.leverId === l.id).length} ideas use this lever — deactivate it instead` : null)}
        preview={(d) => (
          <div className="rounded-xl border border-line bg-slate-50/60 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center text-white" style={{ background: LEVER_GROUP_STYLE[d.group as LeverGroup]?.color }}><Icon name={d.icon} size={14} /></span>
              <span className="text-[12.5px] font-semibold text-ink">{d.name || 'New lever'}</span>
              <Badge color={LEVER_GROUP_STYLE[d.group as LeverGroup]?.color}>{d.group}</Badge>
              <span className="text-[11px] text-muted ml-auto">Route strip shown to the submitter</span>
            </div>
            <RouteStrip route={d.route} />
            <div className="text-[11px] text-muted mt-2">Evaluator: <b className="text-ink-2">{d.evaluator}</b> · NPD sample: <b className="text-ink-2">{d.npdSample}</b> · Default savings type: <b className="text-ink-2">{d.defaultSavingsType}</b></div>
          </div>
        )}
        columns={[
          { key: 'id', label: 'ID', render: (l) => <span className="font-mono font-semibold text-muted">{l.id}</span> },
          { key: 'name', label: 'Category', value: (l) => l.name, render: (l) => <LeverChip leverId={l.id} /> },
          { key: 'group', label: 'Group', value: (l) => l.group },
          { key: 'savingsType', label: 'Savings type', value: (l) => l.savingsType },
          { key: 'route', label: 'Route', value: (l) => l.route, render: (l) => <Badge color={l.route === 'Technical' ? '#4f46e5' : l.route === 'Commercial' ? '#7c3aed' : l.route === 'Supplier change' ? '#0d9488' : l.route === 'Internal' ? '#db2777' : '#6b7280'}>{l.route}</Badge> },
          { key: 'evaluator', label: 'Evaluator', value: (l) => l.evaluator },
          { key: 'npdSample', label: 'NPD sample', value: (l) => l.npdSample },
          { key: 'ideas', label: 'Ideas', align: 'right', value: (l) => ideas.filter((i) => i.leverId === l.id).length },
          { key: 'active', label: 'Active', value: (l) => (l.active ? 'Active' : 'Inactive'), render: (l) => <span onClick={(e) => { e.stopPropagation(); toggle(l) }}><Toggle checked={l.active} onChange={() => undefined} disabled={ro} /></span> },
        ]} />
      <SectionIntro icon="Split">{LEVER_SPLIT_NOTE}</SectionIntro>
    </div>
  )
}

// ─── Route ────────────────────────────────────────────────────────────────────
export function RouteAdmin() {
  const levers = useStore((s) => s.levers)
  const slaRules = useStore((s) => s.slaRules)
  const ideas = useStore((s) => s.ideas)
  return (
    <div className="grid gap-3">
      <SectionIntro icon="Route">{LEVER_INTRO} Routes are the workflow's stage sequences; a lever chooses its route in the lever master, so no route is edited in code.</SectionIntro>
      {(Object.keys(ROUTE_STAGES) as RouteKey[]).map((r) => {
        const stages = ROUTE_STAGES[r]
        const ls = levers.filter((l) => l.route === r)
        const doc = ROUTES_TABLE.find((x) => x.route === r)
        const open = ideas.filter((i) => i.route === r && (i.bucket === 'Pipeline' || i.bucket === 'In Execution')).length
        return (
          <Card key={r} className="rounded-2xl" title={<span className="flex items-center gap-2">{r} route{r === 'To be confirmed' && <Badge color="#bf8f3f">Decision 1 — Strategic masking</Badge>}</span>} subtitle={doc?.stages ?? 'Route to be defined by Sourcing; uses the commercial sequence meanwhile'} icon="Route"
            actions={<span className="text-[11.5px] text-muted">{ls.length} levers · {open} open ideas</span>}>
            <div className="overflow-x-auto pb-1">
              <div className="flex items-stretch min-w-max">
                {stages.map((s, k) => {
                  const sla = slaRules.find((x) => x.stage === STAGE_SLA_KEY[s])
                  const cnt = ideas.filter((i) => i.route === r && i.stage === s).length
                  return (
                    <React.Fragment key={s}>
                      {k > 0 && <div className="flex items-center px-1"><div className="w-5 h-px bg-slate-300" /><Icon name="ChevronRight" size={13} className="text-slate-400 -ml-1" /></div>}
                      <div className={cn('w-[150px] rounded-xl border px-2.5 py-2', s === 'Approval' ? 'border-gold-200 bg-gold-50/60' : s === 'Implemented' ? 'border-emerald-200 bg-emerald-50/60' : 'border-line bg-white')}>
                        <div className="flex items-center gap-1.5"><span className="h-5 w-5 rounded-full bg-brand-grad text-white text-[10px] font-bold grid place-items-center">{k + 1}</span><span className="text-[11.5px] font-semibold text-ink leading-tight">{s}</span></div>
                        <div className="text-[10.5px] text-muted mt-1">{sla ? `SLA ${sla.slaDays} working days` : s === 'Implemented' ? 'Terminal stage' : 'Execution Hub owner & dates'}</div>
                        <div className="text-[10.5px] text-muted">{cnt} idea{cnt === 1 ? '' : 's'} here</div>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
              <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-muted mb-1">Categories on this route</div><div className="flex flex-wrap gap-1.5">{ls.length ? ls.map((l) => <LeverChip key={l.id} leverId={l.id} />) : <span className="text-[12px] text-muted">No category mapped</span>}</div></div>
              <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-muted mb-1">Execution milestones generated from the route</div><div className="flex flex-wrap gap-1">{MILESTONE_TEMPLATES[r].map((m, k) => <span key={m} className="text-[11px] px-2 h-6 inline-flex items-center rounded-md bg-slate-50 border border-slate-200 text-ink-2"><span className="text-muted mr-1">{k + 1}.</span>{m}</span>)}</div></div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Department (list editor) ─────────────────────────────────────────────────
export function DepartmentAdmin() {
  const departments = useStore((s) => s.departments)
  const users = useStore((s) => s.users)
  const ideas = useStore((s) => s.ideas)
  const setList = useStore((s) => s.setList)
  const toast = useStore((s) => s.toast)
  const ro = useRO()
  const [add, setAdd] = useState('')
  const commit = (list: string[], msg: string) => { const prev = departments; setList('departments', list); toast(msg, 'success', () => setList('departments', prev)) }
  const err = add.trim() && departments.some((d) => d.toLowerCase() === add.trim().toLowerCase()) ? 'Department already exists' : ''
  return (
    <Card className="rounded-2xl" title="Department master" subtitle="Submitting departments (auto-filled from login); drives F3 — ideas by department" icon="Building2">
      <SectionIntro>Any employee in these departments can submit ideas (Decision 7). Finance, Management, Sourcing Excellence and Supplier are system departments tied to their roles.</SectionIntro>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {departments.map((d, k) => {
          const u = users.filter((x) => x.department === d).length
          const n = ideas.filter((i) => i.department === d).length
          return (
            <div key={d} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
              <span className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center text-[11px] font-bold">{k + 1}</span>
              <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-ink">{d}</div><div className="text-[11px] text-muted">{u} users · {n} ideas</div></div>
              {!ro && <Button size="xs" variant="ghost" icon="Trash2" disabled={u > 0 || n > 0} title={u || n ? 'In use — cannot be removed' : 'Remove'} onClick={() => commit(departments.filter((x) => x !== d), `${d} removed`)} />}
            </div>
          )
        })}
      </div>
      {!ro && (
        <div className="flex flex-wrap items-start gap-2 mt-3">
          <div className="w-[280px]"><input className="input" placeholder="New department, e.g. Industrial Engineering" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !err && add.trim() && (commit([...departments, add.trim()], `${add.trim()} added`), setAdd(''))} />{err && <div className="text-[11.5px] text-red-600 mt-1">{err}</div>}</div>
          <Button variant="primary" icon="Plus" disabled={!add.trim() || !!err} onClick={() => { commit([...departments, add.trim()], `${add.trim()} added`); setAdd('') }}>Add department</Button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">{ALL_DEPTS.filter((d) => !departments.includes(d)).map((d) => <Badge key={d} color="#64748b">{d} · system</Badge>)}</div>
    </Card>
  )
}

// ─── Plant / BU ───────────────────────────────────────────────────────────────
export function PlantAdmin() {
  const { plants, ideas, users } = useLookups()
  const bus = [...new Set(plants.map((p) => p.bu))]
  return (
    <CrudSection<Plant> title="Plant / BU master" subtitle="Plant defaults to the user's plant on the form; reports split by plant / BU (Decision 8)" icon="Factory" entity="Plant" storeKey="plants" rows={plants}
      makeNew={() => ({ id: '', name: '', bu: bus[0] ?? 'RAC' })}
      fields={[
        { key: 'id', label: 'Plant code', type: 'text', required: true, lockOnEdit: true, placeholder: 'e.g. RJP' },
        { key: 'name', label: 'Plant name', type: 'text', required: true },
        { key: 'bu', label: 'Business unit (BU)', type: 'text', required: true, hint: `Existing: ${bus.join(', ')}` },
      ]}
      fromUi={(d) => ({ ...d, id: String(d.id).trim().toUpperCase() })}
      blockDelete={(p) => (ideas.some((i) => i.plant === p.id) || users.some((u) => u.plant === p.id) ? 'Plant is used by ideas or users — it cannot be deleted' : null)}
      extra={<div className="flex flex-wrap gap-2 mb-2">{bus.map((b) => <div key={b} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5"><Stat label={`BU · ${b}`} value={`${plants.filter((p) => p.bu === b).length} plants`} /></div>)}</div>}
      columns={[
        { key: 'id', label: 'Code', render: (p) => <span className="font-mono font-semibold text-brand-700">{p.id}</span> },
        { key: 'name', label: 'Plant', render: (p) => <span className="font-semibold">{p.name}</span> },
        { key: 'bu', label: 'BU', render: (p) => <Badge color="#bf8f3f">{p.bu}</Badge> },
        { key: 'users', label: 'Users', align: 'right', value: (p) => users.filter((u) => u.plant === p.id).length },
        { key: 'ideas', label: 'Ideas', align: 'right', value: (p) => ideas.filter((i) => i.plant === p.id).length },
      ]} />
  )
}

// ─── Users: user–role–commodity mapping ───────────────────────────────────────
export function UserAdmin() {
  const { users, commodities, plants, suppliers, ideas, departments } = useLookups()
  const upsert = useStore((s) => s.upsert)
  const toast = useStore((s) => s.toast)
  const ro = useRO()
  const [roleF, setRoleF] = useState<string>('All')
  const rows = roleF === 'All' ? users : users.filter((u) => u.roles.includes(roleF as RoleKey))
  const depts = [...new Set([...departments, ...ALL_DEPTS])]
  const fields: FieldSpec<User>[] = [
    { key: 'name', label: 'Full name', type: 'text', required: true },
    { key: 'employeeId', label: 'Employee ID / vendor code', type: 'text', required: true, placeholder: 'AEL-12345' },
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'department', label: 'Department', type: 'select', required: true, options: opt(depts) },
    { key: 'plant', label: 'Plant / BU', type: 'select', required: true, options: plants.map((p) => [p.id, `${p.name} · ${p.bu}`] as [string, string]) },
    { key: 'roles', label: 'Roles (one person can hold more than one)', type: 'multiselect', required: true, wide: true, options: ROLE_KEYS.map((r) => [r, ROLE_LABEL[r]] as [string, string]) },
    { key: 'commodities', label: 'Commodity mapping', type: 'multiselect', wide: true, options: commodities.map((c) => [c.code, c.code] as [string, string]), hint: 'Buyers and Leads see only mapped commodities; empty + an organisation-wide role = all' },
    { key: 'supplierCode', label: 'Vendor (supplier login)', type: 'select', options: suppliers.map((s) => [s.code, `${s.code} · ${s.name}`] as [string, string]), show: (d) => (d.roles ?? []).includes('supplier'), required: true },
    { key: 'active', label: 'Status', type: 'toggle' },
  ]
  const toggle = (u: User) => {
    if (ro) return
    const prev = useStore.getState().users
    upsert('users', { ...u, active: !u.active })
    toast(`${u.name} ${u.active ? 'deactivated — cannot sign in' : 'activated'}`, 'success', () => useStore.setState({ users: prev }))
  }
  const unmapped = commodities.filter((c) => !users.some((u) => u.active && u.roles.includes('buyer') && u.commodities.includes(c.code)))
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-9 gap-2">
        {ROLES.map((r) => {
          const n = users.filter((u) => u.roles.includes(r.key as RoleKey)).length
          return (
            <button key={r.key} onClick={() => setRoleF(roleF === r.key ? 'All' : r.key)} className={cn('rounded-xl border px-2.5 py-2 text-left transition', roleF === r.key ? 'border-brand-300 bg-brand-50 shadow-sm' : 'border-line bg-white hover:border-brand-200')} title={`${r.who} · ${r.visibility}`}>
              <div className="text-[18px] font-bold num text-ink leading-none">{n}</div>
              <div className="text-[11px] font-semibold text-ink-2 mt-1 truncate">{r.role}</div>
              <div className="text-[10px] text-muted truncate">Sees: {r.visibility}</div>
            </button>
          )
        })}
      </div>
      {unmapped.length > 0 && <SectionIntro icon="TriangleAlert">No active buyer is mapped to {unmapped.map((c) => c.name).join(', ')} — new ideas there will have no validator.</SectionIntro>}
      <CrudSection<User> title="Users — user–role–commodity mapping" subtitle={roleF === 'All' ? `${users.length} users · identity from single sign-on / AD` : `Filtered: ${ROLE_LABEL[roleF as RoleKey]}`} icon="UserCog" entity="User" storeKey="users" rows={rows}
        makeNew={() => ({ id: `u-${Date.now().toString(36)}`, name: '', employeeId: '', email: '', password: 'coin@2026', roles: ['submitter'], department: 'Sourcing', plant: plants[0]?.id ?? 'RJP', designation: '', commodities: [], avatarColor: AVATAR[users.length % AVATAR.length], active: true })}
        fields={fields} searchKeys={(u) => `${u.name} ${u.employeeId} ${u.email} ${u.designation} ${u.department}`}
        validate={(d, isNew) => {
          if (users.some((u) => u.id !== d.id && u.email.toLowerCase() === String(d.email).toLowerCase())) return 'Email already used by another user'
          if (users.some((u) => u.id !== d.id && u.employeeId.toLowerCase() === String(d.employeeId).toLowerCase())) return 'Employee ID already used by another user'
          if ((d.roles ?? []).includes('supplier') && d.roles.length > 1) return 'Supplier is a single external role and cannot be combined'
          void isNew
          return null
        }}
        fromUi={(d) => ({ ...d, supplierCode: d.roles.includes('supplier') ? d.supplierCode : undefined })}
        blockDelete={(u) => (ideas.some((i) => i.submitterId === u.id || i.buyerId === u.id || i.ownerId === u.id) || commodities.some((c) => c.buyerId === u.id || c.leadId === u.id) ? 'User is referenced by ideas or commodities — deactivate instead to keep the audit trail' : u.id === useStore.getState().userId ? 'You cannot delete your own account' : null)}
        toolbar={roleF !== 'All' && <Button size="sm" variant="ghost" icon="X" onClick={() => setRoleF('All')}>Clear role filter</Button>}
        columns={[
          { key: 'name', label: 'User', value: (u) => u.name, render: (u) => <span className="flex items-center gap-2 min-w-0"><Avatar name={u.name} color={u.avatarColor} size={26} /><span className="min-w-0"><span className="block text-[12.5px] font-semibold text-ink truncate">{u.name}</span><span className="block text-[11px] text-muted truncate max-w-[220px]">{u.designation}</span></span></span> },
          { key: 'employeeId', label: 'Employee ID', render: (u) => <span className="font-mono text-[11.5px]">{u.employeeId}</span> },
          { key: 'email', label: 'Email', render: (u) => <span className="text-ink-2">{u.email}</span> },
          { key: 'roles', label: 'Roles', value: (u) => u.roles.map((r) => ROLE_LABEL[r]).join(', '), render: (u) => <span className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} color={r === 'admin' ? '#bf8f3f' : r === 'head' ? '#2f5bc6' : r === 'supplier' ? '#0d9488' : '#475569'}>{ROLE_LABEL[r]}</Badge>)}</span> },
          { key: 'commodities', label: 'Commodities', value: (u) => u.commodities.join(', '), render: (u) => <span className="text-[11.5px] text-ink-2">{u.commodities.length ? u.commodities.join(' · ') : u.roles.some((r) => ['head', 'finance', 'mgmt', 'admin'].includes(r)) ? <Badge color="#2f5bc6">All (org-wide)</Badge> : '—'}</span> },
          { key: 'department', label: 'Department' },
          { key: 'plant', label: 'Plant', value: (u) => plants.find((p) => p.id === u.plant)?.name ?? u.plant },
          { key: 'active', label: 'Active', value: (u) => (u.active ? 'Active' : 'Inactive'), render: (u) => <span onClick={(e) => { e.stopPropagation(); toggle(u) }}><Toggle checked={u.active} onChange={() => undefined} disabled={ro} /></span> },
        ]} />
    </div>
  )
}

// ─── Vendor master ────────────────────────────────────────────────────────────
export function VendorAdmin() {
  const { suppliers, commodities, ideas } = useLookups()
  return (
    <CrudSection<Supplier> title="Vendor master" subtitle="From VMS — vendor code, name, commodity, contact email (supplier selection, workshop invites, supplier login)" icon="Factory" entity="Vendor" storeKey="suppliers" idKey="code" rows={suppliers}
      makeNew={() => ({ code: `V${10001 + suppliers.length}`, name: '', commodities: [], contactEmail: '', contactName: '', city: '', spend: 0 })}
      toUi={(s) => ({ ...s, spend: +(s.spend / CR).toFixed(2) })} fromUi={(d) => ({ ...d, spend: Math.round(Number(d.spend) * CR) })}
      fields={[
        { key: 'code', label: 'Vendor code', type: 'text', required: true, lockOnEdit: true },
        { key: 'name', label: 'Vendor name', type: 'text', required: true },
        { key: 'contactName', label: 'Contact name', type: 'text', required: true },
        { key: 'contactEmail', label: 'Contact email', type: 'email', required: true, hint: 'Receives workshop invites and time-bound secure links' },
        { key: 'city', label: 'City', type: 'text', required: true },
        { key: 'spend', label: 'Last FY spend', type: 'crore', required: true, min: 0, hint: 'Ranks top-N suppliers for KPI F1' },
        { key: 'commodities', label: 'Commodities supplied', type: 'multiselect', required: true, wide: true, options: commodities.map((c) => [c.code, c.name] as [string, string]) },
      ]}
      searchKeys={(s) => `${s.code} ${s.name} ${s.city} ${s.commodities.join(' ')}`}
      blockDelete={(s) => (ideas.some((i) => i.supplierCode === s.code || i.feasibility?.supplierCode === s.code) ? 'Vendor is linked to ideas — it cannot be deleted' : null)}
      columns={[
        { key: 'code', label: 'Code', render: (s) => <span className="font-mono font-semibold text-brand-700">{s.code}</span> },
        { key: 'name', label: 'Vendor', render: (s) => <span className="font-semibold text-ink">{s.name}</span> },
        { key: 'commodities', label: 'Commodities', value: (s) => s.commodities.join(', '), render: (s) => <span className="flex gap-1">{s.commodities.map((c) => <Badge key={c} color="#475569">{c}</Badge>)}</span> },
        { key: 'contactName', label: 'Contact' },
        { key: 'contactEmail', label: 'Email', render: (s) => <span className="text-ink-2">{s.contactEmail}</span> },
        { key: 'city', label: 'City' },
        { key: 'spend', label: 'Last FY spend', align: 'right', value: (s) => s.spend, render: (s) => <span className="num">{inrBig(s.spend)}</span> },
        { key: 'ideas', label: 'Ideas', align: 'right', value: (s) => ideas.filter((i) => i.supplierCode === s.code).length },
      ]} />
  )
}

// ─── Part master ──────────────────────────────────────────────────────────────
export function PartAdmin() {
  const parts = useStore((s) => s.parts)
  const { commodities, suppliers, plants, ideas } = useLookups()
  const [cf, setCf] = useState('All')
  const rows = useMemo(() => (cf === 'All' ? parts : parts.filter((p) => p.commodity === cf)), [parts, cf])
  return (
    <CrudSection<Part> title="Part master" subtitle="From ERP — LBP (from PAP), PO price and last FY MRN quantity drive baseline and volume auto-fill" icon="Package" entity="Part" storeKey="parts" idKey="code" rows={rows}
      makeNew={() => ({ code: '', description: '', uom: 'Nos', commodity: commodities[0]?.code ?? '', supplierCode: '', lbp: null, poPrice: 0, lastFyMrnQty: 0, plant: plants[0]?.id ?? 'RJP' })}
      fields={[
        { key: 'code', label: 'Part code', type: 'text', required: true, lockOnEdit: true },
        { key: 'description', label: 'Description', type: 'text', required: true, wide: true },
        { key: 'uom', label: 'UoM', type: 'select', required: true, options: opt(['Nos', 'Kg', 'Set', 'Mtr', 'Ltr', 'Trip', 'Month', 'kWh']) },
        { key: 'commodity', label: 'Commodity', type: 'select', required: true, options: commodities.map((c) => [c.code, `${c.code} · ${c.name}`] as [string, string]) },
        { key: 'supplierCode', label: 'Current supplier', type: 'select', required: true, options: (d: any) => suppliers.filter((s) => s.commodities.includes(d.commodity)).map((s) => [s.code, `${s.code} · ${s.name}`] as [string, string]) },
        { key: 'plant', label: 'Plant', type: 'select', required: true, options: plants.map((p) => [p.id, p.name] as [string, string]) },
        { key: 'lbp', label: 'Last buying price (LBP) ₹', type: 'number', nullable: true, min: 0, hint: 'Leave empty if no LBP — the PO price becomes the baseline' },
        { key: 'poPrice', label: 'Current PO price ₹', type: 'number', required: true, min: 0 },
        { key: 'lastFyMrnQty', label: 'Last FY MRN quantity', type: 'number', required: true, min: 0, hint: 'Annual volume for new ideas (MRN FY26)' },
      ]}
      searchKeys={(p) => `${p.code} ${p.description} ${p.commodity} ${p.supplierCode}`}
      blockDelete={(p) => (ideas.some((i) => i.parts.some((x) => x.partCode === p.code)) ? 'Part is used on ideas — it cannot be deleted' : null)}
      toolbar={<select className="input !h-8 !w-auto text-[12.5px]" value={cf} onChange={(e) => setCf(e.target.value)}><option value="All">All commodities</option>{commodities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>}
      columns={[
        { key: 'code', label: 'Part code', render: (p) => <span className="font-mono font-semibold text-brand-700">{p.code}</span> },
        { key: 'description', label: 'Description', render: (p) => <span className="block max-w-[280px] truncate font-medium text-ink">{p.description}</span> },
        { key: 'uom', label: 'UoM' },
        { key: 'commodity', label: 'Commodity' },
        { key: 'supplier', label: 'Supplier', value: (p) => suppliers.find((s) => s.code === p.supplierCode)?.name ?? p.supplierCode, render: (p) => <span className="text-ink-2">{p.supplierCode} · {suppliers.find((s) => s.code === p.supplierCode)?.name}</span> },
        { key: 'lbp', label: 'LBP', align: 'right', value: (p) => p.lbp ?? -1, render: (p) => (p.lbp != null ? <span className="num">{inrPrice(p.lbp)}</span> : <Badge color="#ec8a1c">No LBP</Badge>) },
        { key: 'poPrice', label: 'PO price', align: 'right', value: (p) => p.poPrice, render: (p) => <span className="num">{inrPrice(p.poPrice)}</span> },
        { key: 'lastFyMrnQty', label: 'Last FY MRN qty', align: 'right', value: (p) => p.lastFyMrnQty, render: (p) => <span className="num">{num(p.lastFyMrnQty)}</span> },
        { key: 'plant', label: 'Plant' },
      ]} />
  )
}

export const _m = { ActiveBadge }
