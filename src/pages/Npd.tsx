// NPD development master — read-only view of the VMS (Vendor Management System) extract "npd data.xlsx".
// Commodity codes → development SPOC per plant / product line, DQA SPOC and the performance / reliability testing schedule.
// Approved ideas on NPD routes (ECN → sample) pick their development SPOC and DQA schedule from here. Edit in VMS, not in COIN.
import React, { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { fmtDateTime } from '../lib/format'
import { NPD_COMMODITIES, NPD_SOURCE, NPD_SPOC_COLUMNS, PAYMENT_METHODS, VENDOR_GROUPS, type NpdCommodity, type NpdSpoc } from '../lib/npd'
import { Avatar, Badge, Button, Icon, Tabs, Tooltip, cn } from '../components/ui'

// ─── derived data ─────────────────────────────────────────────────────────────
type Row = NpdCommodity & { id: string; people: string[]; plantKeys: (keyof NpdSpoc)[]; hasTest: boolean }
const ROWS: Row[] = NPD_COMMODITIES.map((c, i) => {
  const plantKeys = NPD_SPOC_COLUMNS.map((x) => x.key).filter((k) => k !== 'corporate' && !!c.spoc[k])
  return {
    ...c,
    id: c.code || `nocode-${i}`,
    people: Array.from(new Set(Object.values(c.spoc).filter(Boolean) as string[])),
    plantKeys,
    hasTest: c.perfDays != null || c.relDays != null,
  }
})
const WITH_SPOC = ROWS.filter((r) => r.spoc.corporate).length
const WITH_TEST = ROWS.filter((r) => r.hasTest)
const NO_CODE = ROWS.filter((r) => !r.code).length
const CORPORATE_PEOPLE = Array.from(new Set(ROWS.map((r) => r.spoc.corporate).filter(Boolean) as string[]))
const ALL_PEOPLE = Array.from(new Set(ROWS.flatMap((r) => r.people)))
const PLANT_PEOPLE = ALL_PEOPLE.filter((p) => !CORPORATE_PEOPLE.includes(p))
const COL = Object.fromEntries(NPD_SPOC_COLUMNS.map((c) => [c.key, c])) as Record<keyof NpdSpoc, (typeof NPD_SPOC_COLUMNS)[number]>
const colLabel = (k: keyof NpdSpoc) => {
  const c = COL[k]
  if (k === 'dqa') return 'DQA'
  if (k === 'specialProjects') return 'Special projects'
  return c.plant === 'Rajpura' && (k === 'waterDispenser' || k === 'airPurifier') ? c.label : `${c.label} · ${c.plant}`
}
/** VMS shouts some names ("PUNCHING OIL"); sentence-case only plain all-caps words, keep codes such as FG-IDU, LPG, CO2 */
const nice = (s: string) => (/^[A-Z ]+$/.test(s) && /[A-Z]{5,}/.test(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s)

// calm, low-saturation avatar palette (keeps the page from going "too blue")
const AV = ['#475467', '#3f6c84', '#2f7d6d', '#5d6b8a', '#7a6548', '#6a5a8c', '#4f7a5a', '#80586a', '#3e5f7a', '#6b6f45']
const avColor = (name: string) => AV[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length]

const PAGE = 14
const PAY_GLOSS: Record<string, string> = {
  'By Cheque': 'Account-payee cheque',
  LC: 'Letter of credit, usual for imports',
  'NEFT/RTGS': 'Domestic bank transfer',
  PDC: 'Post-dated cheque',
  TT: 'Telegraphic transfer, overseas remittance',
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function Npd() {
  const [tab, setTab] = useState<'spoc' | 'dir' | 'vendor'>('spoc')
  const [q, setQ] = useState('')
  const [person, setPerson] = useState('All')
  const [scope, setScope] = useState<'all' | 'assigned' | 'unassigned' | 'testing'>('all')
  const [page, setPage] = useState(0)
  const [selId, setSelId] = useState(ROWS[0].id)

  const openVms = () => useStore.getState().toast('Opening VMS is not available in this demo. Edit SPOCs and testing days in VMS; COIN picks them up on the next sync.', 'info')

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return ROWS.filter((r) => {
      if (scope === 'assigned' && !r.spoc.corporate) return false
      if (scope === 'unassigned' && r.spoc.corporate) return false
      if (scope === 'testing' && !r.hasTest) return false
      if (person === '__none' && r.spoc.corporate) return false
      if (person !== 'All' && person !== '__none' && !r.people.includes(person)) return false
      if (t && !`${r.code} ${r.name} ${r.people.join(' ')}`.toLowerCase().includes(t)) return false
      return true
    })
  }, [q, person, scope])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const pg = Math.min(page, pages - 1)
  const shown = filtered.slice(pg * PAGE, pg * PAGE + PAGE)
  const sel = ROWS.find((r) => r.id === selId) ?? ROWS[0]

  const focusPerson = (p: string) => { setPerson(p); setScope('all'); setQ(''); setPage(0); setTab('spoc'); const first = ROWS.find((r) => p === '__none' ? !r.spoc.corporate : r.people.includes(p)); if (first) setSelId(first.id) }

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-[#101828] text-white grid place-items-center shrink-0 shadow-[0_6px_16px_-10px_rgb(16_24_40/.8)]">
            <Icon name="PackageSearch" size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] leading-tight font-bold tracking-[-0.02em] text-ink">NPD development master</h1>
              <Badge color="#475467" soft="#f2f4f7" icon="Lock">Read-only</Badge>
            </div>
            <p className="text-[12.5px] text-muted mt-0.5">Who develops each commodity on an NPD route (ECN → sample), and how long DQA performance and reliability testing takes.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" icon="ExternalLink" onClick={openVms}>Open in VMS</Button>
      </div>

      {/* provenance strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-[12px] text-ink-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <span className="h-5 px-1.5 rounded-md bg-[#101828] text-white text-[10.5px] font-bold tracking-wide grid place-items-center">{NPD_SOURCE.system}</span>
          Synced from VMS
        </span>
        <Dot />
        <span className="inline-flex items-center gap-1"><Icon name="Lock" size={12} className="text-muted" />Read-only in COIN</span>
        <Dot />
        <span className="inline-flex items-center gap-1"><Icon name="RefreshCw" size={12} className="text-muted" />Last sync <b className="font-semibold text-ink num">{fmtDateTime(NPD_SOURCE.syncedAt)}</b></span>
        <Dot />
        <span className="inline-flex items-center gap-1"><Icon name="FileSpreadsheet" size={12} className="text-muted" />Source <span className="font-mono text-[11.5px] text-ink">{NPD_SOURCE.file}</span></span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-muted"><span className="h-1.5 w-1.5 rounded-full bg-accent-500" />Changes are made in VMS and flow in on the next sync</span>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon="Boxes" label="Commodity codes" value={ROWS.length} sub={`${ROWS.length - NO_CODE} coded · ${NO_CODE} gases without a code`} />
        <StatTile icon="UserCheck" label="With a development SPOC" value={WITH_SPOC} pct={WITH_SPOC / ROWS.length} sub={`${ROWS.length - WITH_SPOC} still unassigned in VMS`} onClick={() => { setPerson('All'); setScope('assigned'); setPage(0); setTab('spoc') }} />
        <StatTile icon="FlaskConical" label="With a testing schedule" value={WITH_TEST.length} pct={WITH_TEST.length / ROWS.length} sub={WITH_TEST.length ? `Only ${WITH_TEST.map((r) => `${r.code} ${r.name}`).join(', ')} so far` : 'None yet'} warn onClick={() => { setPerson('All'); setScope('testing'); setPage(0); setTab('spoc') }} />
        <StatTile icon="Users" label="Distinct SPOCs" value={ALL_PEOPLE.length} sub={`${CORPORATE_PEOPLE.length} corporate · ${PLANT_PEOPLE.length} plant and DQA`} onClick={() => setTab('dir')} />
      </div>

      <Tabs layoutId="npd-tabs" value={tab} onChange={(k) => setTab(k as any)} tabs={[
        { key: 'spoc', label: 'Commodity SPOCs', icon: 'ListTree', count: ROWS.length },
        { key: 'dir', label: 'SPOC directory', icon: 'Contact', count: ALL_PEOPLE.length },
        { key: 'vendor', label: 'Vendor groups & payment', icon: 'Landmark', count: VENDOR_GROUPS.length },
      ]} />

      {tab === 'spoc' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
          <section className="card min-w-0">
            {/* toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3.5 pb-3 border-b border-line">
              <div className="relative w-[236px]">
                <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input !h-8 !pl-8 !text-[12.5px]" placeholder="Search code, commodity or SPOC" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
              </div>
              <select className="input !h-8 !w-[180px] !text-[12.5px]" value={person} onChange={(e) => { setPerson(e.target.value); setPage(0) }}>
                <option value="All">All SPOCs</option>
                <optgroup label="Corporate development SPOC">
                  {CORPORATE_PEOPLE.slice().sort().map((p) => <option key={p} value={p}>{p} ({ROWS.filter((r) => r.people.includes(p)).length})</option>)}
                </optgroup>
                <optgroup label="Plant and DQA SPOC">
                  {PLANT_PEOPLE.slice().sort().map((p) => <option key={p} value={p}>{p} ({ROWS.filter((r) => r.people.includes(p)).length})</option>)}
                </optgroup>
                <option value="__none">No corporate SPOC ({ROWS.length - WITH_SPOC})</option>
              </select>
              <div className="inline-flex items-center rounded-lg border border-line bg-[#f8f9fb] p-0.5">
                {([['all', 'All'], ['assigned', 'Assigned'], ['unassigned', 'Unassigned'], ['testing', 'Has testing']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => { setScope(k); setPage(0) }} className={cn('h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors', scope === k ? 'bg-white text-ink shadow-[0_1px_2px_rgb(16_24_40/.1)]' : 'text-muted hover:text-ink')}>{l}</button>
                ))}
              </div>
              {(q || person !== 'All' || scope !== 'all') && (
                <button className="text-[12px] text-muted hover:text-ink inline-flex items-center gap-1" onClick={() => { setQ(''); setPerson('All'); setScope('all'); setPage(0) }}><Icon name="X" size={12} />Clear</button>
              )}
              <span className="ml-auto text-[12px] text-muted num">{filtered.length} of {ROWS.length}</span>
            </div>

            <table className="tbl table-fixed">
              <colgroup><col style={{ width: 74 }} /><col /><col style={{ width: 178 }} /><col style={{ width: 122 }} /><col style={{ width: 316 }} /></colgroup>
              <thead><tr><th>Code</th><th>Commodity</th><th>Corporate SPOC</th><th>Testing (perf / rel)</th><th>Plant and DQA SPOCs</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className={cn('clickable', r.id === sel.id && '!bg-[#f6f8fb] [&>td:first-child]:shadow-[inset_2px_0_0_#2459e0]')} onClick={() => setSelId(r.id)}>
                    <td>{r.code ? <span className="font-mono text-[12px] font-semibold text-ink">{r.code}</span> : <span className="text-[11px] text-muted italic">no code</span>}</td>
                    <td className="truncate"><span className="text-ink font-medium" title={r.name}>{nice(r.name)}</span></td>
                    <td className="truncate">{r.spoc.corporate ? <span className="inline-flex items-center gap-1.5 min-w-0"><Avatar name={r.spoc.corporate} color={avColor(r.spoc.corporate)} size={20} /><span className="truncate">{r.spoc.corporate}</span></span> : <span className="text-[12px] text-[#98a2b3]">Not assigned</span>}</td>
                    <td>{r.hasTest ? <span className="inline-flex items-center gap-1 text-[12px]"><TestPill d={r.perfDays} /><span className="text-muted">/</span><TestPill d={r.relDays} /></span> : <span className="text-muted">—</span>}</td>
                    <td className="truncate">
                      {r.plantKeys.length ? (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          {r.plantKeys.slice(0, 2).map((k) => <PlantChip key={k} k={k} name={r.spoc[k]!} />)}
                          {r.plantKeys.length > 2 && (
                            <Tooltip content={<div className="space-y-0.5">{r.plantKeys.slice(2).map((k) => <div key={k}>{colLabel(k)}: <b>{r.spoc[k]}</b></div>)}</div>}>
                              <span className="h-5 px-1.5 rounded-md bg-[#f2f4f7] text-[11px] font-semibold text-ink-2 grid place-items-center">+{r.plantKeys.length - 2}</span>
                            </Tooltip>
                          )}
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={5} className="!h-28 text-center text-muted">No commodity matches these filters.</td></tr>}
              </tbody>
            </table>

            {/* pagination */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-line text-[12px] text-muted">
              <span className="num">{filtered.length ? `Showing ${pg * PAGE + 1}–${Math.min(filtered.length, pg * PAGE + PAGE)} of ${filtered.length}` : 'Nothing to show'}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="xs" icon="ChevronLeft" disabled={pg === 0} onClick={() => setPage(pg - 1)}>Previous</Button>
                {Array.from({ length: pages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)} className={cn('h-7 min-w-7 px-1.5 rounded-md text-[12px] font-medium num', i === pg ? 'bg-[#101828] text-white' : 'text-ink-2 hover:bg-[#f2f4f7]')}>{i + 1}</button>
                ))}
                <Button variant="ghost" size="xs" iconRight="ChevronRight" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Next</Button>
              </div>
            </div>
          </section>

          <DetailPanel row={sel} onPerson={focusPerson} />
        </div>
      )}

      {tab === 'dir' && <Directory onPerson={focusPerson} />}
      {tab === 'vendor' && <VendorTab />}
    </div>
  )
}

// ─── pieces ───────────────────────────────────────────────────────────────────
const Dot = () => <span className="h-1 w-1 rounded-full bg-[#c4cad6]" />

function StatTile({ icon, label, value, sub, pct, warn, onClick }: { icon: string; label: string; value: number; sub: string; pct?: number; warn?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={cn('card text-left px-4 py-3.5 min-w-0 transition-colors', onClick && 'hover:border-[#cfd6e2]')}>
      <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
        <span className="h-6 w-6 rounded-md bg-[#f2f4f7] text-ink-2 grid place-items-center"><Icon name={icon} size={13} /></span>
        {label}
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="text-[24px] leading-none font-bold tracking-[-0.02em] text-ink num">{value}</span>
        {pct != null && <span className={cn('text-[12px] font-semibold num', warn ? 'text-[#b54708]' : 'text-accent-700')}>{Math.round(pct * 1000) / 10}%</span>}
      </div>
      {pct != null && (
        <div className="mt-2 h-1.5 rounded-full bg-[#eef0f4] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(pct * 100, 1.5)}%`, background: warn ? '#dc8a3c' : '#14ab92' }} /></div>
      )}
      {pct == null && <div className="mt-2 h-1.5" />}
      <div className="text-[11.5px] text-muted mt-2 truncate" title={sub}>{sub}</div>
    </button>
  )
}

function TestPill({ d }: { d: number | null }) {
  return d == null ? <span className="text-muted">—</span> : <span className="num font-semibold text-ink">{d}d</span>
}

function PlantChip({ k, name }: { k: keyof NpdSpoc; name: string }) {
  const short = k === 'dqa' ? 'DQA' : k === 'specialProjects' ? 'Special' : k === 'waterDispenser' ? 'WD' : k === 'airPurifier' ? 'AP' : k === 'gradeARajpura' ? 'Grade A' : k === 'cacRajpura' ? 'CAC' : COL[k].plant
  return (
    <Tooltip content={<span>{colLabel(k)}: <b>{name}</b></span>}>
      <span className="inline-flex items-center h-5 rounded-md border border-line bg-white text-[11px] overflow-hidden max-w-[148px]">
        <span className="px-1 bg-[#f4f6f9] text-muted font-medium h-full grid place-items-center shrink-0">{short}</span>
        <span className="px-1.5 text-ink-2 truncate">{name}</span>
      </span>
    </Tooltip>
  )
}

function DetailPanel({ row, onPerson }: { row: Row; onPerson: (p: string) => void }) {
  const groups: { title: string; keys: (keyof NpdSpoc)[] }[] = [
    { title: 'Corporate', keys: ['corporate'] },
    { title: 'RAC / CAC plants', keys: ['racRajpura', 'racJhajjar', 'racSricity'] },
    { title: 'Rajpura product lines', keys: ['gradeARajpura', 'cacRajpura', 'waterDispenser', 'airPurifier'] },
    { title: 'All plants', keys: ['specialProjects', 'dqa'] },
  ]
  const filled = NPD_SPOC_COLUMNS.filter((c) => row.spoc[c.key]).length
  return (
    <aside className="card xl:sticky xl:top-4 min-w-0">
      <div className="px-4 pt-3.5 pb-3 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="h-7 min-w-7 px-1.5 rounded-md bg-[#f2f4f7] font-mono text-[12px] font-bold text-ink grid place-items-center">{row.code || '—'}</span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink truncate">{nice(row.name)}</div>
            <div className="text-[11.5px] text-muted">{filled} of {NPD_SPOC_COLUMNS.length} SPOC fields filled in VMS</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-line">
        <div className="text-[11px] font-semibold text-muted mb-2">DQA testing schedule</div>
        {row.hasTest ? (
          <div className="grid grid-cols-2 gap-2">
            {[['Performance', row.perfDays], ['Reliability', row.relDays]].map(([l, d]) => (
              <div key={l as string} className="rounded-lg border border-line px-2.5 py-2">
                <div className="text-[11px] text-muted">{l}</div>
                <div className="text-[16px] font-bold text-ink num">{d == null ? '—' : <>{d}<span className="text-[11.5px] font-medium text-muted ml-0.5">days</span></>}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-[#fffaeb] border border-[#fde7b0] px-2.5 py-2 text-[12px] text-[#93370d]">
            <Icon name="CalendarClock" size={13} />Not scheduled in VMS yet
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <div className="text-[11px] font-semibold text-muted mb-1">SPOC matrix</div>
        {groups.map((g) => (
          <div key={g.title} className="mt-2">
            <div className="text-[10.5px] font-semibold text-[#98a2b3] mb-0.5">{g.title}</div>
            {g.keys.map((k) => {
              const v = row.spoc[k]
              return (
                <div key={k} className="flex items-center justify-between gap-2 h-7 text-[12px] border-b border-dashed border-[#eceff4] last:border-0">
                  <span className="text-ink-2 truncate">{k === 'corporate' ? 'Sourcing development' : k === 'dqa' ? 'DQA' : k === 'specialProjects' ? 'Special projects' : `${COL[k].label}${g.title.startsWith('RAC') ? ` · ${COL[k].plant}` : ''}`}</span>
                  {v ? (
                    <button onClick={() => onPerson(v)} className="inline-flex items-center gap-1.5 min-w-0 font-medium text-ink hover:text-brand-700" title={`Show all commodities for ${v}`}>
                      <Avatar name={v} color={avColor(v)} size={18} /><span className="truncate">{v}</span>
                    </button>
                  ) : <span className="text-[#c0c6d1]">—</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </aside>
  )
}

function Directory({ onPerson }: { onPerson: (p: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const people = CORPORATE_PEOPLE.map((p) => ({ name: p, rows: ROWS.filter((r) => r.spoc.corporate === p) })).sort((a, b) => b.rows.length - a.rows.length)
  const max = people[0]?.rows.length ?? 1
  const unassigned = ROWS.filter((r) => !r.spoc.corporate)
  const plant = PLANT_PEOPLE.map((p) => ({ name: p, roles: ROWS.flatMap((r) => r.plantKeys.filter((k) => r.spoc[k] === p).map((k) => ({ k, code: r.code || r.name }))) }))
  const LIMIT = 9
  const toggle = (n: string) => setOpen((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x })

  const chips = (key: string, rows: Row[]) => {
    const all = open.has(key)
    const list = all ? rows : rows.slice(0, LIMIT)
    return (
      <div className="flex flex-wrap gap-1 mt-3">
        {list.map((r) => (
          <span key={r.id} title={r.name} className="inline-flex items-center h-[22px] rounded-md border border-line bg-[#fafbfc] text-[11px] overflow-hidden max-w-full">
            <span className="px-1 font-mono font-semibold text-ink">{r.code || '·'}</span>
            <span className="pr-1.5 text-muted truncate max-w-[120px]">{nice(r.name)}</span>
          </span>
        ))}
        {rows.length > LIMIT && (
          <button onClick={() => toggle(key)} className="h-[22px] px-2 rounded-md text-[11px] font-semibold text-ink-2 hover:bg-[#f2f4f7]">{all ? 'Show less' : `+${rows.length - LIMIT} more`}</button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle title="Corporate development SPOCs" sub={`${people.length} sourcing SPOCs own ${WITH_SPOC} of ${ROWS.length} commodity codes`} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {people.map((p) => (
            <div key={p.name} className="card px-4 py-3.5 min-w-0 flex flex-col">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} color={avColor(p.name)} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink truncate">{p.name}</div>
                  <div className="text-[11.5px] text-muted">Sourcing corporate · development SPOC</div>
                </div>
                <div className="text-right">
                  <div className="text-[18px] font-bold text-ink num leading-none">{p.rows.length}</div>
                  <div className="text-[10.5px] text-muted">codes</div>
                </div>
              </div>
              <div className="mt-2.5 h-1 rounded-full bg-[#eef0f4] overflow-hidden"><div className="h-full rounded-full bg-[#98a2b3]" style={{ width: `${(p.rows.length / max) * 100}%` }} /></div>
              {chips(p.name, p.rows)}
              <button onClick={() => onPerson(p.name)} className="mt-auto pt-3 self-start text-[12px] font-medium text-brand-700 hover:underline inline-flex items-center gap-1">View in commodity list<Icon name="ArrowRight" size={12} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start">
        <div className="card px-4 py-3.5 min-w-0">
          <SectionTitle title="Plant and DQA SPOCs" sub="Filled only for Aluminium (AA) so far" tight />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            {plant.map((p) => (
              <button key={p.name} onClick={() => onPerson(p.name)} className="flex items-center gap-2.5 py-2 border-b border-dashed border-[#eceff4] text-left min-w-0 hover:bg-[#fafbfc]">
                <Avatar name={p.name} color={avColor(p.name)} size={24} />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink truncate">{p.name}</div>
                  <div className="text-[11px] text-muted truncate">{p.roles.map((r) => `${colLabel(r.k)} (${r.code})`).join(', ')}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="card px-4 py-3.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <SectionTitle title="Without a corporate SPOC" sub={`${unassigned.length} commodity codes, mostly finished goods and services. Assign in VMS.`} tight />
            <Badge color="#b54708" soft="#fffaeb">{unassigned.length} gaps</Badge>
          </div>
          {chips('__none', unassigned)}
          <button onClick={() => onPerson('__none')} className="mt-3 text-[12px] font-medium text-brand-700 hover:underline inline-flex items-center gap-1">View in commodity list<Icon name="ArrowRight" size={12} /></button>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ title, sub, tight }: { title: string; sub?: string; tight?: boolean }) {
  return (
    <div className={cn(tight ? 'mb-2' : 'mb-2.5')}>
      <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </div>
  )
}

function VendorTab() {
  const dom = VENDOR_GROUPS.filter((g) => g.kind === 'Domestic')
  const imp = VENDOR_GROUPS.filter((g) => g.kind === 'Import')
  const list = (rows: typeof VENDOR_GROUPS) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
      {rows.map((g) => (
        <div key={g.code} className="flex items-center gap-2.5 h-9 border-b border-dashed border-[#eceff4] min-w-0">
          <span className="font-mono text-[11.5px] font-semibold text-ink w-[86px] shrink-0">{g.code}</span>
          <span className="text-[12.5px] text-ink-2 truncate">{g.name.replace(/^Creditors\s+/i, '').replace('Staturoty', 'Statutory').replace(/^./, (c) => c.toUpperCase())}</span>
        </div>
      ))}
    </div>
  )
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        <div className="card px-4 py-3.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <SectionTitle title="Domestic creditor groups" sub="Vendor account groups used when a supplier is created in VMS" tight />
            <Badge color="#475467" soft="#f2f4f7">{dom.length} groups</Badge>
          </div>
          {list(dom)}
        </div>
        <div className="card px-4 py-3.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <SectionTitle title="Import creditor groups" sub="Overseas suppliers: raw material, capex, expense and service" tight />
            <Badge color="#0b8a77">{imp.length} groups</Badge>
          </div>
          {list(imp)}
        </div>
      </div>
      <div className="card px-4 py-3.5 min-w-0">
        <SectionTitle title="Payment methods" sub={`${PAYMENT_METHODS.length} methods allowed on vendor records`} tight />
        <div className="mt-1">
          {PAYMENT_METHODS.map((m) => (
            <div key={m} className="flex items-center gap-3 py-2.5 border-b border-dashed border-[#eceff4] last:border-0">
              <span className="h-8 w-8 rounded-lg bg-[#f2f4f7] text-ink-2 grid place-items-center shrink-0"><Icon name={m === 'LC' || m === 'TT' ? 'Globe' : m.includes('Cheque') || m === 'PDC' ? 'FileText' : 'ArrowLeftRight'} size={14} /></span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-ink">{m}</div>
                <div className="text-[11.5px] text-muted">{PAY_GLOSS[m] ?? '—'}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-[#f8f9fb] border border-line px-3 py-2 text-[11.5px] text-muted flex gap-2">
          <Icon name="Info" size={13} className="shrink-0 mt-0.5" />Reference lists from VMS. COIN shows them for context; vendor creation and payment terms stay in VMS.
        </div>
      </div>
    </div>
  )
}
