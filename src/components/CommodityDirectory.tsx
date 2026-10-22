// "Who leads which commodity" — the Sourcing commodity → team lead map (npd data · Development SPOC, Sourcing Corporate).
// Opened from the (i) buttons in the persona picker: by team lead (each lead and their commodities) or by commodity.
import { useEffect, useMemo, useState } from 'react'
import type { User } from '../lib/types'
import { useStore } from '../store/useStore'
import { Avatar, Icon, Modal, cn } from './ui'

type View = 'lead' | 'commodity'

export function CommodityDirectory({ open, onClose, focusLeadId, onPick, currentUserId }: {
  open: boolean; onClose: () => void; focusLeadId?: string | null; onPick?: (userId: string, label: string) => void; currentUserId?: string | null
}) {
  const users = useStore((s) => s.users)
  const commodities = useStore((s) => s.commodities)
  const categories = useStore((s) => s.categories)
  const [view, setView] = useState<View>('lead')
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => { if (open) { setView(focusLeadId ? 'lead' : 'commodity'); setFocus(focusLeadId ?? null); setQ('') } }, [open, focusLeadId])

  const leads = useMemo(() => users.filter((u) => u.active !== false && u.department === 'Sourcing' && u.roles.includes('teamlead')), [users])
  const leadOf = (code: string) => leads.find((u) => u.commodities.includes(code))
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id
  const k = q.trim().toLowerCase()
  const cMatch = (code: string) => { const c = commodities.find((x) => x.code === code); return !k || code.toLowerCase().includes(k) || (c?.name.toLowerCase().includes(k) ?? false) }
  const rows = useMemo(() => commodities
    .map((c) => ({ c, lead: leadOf(c.code) }))
    .filter(({ c, lead }) => !k || c.code.toLowerCase().includes(k) || c.name.toLowerCase().includes(k) || (lead?.name.toLowerCase().includes(k) ?? false) || catName(c.categoryId).toLowerCase().includes(k))
    .sort((a, b) => a.c.code.localeCompare(b.c.code)), [commodities, leads, k]) // eslint-disable-line react-hooks/exhaustive-deps
  const leadCards = leads
    .filter((u) => !focus || u.id === focus)
    .map((u) => ({ u, codes: u.commodities.filter((code) => u.name.toLowerCase().includes(k) || cMatch(code)) }))
    .filter(({ u, codes }) => !k || u.name.toLowerCase().includes(k) || codes.length)
  const nameOf = (code: string) => commodities.find((c) => c.code === code)?.name ?? code
  const signIn = (u: User) => { onPick?.(u.id, `${u.name} · Sourcing team lead`); onClose() }
  const focused = focus ? leads.find((u) => u.id === focus) : undefined

  return (
    <Modal open={open} onClose={onClose} size="lg" icon="BookUser"
      title={focused ? `${focused.name} — team lead for ${focused.commodities.length} ${focused.commodities.length === 1 ? 'commodity' : 'commodities'}` : 'Who leads which commodity'}
      subtitle={`Sourcing · ${commodities.length} commodities · ${leads.length} team leads · a Sourcing idea goes to the team lead of its commodity for the team feasibility check`}
      footer={<span className="mr-auto text-[11.5px] text-muted flex items-center gap-1.5"><Icon name="FileSpreadsheet" size={13} />Source: npd data — Development SPOC (Sourcing Corporate)</span>}>
      <div className="flex flex-wrap items-center gap-2 mb-3 sticky -top-4 z-10 bg-white py-1 -mt-1">
        <div className="inline-grid grid-cols-2 p-0.5 rounded-xl bg-black/[.04]">
          {([['lead', `By team lead · ${leads.length}`, 'UsersRound'], ['commodity', `By commodity · ${commodities.length}`, 'Boxes']] as [View, string, string][]).map(([key, label, icon]) => (
            <button key={key} type="button" onClick={() => { setView(key); if (key === 'commodity') setFocus(null) }}
              className={cn('h-8 px-3 rounded-[10px] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors', view === key ? 'bg-white text-brand-800 shadow-[0_1px_3px_rgb(15_27_51/.12)]' : 'text-ink-2 hover:text-ink')}>
              <Icon name={icon} size={13} />{label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a commodity, code or team lead…" aria-label="Search commodities and team leads"
            className="w-full h-8 pl-8 pr-2 rounded-lg border border-black/[.08] bg-white text-[12.5px] outline-none focus:border-brand-300" />
        </div>
        {focused && view === 'lead' && (
          <button type="button" onClick={() => setFocus(null)} className="h-8 px-2.5 rounded-lg text-[12px] font-semibold text-brand-700 hover:bg-brand-50 inline-flex items-center gap-1">
            <Icon name="UsersRound" size={13} />All {leads.length} team leads
          </button>
        )}
      </div>

      {view === 'lead' && (
        <div className="flex flex-col gap-2">
          {leadCards.map(({ u, codes }) => (
            <div key={u.id} className={cn('rounded-xl border p-3', u.id === currentUserId ? 'border-brand-300 bg-brand-50/40' : 'border-black/[.08]')}>
              <div className="flex items-center gap-3">
                <Avatar name={u.name} color={u.avatarColor} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink truncate">{u.name}</div>
                  <div className="text-[11.5px] text-muted truncate">{u.employeeId} · {u.email}</div>
                </div>
                <span className="text-[11.5px] font-semibold text-ink-2 bg-black/[.04] rounded-full px-2 h-6 inline-flex items-center num shrink-0">
                  {k && codes.length !== u.commodities.length ? `${codes.length} of ${u.commodities.length}` : u.commodities.length} {u.commodities.length === 1 ? 'commodity' : 'commodities'}
                </span>
                {onPick && (u.id === currentUserId
                  ? <span className="text-[11.5px] font-semibold text-brand-700 inline-flex items-center gap-1 shrink-0"><Icon name="Check" size={13} />Signed in</span>
                  : <button type="button" onClick={() => signIn(u)} className="h-7 px-2.5 rounded-lg bg-brand-700 text-white text-[11.5px] font-semibold hover:bg-brand-800 inline-flex items-center gap-1 shrink-0">Sign in<Icon name="ArrowRight" size={12} /></button>)}
              </div>
              <div className="flex flex-wrap gap-1 mt-2.5">
                {(k && !u.name.toLowerCase().includes(k) ? codes : u.commodities).map((code) => (
                  <span key={code} className={cn('inline-flex items-center gap-1 h-6 pl-1 pr-2 rounded-md border text-[11.5px]', k && cMatch(code) ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-black/[.07] bg-[var(--color-slate-50)] text-ink-2')}>
                    <span className="font-mono text-[10.5px] font-semibold text-muted bg-white rounded px-1">{code}</span>{nameOf(code)}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!leadCards.length && <Empty q={q} />}
        </div>
      )}

      {view === 'commodity' && (
        rows.length ? (
          <div className="rounded-xl border border-black/[.08] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[var(--color-slate-50)] text-[11px] uppercase tracking-wide text-muted">
                <tr><th className="text-left font-semibold px-3 py-2 w-[70px]">Code</th><th className="text-left font-semibold px-3 py-2">Commodity</th><th className="text-left font-semibold px-3 py-2 hidden sm:table-cell">Group</th><th className="text-left font-semibold px-3 py-2">Team lead</th></tr>
              </thead>
              <tbody>
                {rows.map(({ c, lead }) => (
                  <tr key={c.code} className="border-t border-black/[.05] hover:bg-[var(--color-slate-50)]">
                    <td className="px-3 py-1.5 font-mono text-[11.5px] font-semibold text-ink-2">{c.code}</td>
                    <td className="px-3 py-1.5 text-ink">{c.name}</td>
                    <td className="px-3 py-1.5 text-muted hidden sm:table-cell">{catName(c.categoryId)}</td>
                    <td className="px-3 py-1.5">
                      {lead ? (
                        <button type="button" onClick={() => { setFocus(lead.id); setView('lead'); setQ('') }} title={`See all of ${lead.name}'s commodities`}
                          className="inline-flex items-center gap-1.5 rounded-md hover:bg-brand-50 pr-1.5 -ml-0.5 pl-0.5 py-0.5">
                          <Avatar name={lead.name} color={lead.avatarColor} size={20} /><span className="font-semibold text-ink">{lead.name}</span>
                        </button>
                      ) : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty q={q} />
      )}
    </Modal>
  )
}

function Empty({ q }: { q: string }) {
  return <div className="text-center text-[12.5px] text-muted py-8">Nothing matches “{q}”.</div>
}
