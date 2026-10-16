// api mode — change your own password (the server checks the current one and signs out your other sessions)
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { changeOwnPassword } from '../store/remote'
import { Button, Field, Modal } from './ui'

const rule = (pw: string) => (pw.length < 8 ? 'At least 8 characters' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Use letters and digits' : null)

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useStore((s) => s.toast)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setCurrent(''); setNext(''); setAgain(''); setErr('') } }, [open])
  const problem = next ? rule(next) : null
  const valid = !!current && !!next && !problem && next === again
  const save = async () => {
    setBusy(true); setErr('')
    try {
      await changeOwnPassword(current, next)
      toast('Password changed — your other sessions were signed out', 'success')
      onClose()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} size="sm" icon="KeyRound" title="Change password" subtitle="At least 8 characters with letters and digits"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="Check" disabled={!valid || busy} onClick={save}>Change password</Button></>}>
      <div className="grid gap-3">
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="New password" error={problem ?? undefined}><input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="New password again" error={again && again !== next ? 'Does not match' : undefined}><input className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
        {err && <div className="text-[12.5px] text-red-600">{err}</div>}
      </div>
    </Modal>
  )
}
