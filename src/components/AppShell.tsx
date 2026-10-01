import { PageErrorBoundary } from './ErrorBoundary'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import confetti from 'canvas-confetti'
import { useStore, useMe } from '../store/useStore'
import { navForSpace, spaceForPath, ROLE_LABEL, primaryRole } from '../lib/nav'
import { DEMO_LOGINS } from '../lib/masters'
import { Avatar, Icon, IconButton, cn, Badge } from './ui'
import { timeAgo, inrShort } from '../lib/format'
import { ideaAnnualised } from '../lib/calc'
import { useVisibleIdeas } from '../lib/hooks'
import IdeaDrawer from '../pages/IdeaDrawer'
import { AmberMark, AmberWordmark } from './Logo'

function Logo({ collapsed }: { collapsed: boolean; tone?: 'light' | 'dark' }) {
  return (
    <div className={cn('flex items-center h-14 shrink-0', collapsed ? 'justify-center px-2' : 'px-4')}>
      {collapsed ? <AmberMark size={26} /> : (
        <div className="min-w-0 flex items-center gap-2.5">
          <AmberWordmark size={22} />
          <span className="h-5 w-px bg-brand-300/70" />
          <span className="text-[11px] font-extrabold tracking-[.16em] text-brand-grad">COIN</span>
        </div>
      )}
    </div>
  )
}

const SPACE_META = {
  CO: { code: 'CO', name: 'Cost Optimisation', sub: 'Execution & savings' },
  IN: { code: 'IN', name: 'Innovation Network', sub: 'Ideas, suppliers, approvals' },
} as const

function SideLink({ i, collapsed }: { i: ReturnType<typeof navForSpace>[number]; collapsed: boolean }) {
  return (
    <NavLink to={i.path} end={i.path === '/'} title={collapsed ? i.label : undefined}
      className={({ isActive }) => cn('group relative flex items-center gap-2.5 h-9 [@media(max-height:760px)]:h-8 rounded-lg text-[13px] transition-all mb-0.5', collapsed ? 'justify-center px-0' : 'px-2.5',
        isActive ? 'bg-brand-grad text-white font-semibold shadow-[0_6px_16px_-8px_rgb(47_91_198/.7)]' : 'text-[#33415c] font-medium hover:bg-white/75 hover:text-brand-700 hover:shadow-[0_2px_8px_-4px_rgb(47_91_198/.35)]')}>
      {({ isActive }) => (
        <>
          <Icon name={i.icon} size={16} strokeWidth={isActive ? 2.2 : 1.8} className={cn('shrink-0', isActive ? 'text-white' : 'text-[#5f74a0] group-hover:text-brand-600')} />
          {!collapsed && <span className="flex-1 truncate">{i.label}</span>}
        </>
      )}
    </NavLink>
  )
}

function Sidebar() {
  const me = useMe()
  const collapsed = useStore((s) => s.navCollapsed)
  const toggle = useStore((s) => s.toggleNav)
  const space = useStore((s) => s.space)
  const setSpace = useStore((s) => s.setSpace)
  const nav = useNavigate()
  const items = navForSpace(me, space)
  const main = items.filter((i) => !i.pinned)
  const pinned = items.filter((i) => i.pinned)
  const sections = [...new Set(main.map((i) => i.section))]
  const meta = space ? SPACE_META[space] : null
  return (
    <aside className={cn('hidden md:flex flex-col transition-[width] duration-300 shrink-0 relative z-20 overflow-hidden shadow-[1px_0_0_rgb(47_91_198/.10),8px_0_28px_-20px_rgb(47_91_198/.45)]', collapsed ? 'w-[68px]' : 'w-[228px]')}
      style={{ background: 'linear-gradient(172deg, #e6ebf5 0%, #eef1f7 34%, #edf2f5 62%, #ddefe9 100%)' }}>
      {/* depth: soft colour orbs + fine dot texture */}
      <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-brand-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-1/3 h-48 w-48 rounded-full bg-[#9aa7c7]/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-16 h-56 w-56 rounded-full bg-accent-300/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[.35]" style={{ backgroundImage: 'radial-gradient(rgb(71 85 105 / .14) 1px, transparent 1px)', backgroundSize: '14px 14px', maskImage: 'linear-gradient(180deg, #000, transparent 30%, transparent 70%, #000)', WebkitMaskImage: 'linear-gradient(180deg, #000, transparent 30%, transparent 70%, #000)' }} />
      <div className="relative z-10 flex flex-col h-full min-h-0">
      <Logo collapsed={collapsed} />
      {meta && (
        <div className="px-2.5 pb-2.5">
          <button onClick={() => { setSpace(null); nav('/') }} title="Switch workspace (CO / IN)"
            className={cn('group w-full flex items-center gap-2.5 rounded-xl bg-white/80 backdrop-blur border border-white shadow-[0_6px_18px_-10px_rgb(47_91_198/.45)] hover:bg-white transition-colors', collapsed ? 'justify-center h-10' : 'px-2 py-1.5')}>
            <span className={cn('h-8 w-8 rounded-lg text-white text-[11px] font-extrabold grid place-items-center shrink-0', space === 'CO' ? 'bg-gradient-to-br from-accent-400 to-accent-600' : 'bg-brand-grad')}>{meta.code}</span>
            {!collapsed && <span className="flex-1 min-w-0 text-left leading-tight"><span className="block text-[12.5px] font-semibold text-ink truncate">{meta.name}</span><span className="block text-[11px] text-muted truncate">{meta.sub}</span></span>}
            {!collapsed && <Icon name="ArrowLeftRight" size={14} className="text-[#8a9bb8] group-hover:text-brand-600 shrink-0" />}
          </button>
        </div>
      )}
      <nav className="relative flex-1 min-h-0 overflow-hidden px-2.5 pt-1">
        {sections.map((sec, si) => (
          <div key={sec} className={cn(si > 0 && 'mt-3 [@media(max-height:760px)]:mt-2')}>
            {!collapsed && <div className="px-2.5 mb-1 text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#6b7fa8]">{sec}</div>}
            {collapsed && si > 0 && <div className="mx-3 mb-2 h-px bg-brand-200/70" />}
            {main.filter((i) => i.section === sec).map((i) => <SideLink key={i.key} i={i} collapsed={collapsed} />)}
          </div>
        ))}
        {!space && (
          <div className="mt-3">
            {!collapsed && <div className="px-2.5 mb-1 text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#6b7fa8]">Workspaces</div>}
            {collapsed && <div className="mx-3 mb-2 h-px bg-brand-200/70" />}
            {(['CO', 'IN'] as const).map((k) => (
              <button key={k} onClick={() => { setSpace(k); nav('/') }} title={collapsed ? SPACE_META[k].name : undefined}
                className={cn('group w-full flex items-center gap-2.5 h-9 rounded-lg text-[13px] font-medium text-[#33415c] hover:bg-white/75 hover:text-brand-700 transition-all mb-0.5', collapsed ? 'justify-center' : 'px-2')}>
                <span className={cn('h-6 w-6 rounded-md text-white text-[9.5px] font-extrabold grid place-items-center shrink-0', k === 'CO' ? 'bg-gradient-to-br from-accent-400 to-accent-600' : 'bg-brand-grad')}>{k}</span>
                {!collapsed && <span className="flex-1 truncate text-left">{SPACE_META[k].name}</span>}
                {!collapsed && <Icon name="ChevronRight" size={14} className="text-[#8a9bb8] opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>
            ))}
          </div>
        )}
      </nav>
      {pinned.length > 0 && (
        <div className="px-2.5 pt-2 pb-1 border-t border-white/70">
          {pinned.map((i) => <SideLink key={i.key} i={i} collapsed={collapsed} />)}
        </div>
      )}
      <div className="px-2.5 pb-2">
        <button onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'} className={cn('w-full h-8 rounded-lg flex items-center gap-2.5 text-[#5f74a0] hover:text-ink hover:bg-white/75 text-[12.5px] font-medium', collapsed ? 'justify-center' : 'px-2.5')}>
          <Icon name={collapsed ? 'PanelLeftOpen' : 'PanelLeftClose'} size={16} strokeWidth={1.8} />{!collapsed && 'Collapse'}
        </button>
      </div>
      </div>
    </aside>
  )
}

function MobileNav() {
  const me = useMe()
  const [open, setOpen] = useState(false)
  const space = useStore((s) => s.space)
  const items = navForSpace(me, space)
  return (
    <>
      <IconButton icon="Menu" className="md:hidden" onClick={() => setOpen(true)} />
      <span className="md:hidden"><AmberMark size={26} /></span>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[130] md:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#0e1330]/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="absolute left-0 top-0 bottom-0 w-[270px] bg-white p-2 overflow-y-auto shadow-2xl">
              <Logo collapsed={false} tone="dark" />
              {items.map((i) => (
                <NavLink key={i.key} to={i.path} end={i.path === '/'} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13.5px] font-semibold', isActive ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-ink-2')}>
                  <Icon name={i.icon} size={17} />{i.label}
                </NavLink>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

/** Global search (Ctrl + K) across ideas, parts, suppliers and campaigns */
function CommandPalette() {
  const open = useStore((s) => s.searchOpen)
  const setOpen = useStore((s) => s.setSearchOpen)
  const { parts, suppliers, campaigns, openIdea } = useStore()
  const me = useMe()
  const space = useStore((s) => s.space)
  const ideas = useVisibleIdeas()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(!useStore.getState().searchOpen) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [setOpen])
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30) } }, [open])
  const results = useMemo(() => {
    const k = q.trim().toLowerCase()
    const pages = navForSpace(me, space).map((n) => ({ type: 'Page', icon: n.icon, title: n.label, sub: n.module ? `Module ${n.module}` : 'Navigate', go: () => nav(n.path) }))
    if (!k) return [...pages.slice(0, 6), ...ideas.slice(0, 5).map((i) => ({ type: 'Idea', icon: 'Lightbulb', title: i.title, sub: `${i.id} · ${i.stage} · ${inrShort(ideaAnnualised(i))}`, go: () => openIdea(i.id) }))]
    const m = (s: string) => s.toLowerCase().includes(k)
    return [
      ...pages.filter((p) => m(p.title)),
      ...ideas.filter((i) => m(i.id) || m(i.title) || m(i.submitterName) || i.parts.some((p) => m(p.partCode) || m(p.description))).slice(0, 8).map((i) => ({ type: 'Idea', icon: 'Lightbulb', title: i.title, sub: `${i.id} · ${i.stage} · ${inrShort(ideaAnnualised(i))}`, go: () => openIdea(i.id) })),
      ...parts.filter((p) => m(p.code) || m(p.description)).slice(0, 5).map((p) => ({ type: 'Part', icon: 'Box', title: `${p.code} · ${p.description}`, sub: `${p.commodity} · LBP ₹ ${p.lbp ?? p.poPrice} / ${p.uom} · MRN FY26 ${p.lastFyMrnQty.toLocaleString('en-IN')}`, go: () => nav(`/ideas?q=${p.code}`) })),
      ...suppliers.filter((s) => m(s.code) || m(s.name)).slice(0, 5).map((s) => ({ type: 'Supplier', icon: 'Factory', title: `${s.name}`, sub: `${s.code} · ${s.city} · ${s.commodities.join(', ')}`, go: () => nav(`/ideas?q=${s.code}`) })),
      ...campaigns.filter((c) => m(c.name) || m(c.id)).slice(0, 5).map((c) => ({ type: 'Campaign', icon: 'Megaphone', title: c.name, sub: `${c.id} · ${c.type} · ${c.status}`, go: () => nav(`/campaigns/${c.id}`) })),
    ]
  }, [q, ideas, parts, suppliers, campaigns, me, space, nav, openIdea])
  const run = (r: (typeof results)[number]) => { setOpen(false); r.go() }
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[12vh] px-3">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#0e1330]/25 backdrop-blur-md" onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.96, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-[0_40px_100px_-30px_rgb(14_19_48/.45)] ring-1 ring-brand-100 overflow-hidden">
            <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
              <Icon name="Search" size={18} className="text-muted" />
              <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0) }} onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
                if (e.key === 'Enter' && results[idx]) run(results[idx])
                if (e.key === 'Escape') setOpen(false)
              }} placeholder="Search ideas, part codes, suppliers, campaigns…" className="flex-1 outline-none text-[15px] bg-transparent" />
              <kbd className="text-[11px] text-muted border border-line rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 && <div className="py-10 text-center text-muted text-[13px]">No matches for “{q}”</div>}
              {results.map((r, i) => (
                <button key={i} onMouseEnter={() => setIdx(i)} onClick={() => run(r)} className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left', i === idx ? 'bg-brand-50' : 'hover:bg-slate-50')}>
                  <span className={cn('h-8 w-8 rounded-lg grid place-items-center shrink-0', i === idx ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow' : 'bg-brand-50 text-brand-600')}><Icon name={r.icon} size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink truncate">{r.title}</span><span className="block text-[11.5px] text-muted truncate">{r.sub}</span></span>
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{r.type}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 px-4 h-9 border-t border-line bg-slate-50 text-[11px] text-muted">
              <span>↑↓ navigate</span><span>↵ open</span><span className="ml-auto">COIN global search</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function UserMenu() {
  const me = useMe()!
  const { logout, loginAs, users, resetDemo, toast } = useStore()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const loc = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  // close on any click / tap outside the menu, on Esc, and when the page changes
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  useEffect(() => { setOpen(false) }, [loc.pathname])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-2 h-9 pl-1 pr-1.5 rounded-lg hover:bg-[#f9fafb] transition-colors">
        <Avatar name={me.name} color={me.avatarColor} size={28} />
        <span className="hidden lg:block text-left leading-tight">
          <span className="block text-[12.5px] font-semibold text-ink max-w-[140px] truncate">{me.name}</span>
          <span className="block text-[11px] text-muted max-w-[140px] truncate">{ROLE_LABEL[primaryRole(me)]}</span>
        </span>
        <Icon name="ChevronDown" size={14} className="text-muted" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-11 z-50 w-[320px] max-w-[calc(100vw-24px)] card shadow-2xl p-2">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" title="Close"
                className="absolute right-2 top-2 h-7 w-7 rounded-full grid place-items-center text-muted hover:text-ink hover:bg-slate-100 transition-colors">
                <Icon name="X" size={15} />
              </button>
              <div className="flex items-center gap-3 p-2 pr-9">
                <Avatar name={me.name} color={me.avatarColor} size={40} />
                <div className="min-w-0">
                  <div className="font-bold text-[13.5px] truncate">{me.name}</div>
                  <div className="text-[11.5px] text-muted truncate">{me.designation}</div>
                  <div className="text-[11px] text-muted truncate">{me.employeeId} · {me.department} · {me.email}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 px-2 pb-2">{me.roles.map((r) => <Badge key={r} color="#2f5bc6">{ROLE_LABEL[r]}</Badge>)}</div>
              <div className="border-t border-line my-1" />
              <div className="px-2 pt-1 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted">Switch demo persona</div>
              <div>
                {DEMO_LOGINS.map((d) => {
                  const u = users.find((x) => x.id === d.userId)!
                  return (
                    <button key={d.userId} onClick={() => { loginAs(d.userId); setOpen(false); nav('/'); toast(`Switched to ${u.name} · ${d.role}`, 'info') }} className={cn('w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-slate-50', d.userId === me.id && 'bg-brand-50')}>
                      <Avatar name={u.name} color={u.avatarColor} size={26} />
                      <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold truncate">{d.role}</span><span className="block text-[11px] text-muted truncate">{u.name}</span></span>
                      {d.userId === me.id && <Icon name="Check" size={14} className="text-brand-600" />}
                    </button>
                  )
                })}
              </div>
              <div className="border-t border-line my-1" />
              <button onClick={() => { if (confirm('Reset all demo data to the original seed? Local changes will be lost.')) { resetDemo(); toast('Demo data reset', 'info') } setOpen(false) }} className="w-full flex items-center gap-2 px-2 h-9 rounded-lg text-[12.5px] hover:bg-slate-50"><Icon name="RotateCcw" size={15} />Reset demo data</button>
              <button onClick={() => { setOpen(false); logout(); nav('/login') }} className="w-full flex items-center gap-2 px-2 h-9 rounded-lg text-[12.5px] text-red-600 hover:bg-red-50"><Icon name="LogOut" size={15} />Sign out</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function Toasts() {
  const { toasts, dismissToast } = useStore()
  const style = { success: ['CircleCheck', '#0f9f6e'], error: ['CircleX', '#e0364f'], info: ['Info', '#4470d6'], warning: ['TriangleAlert', '#ec8a1c'] } as const
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[360px] max-w-[92vw]">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} className="relative overflow-hidden flex items-center gap-3 glass-strong text-ink rounded-2xl pl-3.5 pr-2 py-3 shadow-[0_18px_40px_-16px_rgb(14_19_48/.35)] ring-1 ring-brand-100">
            <Icon name={style[t.type][0]} size={17} style={{ color: style[t.type][1] }} />
            <span className="flex-1 text-[12.5px] font-semibold">{t.message}</span>
            {t.undo && <button onClick={() => { t.undo!(); dismissToast(t.id) }} className="text-[12px] font-bold text-brand-700 hover:text-brand-800 px-2.5 h-7 rounded-lg bg-brand-50 hover:bg-brand-100">Undo</button>}
            <button onClick={() => dismissToast(t.id)} className="opacity-60 hover:opacity-100 p-1"><Icon name="X" size={14} /></button>
            {t.undo && <motion.span initial={{ width: '100%' }} animate={{ width: 0 }} transition={{ duration: 5, ease: 'linear' }} className="absolute left-0 bottom-0 h-0.5 bg-gradient-to-r from-brand-500 to-gold-400" />}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Session timeout after 30 minutes of inactivity (Section 15) */
function SessionGuard() {
  const nav = useNavigate()
  const { touch, logout, settings, toast } = useStore()
  useEffect(() => {
    const h = () => touch()
    const evs = ['mousedown', 'keydown', 'scroll']
    evs.forEach((e) => window.addEventListener(e, h, { passive: true }))
    const iv = setInterval(() => {
      const last = useStore.getState().lastActivity
      if (Date.now() - last > settings.sessionTimeoutMin * 60000) { logout(); nav('/login'); toast('Session timed out after 30 minutes of inactivity', 'warning') }
    }, 30000)
    return () => { evs.forEach((e) => window.removeEventListener(e, h)); clearInterval(iv) }
  }, [touch, logout, nav, settings.sessionTimeoutMin, toast])
  return null
}

/** A subtle celebration when an idea is marked Implemented */
function Celebration() {
  const n = useStore((s) => s.celebrate)
  const prev = useRef(n)
  useEffect(() => {
    if (n === prev.current) return
    prev.current = n
    const colors = ['#2f5bc6', '#d4a85a', '#0f9f6e', '#7b8cfb', '#d7192d']
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors, scalar: 0.9 })
    setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors }), 180)
    setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors }), 300)
  }, [n])
  return null
}

export default function AppShell() {
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const loc = useLocation()
  const mainRef = useRef<HTMLDivElement>(null)
  const space = useStore((s) => s.space)
  const setSpace = useStore((s) => s.setSpace)
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [loc.pathname])
  // A deep link into an IN page (notification, e-mail, bookmark) enters the IN workspace directly
  useEffect(() => { if (!space) { const sp = spaceForPath(loc.pathname); if (sp) setSpace(sp) } }, [space, loc.pathname, setSpace])
  return (
    <div className="h-full flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="relative h-14 shrink-0 backdrop-blur-md flex items-center gap-3 px-3 md:px-6 z-10" style={{ background: 'linear-gradient(90deg, rgb(255 255 255 / .92), rgb(246 248 251 / .92) 60%, rgb(238 249 246 / .92))' }}>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, rgb(47 91 198 / .22), rgb(20 171 146 / .35), rgb(47 91 198 / .06))' }} />
          <MobileNav />
          <button onClick={() => setSearchOpen(true)} className="group flex items-center gap-2 h-9 w-full max-w-[380px] px-3 rounded-lg bg-white border border-line hover:border-[#d0d5dd] text-[#98a2b3] text-[13px] transition-colors">
            <Icon name="Search" size={15} />
            <span className="flex-1 text-left truncate">Search ideas, parts, suppliers, campaigns…</span>
            <kbd className="hidden sm:inline text-[10px] font-medium text-muted bg-[#f9fafb] border border-line rounded px-1.5 py-px">Ctrl K</kbd>
          </button>
          <div className="flex-1" />
          <div className="hidden xl:flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
            <Icon name="CalendarRange" size={14} className="text-[#98a2b3]" />FY27 · Q3 (Oct–Dec)
          </div>
          <span className="hidden xl:block h-4 w-px bg-line" />
          <div className="hidden lg:flex items-center gap-1.5 text-[12px] font-medium text-ink-2 mr-2">
            <span className="relative flex h-2 w-2"><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>ERP · PAP · NPD synced
          </div>
          <UserMenu />
        </header>
        <main ref={mainRef} className="relative flex-1 overflow-y-auto overflow-x-hidden">
          <div className="canvas-texture pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
          <div className="relative mx-auto w-full max-w-[1480px] px-3 py-4 md:px-7 md:py-6">
            <AnimatePresence mode="wait">
              <motion.div key={loc.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                <PageErrorBoundary key={loc.pathname}><Outlet /></PageErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <CommandPalette />
      <IdeaDrawer />
      <Toasts />
      <SessionGuard />
      <Celebration />
    </div>
  )
}
export const _unused = React
