// Part-wise savings — price, volume and saving per part code, rolled up (Section 4 credibility rules).
import { useState } from 'react'
import type { Idea, IdeaPart } from '../../lib/types'
import { useMe } from '../../store/useStore'
import { Card, Icon, InfoTip, SourceTag, Tooltip, cn } from '../../components/ui'
import { ideaAnnualised, ideaSavingPct, partAnnualised, savingPct, savingPerUnit } from '../../lib/calc'
import { inrPrice, inrShort, num, sum } from '../../lib/format'
import { BASELINE_TAG, VOLUME_TAG, ideaPerms } from './model'
import { OverrideModal } from './Modals'

function Tag({ label, color, reason }: { label: string; color: string; reason?: string }) {
  const el = <SourceTag color={color}>{label}</SourceTag>
  return reason ? <Tooltip content={<div><div className="font-semibold">Override reason</div><div>{reason}</div></div>}>{el}</Tooltip> : el
}

export function PartsTable({ idea, compact }: { idea: Idea; compact?: boolean }) {
  const me = useMe()
  const perms = ideaPerms(me, idea)
  const [edit, setEdit] = useState<{ part: IdeaPart; field: 'baselinePrice' | 'annualVolume' } | null>(null)
  const total = ideaAnnualised(idea)
  const totalApproved = idea.parts.some((p) => p.approvedPrice != null) ? sum(idea.parts.map((p) => partAnnualised(p, true))) : null
  const pct = ideaSavingPct(idea)
  const editBtn = (part: IdeaPart, field: 'baselinePrice' | 'annualVolume') =>
    perms.override ? (
      <button onClick={(e) => { e.stopPropagation(); setEdit({ part, field }) }} title={field === 'baselinePrice' ? 'Override baseline (reason mandatory)' : 'Override volume (reason mandatory)'}
        className="h-6 w-6 grid place-items-center rounded-md text-slate-300 group-hover:text-slate-500 hover:!text-brand-700 hover:bg-brand-50 transition">
        <Icon name="PencilLine" size={12} />
      </button>
    ) : null

  const subtitle = idea.scope === 'Open' ? 'Open idea — tagged to commodity only, no part code' : `${idea.parts.length} part code${idea.parts.length === 1 ? '' : 's'} · baseline from LBP, volume from MRN FY26`
  return (
    <Card title="Part-wise savings" subtitle={compact ? undefined : subtitle} icon="Boxes" pad={false}
      actions={
        <div className="flex items-center gap-2">
          {idea.locked && <Tooltip content="Approved values are locked; changes after approval need a change reason and re-approval above the set %."><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600"><Icon name="Lock" size={12} />Locked</span></Tooltip>}
          {perms.override && !compact && <span className="hidden md:inline text-[11px] text-muted">Baseline and volume overrides need a reason and are logged</span>}
          <InfoTip title="Annualised impact" formula="(P(baseline) − P(new)) × Q(last FY MRN)">Saving per unit = P(baseline) − P(new). Red marks a negative delta.</InfoTip>
        </div>
      }>
      {idea.parts.length === 0 ? (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[12px] text-muted">Estimate for open idea (rough annual impact)</div>
              <div className="text-[20px] font-bold text-ink num">{inrShort(total)} <SourceTag color="#ec8a1c">Estimate</SourceTag></div>
            </div>
            <div className="text-[12px] text-muted max-w-sm">Part codes, baseline and volume are added by the team at the Team feasibility check; the estimate is replaced by the part-wise calculation.</div>
          </div>
        </div>
      ) : (
        <>
        {/* mobile: one card per part code */}
        <div className="sm:hidden px-4 pb-4 space-y-2">
          {idea.parts.map((p) => {
            const spu = savingPerUnit(p)
            const neg = spu < 0
            const bt = BASELINE_TAG[p.baselineSource] ?? BASELINE_TAG.LBP
            const vt = VOLUME_TAG[p.volumeSource] ?? VOLUME_TAG['MRN FY26']
            return (
              <div key={p.partCode} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[12px] font-semibold">{p.partCode}</div>
                    <div className="text-[12px] text-muted truncate">{p.description} · {p.uom}</div>
                  </div>
                  <div className={cn('text-[14px] font-bold num shrink-0', neg ? 'text-red-600' : 'text-ink')}>{inrShort(partAnnualised(p))}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[11.5px]">
                  <div><div className="text-muted">Baseline</div><div className="num font-semibold">{inrPrice(p.baselinePrice)}</div><Tag label={bt.label} color={bt.color} reason={p.baselineOverrideReason} /></div>
                  <div><div className="text-muted">New{p.approvedPrice != null ? ' / approved' : ''}</div><div className="num font-semibold">{inrPrice(p.newPrice)}{p.approvedPrice != null && <span className="text-emerald-700"> / {inrPrice(p.approvedPrice)}</span>}</div></div>
                  <div><div className="text-muted">Volume</div><div className="num font-semibold">{num(p.annualVolume)}</div><Tag label={vt.label} color={vt.color} reason={p.volumeOverrideReason} /></div>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11.5px]">
                  <span className={cn('num font-semibold', neg ? 'text-red-600' : 'text-emerald-700')}>Saving / unit {neg ? '−' : ''}{inrPrice(Math.abs(spu))} · {savingPct(p).toFixed(1)}%</span>
                  {perms.override && <span className="flex gap-1">{editBtn(p, 'baselinePrice')}{editBtn(p, 'annualVolume')}</span>}
                </div>
                <div className="text-[10.5px] text-muted truncate mt-1">{p.currentSupplier}</div>
              </div>
            )
          })}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-line px-3 py-2 text-[12.5px]">
            <span className="font-semibold text-ink-2">Total · {idea.parts.length} part{idea.parts.length === 1 ? '' : 's'} · {pct.toFixed(1)}%</span>
            <span className={cn('num font-extrabold', total < 0 ? 'text-red-600' : 'text-ink')}>{inrShort(total)}</span>
          </div>
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className={cn('tbl [&_th]:!whitespace-normal [&_th]:leading-tight [&_th]:!px-2.5 [&_td]:!px-2.5', !compact && '[&_td]:!h-[48px]')}>
            <thead>
              <tr>
                <th>Part code</th>
                <th>Description</th>
                {!compact && <th>UoM</th>}
                {!compact && <th>Current supplier</th>}
                <th style={{ textAlign: 'right' }}>Baseline</th>
                <th style={{ textAlign: 'right' }}>New price</th>
                {!compact && <th style={{ textAlign: 'right' }}>Approved price</th>}
                <th style={{ textAlign: 'right' }}>Annual volume</th>
                <th style={{ textAlign: 'right' }}>Saving / unit</th>
                {!compact && <th style={{ textAlign: 'right' }}>%</th>}
                <th style={{ textAlign: 'right' }}>Annualised</th>
              </tr>
            </thead>
            <tbody>
              {idea.parts.map((p) => {
                const spu = savingPerUnit(p)
                const ann = partAnnualised(p)
                const neg = spu < 0
                const bt = BASELINE_TAG[p.baselineSource] ?? BASELINE_TAG.LBP
                const vt = VOLUME_TAG[p.volumeSource] ?? VOLUME_TAG['MRN FY26']
                return (
                  <tr key={p.partCode} className="group">
                    <td className="font-mono text-[12px] font-semibold">{p.partCode}</td>
                    <td><div className={cn('truncate', compact ? 'max-w-[150px]' : 'max-w-[200px]')} title={p.description}>{p.description}</div></td>
                    {!compact && <td className="text-muted">{p.uom}</td>}
                    {!compact && <td><div className="max-w-[180px] truncate text-[12.5px]" title={p.currentSupplier}>{p.currentSupplier}</div></td>}
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1.5">
                        {editBtn(p, 'baselinePrice')}
                        <span className="flex flex-col items-end leading-tight gap-0.5">
                          <span className="num font-medium">{inrPrice(p.baselinePrice)}</span>
                          {!compact && <Tag label={bt.label} color={bt.color} reason={p.baselineOverrideReason} />}
                        </span>
                      </div>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>{inrPrice(p.newPrice)}</td>
                    {!compact && (
                      <td className="num" style={{ textAlign: 'right' }}>
                        {p.approvedPrice != null ? <span className={cn('font-semibold', p.approvedPrice > p.newPrice ? 'text-amber-700' : 'text-emerald-700')}>{inrPrice(p.approvedPrice)}</span> : <span className="text-muted">—</span>}
                      </td>
                    )}
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1.5">
                        {editBtn(p, 'annualVolume')}
                        <span className="flex flex-col items-end leading-tight gap-0.5">
                          <span className="num">{num(p.annualVolume)}</span>
                          {!compact && <Tag label={vt.label} color={vt.color} reason={p.volumeOverrideReason} />}
                        </span>
                      </div>
                    </td>
                    <td className={cn('num font-medium', neg ? 'text-red-600' : 'text-emerald-700')} style={{ textAlign: 'right' }}>{neg ? '−' : ''}{inrPrice(Math.abs(spu))}</td>
                    {!compact && <td className={cn('num', neg ? 'text-red-600' : 'text-ink-2')} style={{ textAlign: 'right' }}>{savingPct(p).toFixed(1)}%</td>}
                    <td className={cn('num font-bold', neg ? 'text-red-600' : 'text-ink')} style={{ textAlign: 'right' }}>{inrShort(ann)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/80">
                <td colSpan={compact ? 6 : 9} className="font-semibold text-[12px] text-ink-2" style={{ height: 40, padding: '0 12px' }}>
                  Total · {idea.parts.length} part{idea.parts.length === 1 ? '' : 's'}
                  {totalApproved != null && <span className="ml-2 font-normal text-muted">at approved price {inrShort(totalApproved)}</span>}
                </td>
                {!compact && <td className={cn('num font-semibold', pct < 0 ? 'text-red-600' : 'text-ink-2')} style={{ textAlign: 'right', padding: '0 12px' }}>{pct.toFixed(1)}%</td>}
                <td className={cn('num font-extrabold text-[13.5px]', total < 0 ? 'text-red-600' : 'text-ink')} style={{ textAlign: 'right', padding: '0 12px' }}>{inrShort(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}
      <OverrideModal idea={idea} part={edit?.part ?? null} field={edit?.field ?? 'baselinePrice'} open={!!edit} onClose={() => setEdit(null)} />
    </Card>
  )
}
