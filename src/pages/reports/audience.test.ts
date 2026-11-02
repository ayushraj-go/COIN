// Every report reaches a real sign-in: people no longer hold IDs, so an audience must name department IDs, and the
// scheduled-email list must find at least one active ID for it.
import { describe, expect, it } from 'vitest'
import { USERS_DEFAULT } from '../../lib/masters'
import { audienceUsers } from './Scheduled'
import { MIS_REPORTS } from './space'

const reports = [...MIS_REPORTS.CO, ...MIS_REPORTS.IN]

describe('report audiences', () => {
  it.each(reports.map((r) => [`${r.space} · ${r.name}`, r.audience]))('%s goes to an active ID', (_, audience) => {
    expect(audienceUsers(audience, USERS_DEFAULT).length).toBeGreaterThan(0)
  })

  it('never names a retired role', () => {
    for (const r of reports) expect(r.audience).not.toMatch(/Sourcing Head|Commodity Lead|Owners|Leads|Sourcing team|Sourcing Excellence/)
  })
})
