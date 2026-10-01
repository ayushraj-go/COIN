// Comments with @mentions — autocomplete on "@", mentioned users are notified (M4).
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Idea, User } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { Avatar, Button, Card, Icon, Tooltip, cn } from '../../components/ui'
import { fmtDateTime, timeAgo } from '../../lib/format'
import { ROLE_LABEL, primaryRole } from '../../lib/nav'
import { ideaPerms } from './model'

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function MentionText({ text, users }: { text: string; users: User[] }) {
  const parts = useMemo(() => {
    const names = [...users].map((u) => u.name).sort((a, b) => b.length - a.length)
    if (!names.length) return [text]
    const re = new RegExp(`(@(?:${names.map(esc).join('|')}))`, 'g')
    return text.split(re)
  }, [text, users])
  return (
    <>
      {parts.map((p, k) => (p.startsWith('@') && users.some((u) => '@' + u.name === p)
        ? <span key={k} className="font-semibold text-brand-700 bg-brand-50 rounded px-0.5">{p}</span>
        : <span key={k}>{p}</span>))}
    </>
  )
}

export function Comments({ idea, compact }: { idea: Idea; compact?: boolean }) {
  const me = useMe()
  const users = useStore((s) => s.users)
  const addComment = useStore((s) => s.addComment)
  const toast = useStore((s) => s.toast)
  const perms = ideaPerms(me, idea)
  const [text, setText] = useState('')
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [idx, setIdx] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)
  const active = users.filter((u) => u.active)
  const options = mention ? active.filter((u) => u.id !== me?.id && u.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6) : []

  const detect = (value: string, caret: number) => {
    const before = value.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]))) { setMention(null); return }
    const q = before.slice(at + 1)
    if (q.length > 30 || /[\n@]/.test(q) || !/^[A-Za-z. ]*$/.test(q)) { setMention(null); return }
    setMention({ start: at, query: q })
    setIdx(0)
  }
  const insert = (u: User) => {
    const el = ref.current
    const caret = el?.selectionStart ?? text.length
    if (!mention) return
    const v = text.slice(0, mention.start) + '@' + u.name + ' ' + text.slice(caret)
    setText(v)
    setMention(null)
    const pos = mention.start + u.name.length + 2
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos, pos) })
  }
  const post = () => {
    const v = text.trim()
    if (!v) return
    addComment(idea.id, v)
    const n = users.filter((u) => v.includes('@' + u.name)).length
    toast(n ? `Comment posted — ${n} ${n === 1 ? 'person' : 'people'} notified` : 'Comment posted', 'success')
    setText('')
    setMention(null)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && options.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => (i + 1) % options.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => (i - 1 + options.length) % options.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(options[idx]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMention(null); return }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); post() }
  }
  const list = [...idea.comments].sort((a, b) => a.at.localeCompare(b.at))
  const shown: ReactNode = list.length ? (
    <ol className={cn('space-y-3', compact && 'pr-0')}>
      {list.map((c) => {
        const u = users.find((x) => x.id === c.userId)
        const mine = c.userId === me?.id
        return (
          <li key={c.id} className="flex gap-2.5">
            <Avatar name={c.userName} color={u?.avatarColor} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12.5px] font-semibold text-ink">{c.userName}</span>
                {u && <span className="text-[10.5px] text-muted">{ROLE_LABEL[primaryRole(u)]}</span>}
                <Tooltip content={fmtDateTime(c.at)}><span className="text-[10.5px] text-muted">· {timeAgo(c.at)}</span></Tooltip>
              </div>
              <div className={cn('mt-0.5 text-[12.5px] leading-relaxed rounded-lg px-2.5 py-1.5 inline-block max-w-full break-words', mine ? 'bg-brand-50/70 text-ink' : 'bg-slate-50 text-ink-2')}>
                <MentionText text={c.text} users={users} />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  ) : (
    <div className="text-center py-5 text-[12.5px] text-muted"><Icon name="MessagesSquare" size={20} className="mx-auto mb-1.5 text-slate-300" />No comments yet — start the conversation and @mention a colleague.</div>
  )
  return (
    <Card title="Comments" icon="MessagesSquare" subtitle={compact ? undefined : `${idea.comments.length} comment${idea.comments.length === 1 ? '' : 's'} · type @ to mention`}>
      {shown}
      {perms.comment && me && (
        <div className="mt-3 relative">
          <div className="flex gap-2">
            <Avatar name={me.name} color={me.avatarColor} size={28} />
            <div className="flex-1 min-w-0">
              <textarea ref={ref} className="input" rows={2} value={text} placeholder="Add a comment… type @ to mention someone"
                onChange={(e) => { setText(e.target.value); detect(e.target.value, e.target.selectionStart) }}
                onClick={(e) => detect(text, (e.target as HTMLTextAreaElement).selectionStart)}
                onKeyDown={onKey} onBlur={() => setTimeout(() => setMention(null), 150)} />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10.5px] text-muted hidden sm:inline">Ctrl + Enter to post</span>
                <Button size="sm" variant="primary" icon="Send" disabled={!text.trim()} onClick={post} className="ml-auto">Post</Button>
              </div>
            </div>
          </div>
          {mention && options.length > 0 && (
            <div className="absolute left-9 right-0 bottom-full mb-1 z-30 card shadow-xl p-1 animate-pop">
              <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1"><Icon name="AtSign" size={11} />Mention</div>
              {options.map((u, k) => (
                <button key={u.id} onMouseDown={(e) => { e.preventDefault(); insert(u) }} onMouseEnter={() => setIdx(k)}
                  className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left', k === idx ? 'bg-brand-50' : 'hover:bg-slate-50')}>
                  <Avatar name={u.name} color={u.avatarColor} size={22} />
                  <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold truncate">{u.name}</span><span className="block text-[10.5px] text-muted truncate">{ROLE_LABEL[primaryRole(u)]} · {u.department}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
