// Contributor leaderboard — Decision 9: visible to all users, top 10 contributors per quarter (reward only; no payout, Section 16)
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useMe } from '../../store/useStore'
import { ideaAnnualised } from '../../lib/calc'
import { fyStartYear, inrShort, quarterOf, QUARTER_MONTHS, todayIso } from '../../lib/format'
import { can } from '../../lib/nav'
import { Avatar, Button, Card, EmptyState, Icon, InfoTip, ProgressBar, Segmented, Tooltip, cn } from '../../components/ui'
import { useFy } from './shared'

type Q = 'Q1' | 'Q2' | 'Q3' | 'Q4'
const MEDAL = ['#bf8f3f', '#94a3b8', '#b45309']

interface Row { userId: string; name: string; dept: string; color: string; ideas: number; value: number; implemented: number; maxIdea: number; supplier: boolean; campaign: number }

export function Leaderboard({ className, limit = 10 }: { className?: string; limit?: number }) {
  const ideas = useStore((s) => s.ideas)
  const users = useStore((s) => s.users)
  const suppliers = useStore((s) => s.suppliers)
  const currentFy = useStore((s) => s.settings.currentFy)
  const me = useMe()
  const nav = useNavigate()
  const fy = useFy()

  const byQuarter = useMemo(() => {
    const res: Record<Q, Row[]> = { Q1: [], Q2: [], Q3: [], Q4: [] }
    const map: Record<Q, Map<string, Row>> = { Q1: new Map(), Q2: new Map(), Q3: new Map(), Q4: new Map() }
    for (const i of ideas) {
      if (i.fy !== fy || i.stage === 'Draft' || !i.submittedAt) continue
      const q = quarterOf(i.submittedAt.slice(0, 10)) as Q
      const u = users.find((x) => x.id === i.submitterId)
      const isSup = !!u?.roles.includes('supplier')
      const dept = isSup ? suppliers.find((s) => s.code === u?.supplierCode)?.name ?? 'Supplier' : u?.department ?? i.department
      const row = map[q].get(i.submitterId) ?? { userId: i.submitterId, name: u?.name ?? i.submitterName, dept, color: u?.avatarColor ?? '#64748b', ideas: 0, value: 0, implemented: 0, maxIdea: 0, supplier: isSup, campaign: 0 }
      const v = ideaAnnualised(i)
      row.ideas++
      row.value += v
      row.maxIdea = Math.max(row.maxIdea, v)
      if (i.bucket === 'Implemented') row.implemented++
      if (i.campaignId) row.campaign++
      map[q].set(i.submitterId, row)
    }
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4'] as Q[]) res[q] = [...map[q].values()]
    return res
  }, [ideas, users, suppliers, fy])

  const curQ: Q = fy === currentFy ? (quarterOf(todayIso()) as Q) : fy < currentFy ? 'Q4' : 'Q1'
  const order: Q[] = ['Q1', 'Q2', 'Q3', 'Q4']
  const defaultQ = [...order.slice(0, order.indexOf(curQ) + 1)].reverse().find((q) => byQuarter[q].length) ?? curQ
  const [q, setQ] = useState<Q>(defaultQ)
  const [by, setBy] = useState<'ideas' | 'value'>('ideas')
  const rows = [...byQuarter[q]].sort((a, b) => (by === 'ideas' ? b.ideas - a.ideas || b.value - a.value : b.value - a.value || b.ideas - a.ideas)).slice(0, limit)
  const lead = rows[0] ? (by === 'ideas' ? rows[0].ideas : rows[0].value) : 1
  const total = byQuarter[q].length
  const y = fyStartYear(fy)
  const qYear = q === 'Q4' ? y + 1 : y

  return (
    <Card className={cn('h-full', className)} bodyClass="@container" icon="Trophy"
      title={<span className="flex items-center gap-1.5">Contributor leaderboard<InfoTip title="Contributor leaderboard">Top 10 contributors per quarter by ideas submitted (or ₹ annualised impact). Rewards participation — incentive payout is out of scope.</InfoTip></span>}
      subtitle={`Top 10 of ${total} contributor${total === 1 ? '' : 's'} · ${q} ${fy} (${QUARTER_MONTHS[q]} ${qYear})`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <Segmented size="sm" value={q} onChange={(k) => setQ(k as Q)} options={order.map((k) => ({ key: k, label: k }))} />
        <Segmented size="sm" value={by} onChange={(k) => setBy(k as 'ideas' | 'value')} options={[{ key: 'ideas', label: 'Ideas' }, { key: 'value', label: '₹ value' }]} />
      </div>
      {rows.length ? (
        <div className="grid grid-cols-1 @2xl:grid-cols-2 @2xl:grid-flow-col @2xl:grid-rows-5 gap-x-6">
          {rows.map((r, k) => {
            const isMe = r.userId === me?.id
            const badges: { icon: string; label: string; color: string }[] = []
            if (r.implemented) badges.push({ icon: 'BadgeCheck', label: `${r.implemented} implemented`, color: '#0f9f6e' })
            if (r.maxIdea >= 1e7) badges.push({ icon: 'Gem', label: `Big bet · single idea ${inrShort(r.maxIdea)}`, color: '#7c3aed' })
            if (r.supplier) badges.push({ icon: 'Factory', label: 'Supplier partner', color: '#0d9488' })
            if (r.campaign) badges.push({ icon: 'Megaphone', label: `${r.campaign} via campaign / workshop`, color: '#2f5bc6' })
            if (r.ideas >= 5) badges.push({ icon: 'Flame', label: `${r.ideas} ideas this quarter`, color: '#ec8a1c' })
            return (
              <div key={r.userId} className={cn('flex items-center gap-2 py-1 px-1.5 rounded-lg', isMe ? 'bg-brand-50/70 ring-1 ring-brand-200' : 'hover:bg-slate-50')}>
                <span className="w-5 grid place-items-center shrink-0">
                  {k < 3 ? <Icon name={k === 0 ? 'Trophy' : 'Medal'} size={15} style={{ color: MEDAL[k] }} /> : <span className="text-[11.5px] font-bold text-muted num">{k + 1}</span>}
                </span>
                <Avatar name={r.name} color={r.color} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[12.5px] font-semibold text-ink truncate shrink-0 max-w-[55%]">{r.name}</span>
                    {isMe && <span className="text-[10px] font-bold text-brand-700 bg-brand-100 rounded px-1 shrink-0">You</span>}
                    <span className="flex items-center gap-0.5 shrink-0">
                      {badges.slice(0, 3).map((b) => <Tooltip key={b.icon} content={b.label}><span className="h-4 w-4 rounded grid place-items-center" style={{ background: `${b.color}16`, color: b.color }}><Icon name={b.icon} size={10.5} /></span></Tooltip>)}
                    </span>
                    <span className="text-[11px] text-muted truncate min-w-0" title={r.dept}>{r.dept}</span>
                  </div>
                  <ProgressBar value={((by === 'ideas' ? r.ideas : r.value) / (lead || 1)) * 100} height={3} color={k < 3 ? MEDAL[k] : '#cbd5e1'} className="mt-1" />
                </div>
                <div className="text-right shrink-0 w-[92px] leading-tight">
                  <span className="text-[12.5px] font-bold text-ink num">{r.ideas}</span><span className="text-[10.5px] text-muted"> idea{r.ideas === 1 ? '' : 's'}</span>
                  <div className="text-[11px] text-muted num">{inrShort(r.value)}</div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon="Sparkles" title={`No contributions yet in ${q} ${fy}`} desc="The leaderboard fills as ideas are submitted this quarter — be the first on it." action={can(me, 'submit') && <Button size="sm" variant="primary" icon="CirclePlus" onClick={() => nav('/submit')}>Submit an idea</Button>} className="py-6" />
      )}
    </Card>
  )
}
