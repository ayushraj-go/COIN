import { describe, it, expect } from 'vitest'
import { USERS_DEFAULT, STAGE } from './masters'
import { DEPARTMENTS, ladderOf, stageAssignee } from './workflow'
import type { Idea } from './types'

const idea = (o: Partial<Idea> & Record<string, unknown> = {}) => ({ id: 'X', department: 'R&D', commodity: 'CMP', submitterId: 'u-sub1', stage: STAGE.feasibility, ...o }) as unknown as Idea

describe('role ladder', () => {
  it('every one of the 8 departments has all five roles', () => {
    expect([...DEPARTMENTS]).toEqual(['R&D', 'DQA', 'Quality', 'Process', 'Production', 'Finance', 'Sourcing', 'HR'])
    for (const d of DEPARTMENTS) {
      const l = ladderOf(d, 'CMP', USERS_DEFAULT)
      expect([l.teamLead, l.deptLead, l.deptHead, l.execOwner].every(Boolean), d).toBe(true)
      for (const id of [l.teamLead, l.deptLead, l.deptHead]) expect(USERS_DEFAULT.find((u) => u.id === id)?.department, `${d} ${id}`).toBe(d)
    }
  })
  it('routes each stage of an R&D idea to the right person', () => {
    const i = idea()
    expect(stageAssignee(i, STAGE.feasibility, USERS_DEFAULT)).toBe('u-rd-tl')
    expect(stageAssignee(i, STAGE.evaluation, USERS_DEFAULT)).toBe('u-eval1')
    expect(stageAssignee(i, STAGE.approval, USERS_DEFAULT)).toBe('u-rd-head')
    expect(stageAssignee(i, STAGE.execution, USERS_DEFAULT)).toBe('u-rd-exec')
    expect(stageAssignee(i, STAGE.verification, USERS_DEFAULT)).toBe('u-fin')
    expect(stageAssignee(i, 'Draft', USERS_DEFAULT)).toBeUndefined()
  })
  it('Sourcing uses the commodity lead and buyer; supplier ideas go to Sourcing', () => {
    const i = idea({ department: 'Supplier', commodity: 'CMP', submitterId: 'u-sup2' })
    expect(stageAssignee(i, STAGE.feasibility, USERS_DEFAULT)).toBe('u-lead2')
    expect(stageAssignee(i, STAGE.evaluation, USERS_DEFAULT)).toBe('u-so-lead')
    expect(stageAssignee(i, STAGE.approval, USERS_DEFAULT)).toBe('u-head')
    expect(stageAssignee(i, STAGE.execution, USERS_DEFAULT)).toBe('u-buyer3')
  })
  it('HR ideas follow the HR ladder', () => {
    const i = idea({ department: 'HR', commodity: 'FAC', submitterId: 'u-hr-emp' })
    expect(stageAssignee(i, STAGE.feasibility, USERS_DEFAULT)).toBe('u-hr-tl')
    expect(stageAssignee(i, STAGE.approval, USERS_DEFAULT)).toBe('u-hr-head')
  })
  it('a team lead never checks their own idea; a reassigned owner wins', () => {
    expect(stageAssignee(idea({ submitterId: 'u-rd-tl' }), STAGE.feasibility, USERS_DEFAULT)).toBe('u-eval1')
    expect(stageAssignee(idea({ ownerId: 'u-qa-exec' }), STAGE.execution, USERS_DEFAULT)).toBe('u-qa-exec')
  })
})
