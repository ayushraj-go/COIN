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

import { ideaPerms } from '../pages/idea/model'
import { canSeeIdea } from './calc'
import { stageLabel } from './workflow'
const U = (id: string) => USERS_DEFAULT.find((u) => u.id === id)!
const at = (stage: string, o: Record<string, unknown> = {}) => idea(<Record<string, unknown>>{
  stage, bucket: stage === STAGE.execution ? 'In Execution' : stage === STAGE.verification ? 'Implemented' : 'Pipeline',
  approvals: [{ level: 'R&D head', approverId: 'u-rd-head' }], execution: { status: 'In Execution', milestones: [] }, evaluation: { dept: 'R&D' }, lock: undefined, ...o,
})

describe('who may act', () => {
  it('each role acts only at its own stage, in its own department', () => {
    expect(ideaPerms(U('u-rd-tl'), at(STAGE.feasibility)).feasibilityCheck).toBe(true)
    expect(ideaPerms(U('u-hr-tl'), at(STAGE.feasibility)).feasibilityCheck).toBe(false)
    expect(ideaPerms(U('u-rd-tl'), at(STAGE.evaluation)).evaluate).toBe(false)
    expect(ideaPerms(U('u-eval1'), at(STAGE.evaluation)).evaluate).toBe(true)
    expect(ideaPerms(U('u-hr-lead'), at(STAGE.evaluation)).evaluate).toBe(false)
    expect(ideaPerms(U('u-rd-head'), at(STAGE.approval)).approve).toBe(true)
    expect(ideaPerms(U('u-qa-head'), at(STAGE.approval)).approve).toBe(false)
    expect(ideaPerms(U('u-rd-exec'), at(STAGE.execution)).execute).toBe(true)
    expect(ideaPerms(U('u-hr-exec'), at(STAGE.execution)).execute).toBe(false)
    // nobody hands over by hand — COIN moves the idea to verification when the locked timeline ends
    expect(ideaPerms(U('u-rd-exec'), at(STAGE.execution)).handOver).toBe(false)
    expect(ideaPerms(U('u-fin'), at(STAGE.verification)).verify).toBe(true)
    expect(ideaPerms(U('u-rd-head'), at(STAGE.verification)).verify).toBe(false)
  })
  it('a team lead cannot clear their own idea — the department lead does it instead', () => {
    const own = at(STAGE.feasibility, { submitterId: 'u-rd-tl' })
    expect(ideaPerms(U('u-rd-tl'), own).feasibilityCheck).toBe(false)
    expect(ideaPerms(U('u-eval1'), own).feasibilityCheck).toBe(true)
  })
  it('employees never act; Sourcing Head and Admin override every stage', () => {
    for (const s of [STAGE.feasibility, STAGE.evaluation, STAGE.approval]) {
      const p = ideaPerms(U('u-sub1'), at(s, { submitterId: 'u-sub4' }))
      expect(p.feasibilityCheck || p.evaluate || p.approve).toBe(false)
      for (const o of ['u-head', 'u-admin']) { const q = ideaPerms(U(o), at(s)); expect(q.feasibilityCheck || q.evaluate || q.approve, `${o} ${s}`).toBe(true) }
    }
    expect(ideaPerms(U('u-admin'), at(STAGE.execution)).execute).toBe(true)
    expect(ideaPerms(U('u-admin'), at(STAGE.verification)).verify).toBe(true)
  })
  it('department roles see their department; employees only their own ideas', () => {
    expect(canSeeIdea(U('u-rd-tl'), at(STAGE.evaluation))).toBe(true)
    expect(canSeeIdea(U('u-rd-exec'), at(STAGE.execution))).toBe(true)
    expect(canSeeIdea(U('u-hr-tl'), at(STAGE.evaluation))).toBe(false)
    expect(canSeeIdea(U('u-sub4'), at(STAGE.evaluation))).toBe(false)
  })
  it('stage 4 is stored as Approval and shown with the department name', () => {
    expect(STAGE.approval).toBe('Approval')
    expect(stageLabel(at(STAGE.approval), STAGE.approval)).toBe('R&D approval')
    expect(stageLabel(at(STAGE.evaluation, { evaluation: { dept: 'HR' } }), STAGE.evaluation)).toBe('HR evaluation')
  })
})

import { personaFor } from './workflow'
describe('demo personas by department', () => {
  it('gives one account per ladder role for every department', () => {
    expect(personaFor('R&D', 'submitter', USERS_DEFAULT)).toBe('u-sub1')
    expect(personaFor('Sourcing', 'submitter', USERS_DEFAULT)).toBe('u-so-emp')
    expect(personaFor('Sourcing', 'teamlead', USERS_DEFAULT)).toBe('u-lead1')
    expect(personaFor('HR', 'depthead', USERS_DEFAULT)).toBe('u-hr-head')
    expect(personaFor('Finance', 'execowner', USERS_DEFAULT)).toBe('u-fi-exec')
    for (const d of DEPARTMENTS) for (const r of ['submitter', 'teamlead', 'deptlead', 'depthead', 'execowner'] as const) expect(personaFor(d, r, USERS_DEFAULT), `${d} ${r}`).toBeTruthy()
  })
})
