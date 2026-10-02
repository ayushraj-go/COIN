import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useStore } from '../store/useStore'
import { QUICK_LOGINS } from '../lib/masters'
import { Avatar, Icon, Modal, Button, cn } from '../components/ui'
import { AmberWordmark } from '../components/Logo'

// Film grain as an inline SVG (fractal noise), tiled at very low opacity.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── Backdrop: warm near-white, a quiet mesh of blue + teal light, faint grid and grain ──
function Backdrop() {
  return (
    <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#fbfaf7]" />
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(60% 55% at 12% 8%, rgb(59 116 242 / .085), transparent 70%)',
            'radial-gradient(45% 50% at 96% 4%, rgb(20 171 146 / .07), transparent 70%)',
            'radial-gradient(50% 55% at 88% 100%, rgb(59 116 242 / .06), transparent 70%)',
            'radial-gradient(45% 45% at 0% 100%, rgb(20 171 146 / .055), transparent 70%)',
            'linear-gradient(180deg, rgb(255 255 255 / .7), rgb(255 255 255 / 0) 40%)',
          ].join(','),
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgb(15 27 51 / .04) 1px, transparent 1px), linear-gradient(90deg, rgb(15 27 51 / .04) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          backgroundPosition: '-1px -1px',
          maskImage: 'radial-gradient(70% 70% at 35% 45%, #000 10%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(70% 70% at 35% 45%, #000 10%, transparent 75%)',
        }}
      />
      <div className="absolute inset-0 opacity-[.05] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
    </div>
  )
}

// ─── Globe: quiet slate sphere with a teal/blue idea network ─────────────────────────
function Globe() {
  const r = 150
  const dots = useMemo(() => {
    const out: [number, number][] = []
    for (let y = -r; y <= r; y += 9) for (let x = -r; x <= r; x += 9) {
      if (x * x + y * y > (r - 8) ** 2) continue
      const n = Math.sin(x * 0.045 + 1.3) + Math.cos(y * 0.06 - 0.4) + Math.sin((x + y) * 0.028) + Math.cos((x - y) * 0.05)
      if (n > 1.35) out.push([x, y])
    }
    return out
  }, [])
  const nodes: [number, number][] = [[-70, -60], [40, -95], [95, -20], [60, 55], [-20, 20], [-95, 40], [10, 110], [-40, -110]]
  const arcs: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 6], [4, 0], [4, 3], [5, 4], [7, 1], [5, 6], [4, 2]]
  return (
    <svg viewBox="-215 -215 430 430" className="w-full h-full overflow-visible">
      <defs>
        <radialGradient id="lg-sphere" cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f3f5f8" />
          <stop offset="100%" stopColor="#dde3ec" />
        </radialGradient>
        <linearGradient id="lg-arc" x1="0" x2="1"><stop offset="0%" stopColor="#14ab92" /><stop offset="100%" stopColor="#3b74f2" /></linearGradient>
        <clipPath id="lg-clip"><circle r={r} /></clipPath>
      </defs>
      <g style={{ transformOrigin: '0 0', animation: 'orbit-spin 80s linear infinite' }}>
        <circle r={r + 52} fill="none" stroke="#0f1b33" strokeOpacity=".12" strokeDasharray="2 8" />
        <circle cx={r + 52} cy={0} r={3.5} fill="#3b74f2" opacity=".8" />
        <circle cx={-(r + 52)} cy={0} r={3} fill="#14ab92" />
      </g>
      <ellipse rx={r + 28} ry={(r + 28) * 0.3} transform="rotate(-18)" fill="none" stroke="#0f1b33" strokeOpacity=".08" />
      <circle r={r} fill="url(#lg-sphere)" stroke="#cfd7e3" />
      <g clipPath="url(#lg-clip)">
        {[r, r * 0.74, r * 0.42].map((rx, i) => <ellipse key={i} rx={rx} ry={r} fill="none" stroke="#0f1b33" strokeOpacity=".06" />)}
        {[-0.6, 0, 0.6].map((k, i) => { const y = k * r; const rx = Math.sqrt(r * r - y * y); return <ellipse key={i} cy={y} rx={rx} ry={rx * 0.16} fill="none" stroke="#0f1b33" strokeOpacity=".06" /> })}
        {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.3} fill="#7d8aa3" opacity={0.45 + ((i * 7) % 5) * 0.06} />)}
        {arcs.map(([a, b], i) => {
          const [x1, y1] = nodes[a], [x2, y2] = nodes[b]
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 34
          return <path key={i} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke="url(#lg-arc)" strokeOpacity=".8" strokeWidth="1.4" strokeDasharray="3 6" style={{ animation: `dash-flow ${2.4 + (i % 3)}s linear infinite` }} />
        })}
      </g>
      {nodes.map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y})`}>
          <circle r={8} fill={i % 2 ? '#3b74f2' : '#14ab92'} opacity=".25" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `pulse-ring 3s ${i * 0.35}s ease-out infinite` }} />
          <circle r={3.4} fill="#ffffff" stroke={i % 2 ? '#2459e0' : '#0b8a77'} strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  )
}

function Chip({ icon, label, className, delay = 0 }: { icon: string; label: string; className?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + delay, duration: 0.5 }} className={cn('absolute', className)}>
      <div className="float-y flex items-center gap-1.5 h-7 pl-1 pr-2.5 rounded-full bg-white/90 backdrop-blur border border-black/[.06] shadow-[0_6px_16px_-8px_rgb(15_27_51/.18)]" style={{ animationDelay: `${delay * 3}s` }}>
        <span className="h-5 w-5 rounded-full bg-slate-100 grid place-items-center text-ink-2"><Icon name={icon} size={11} /></span>
        <span className="text-[10px] font-semibold tracking-[.08em] text-ink-2">{label}</span>
      </div>
    </motion.div>
  )
}

const STEPS = [
  { icon: 'Lightbulb', label: 'Capture &\nvalue' },
  { icon: 'ShieldCheck', label: 'Feasibility\n& R&D' },
  { icon: 'BadgeCheck', label: 'Sourcing\napproval' },
  { icon: 'Rocket', label: 'Execute &\ntrack' },
  { icon: 'BadgeIndianRupee', label: 'Realise &\nprove' },
]


export default function Login() {
  const { login, loginAs, users, toast, ideas, suppliers } = useStore()
  const nav = useNavigate()
  const loc = useLocation() as any
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [show, setShow] = useState(false)
  const [keep, setKeep] = useState(true)
  const [forgot, setForgot] = useState(false)
  const go = () => nav(loc.state?.from && loc.state.from !== '/login' ? loc.state.from : '/', { replace: true })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) { setErr('Enter your work email / employee ID and password.'); return }
    if (login(email, password)) { toast('Welcome to COIN · Cost Innovation Hub'); go() }
    else setErr('Invalid credentials. For this demo every persona uses the password coin@2026.')
  }
  const stats: [string, string, string][] = [
    ['CircleCheckBig', 'Ideas implemented', String(ideas.filter((i) => i.bucket === 'Implemented').length)],
    ['Lightbulb', 'Ideas in the network', String(ideas.filter((i) => i.stage !== 'Draft').length)],
    ['Factory', 'Suppliers in VMS', String(suppliers.length)],
    ['LayoutGrid', 'Modules · 25 KPIs', '12'],
  ]

  return (
    <div className="relative min-h-dvh lg:h-dvh w-full overflow-x-hidden bg-[#fbfaf7] text-ink">
      <Backdrop />
      <div className="relative z-10 min-h-dvh lg:h-full flex flex-col px-5 sm:px-10 xl:px-14 py-[clamp(14px,2.6vh,30px)]">
        {/* Header lock-up */}
        <motion.header initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 shrink-0">
          <AmberWordmark size={28} />
          <span className="hidden sm:block h-7 w-px bg-black/10" />
          <div className="hidden sm:block leading-tight">
            <div className="text-[14px] font-semibold text-ink tracking-tight">COIN · Cost Optimisation & Innovation Network</div>
            <div className="text-[9.5px] font-medium tracking-[.22em] text-muted uppercase mt-0.5">Ideas · Validation · Approval · Execution · Realisation</div>
          </div>
          <span className="ml-auto hidden md:inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/70 border border-black/[.06] text-[11px] font-medium text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />FY27 · Sourcing Excellence
          </span>
        </motion.header>

        <main className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_clamp(400px,30vw,470px)] gap-[clamp(28px,4vw,72px)] items-center py-[clamp(12px,2.4vh,28px)]">
          {/* Left — story */}
          <section className="relative min-w-0 hidden lg:flex flex-col justify-center gap-[clamp(14px,3vh,34px)]">
            <div className="grid xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)] items-center gap-6">
              <div className="min-w-0">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/80 border border-black/[.06] text-[11.5px] font-medium text-ink-2 shadow-[0_1px_2px_rgb(15_27_51/.04)]">
                  Ideas <Icon name="ChevronRight" size={11} className="text-muted" /> Value <Icon name="ChevronRight" size={11} className="text-muted" /> Approve <Icon name="ChevronRight" size={11} className="text-muted" /> Execute <Icon name="ChevronRight" size={11} className="text-muted" /> Prove
                </motion.div>
                <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }} className="mt-[clamp(10px,2vh,20px)] text-[clamp(32px,5.2vh,54px)] leading-[1.04] font-bold tracking-[-0.04em] text-ink">
                  Every idea valued.<br />Every rupee <span className="text-brand-grad">proven.</span>
                </motion.h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-[clamp(8px,1.6vh,16px)] text-[clamp(13px,1.6vh,15px)] leading-relaxed text-ink-2/90 max-w-[520px]">
                  The single system Amber's Sourcing team uses to capture, value, approve, execute and prove every cost-reduction idea.
                </motion.p>

                {/* CO / IN */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-[clamp(10px,2vh,20px)] grid grid-cols-2 gap-3 max-w-[560px]">
                  {[
                    { k: 'CO', t: 'Cost Optimisation', d: 'Implementation, execution and realised savings after approval.', c: 'text-brand-600', b: 'bg-brand-50 ring-brand-100' },
                    { k: 'IN', t: 'Innovation Network', d: 'Ideas, suppliers, campaigns, validation and approval: the overall idea network.', c: 'text-accent-600', b: 'bg-accent-50 ring-accent-100' },
                  ].map((x) => (
                    <div key={x.k} className="rounded-xl bg-white/75 backdrop-blur border border-black/[.06] px-3.5 py-[clamp(8px,1.4vh,12px)] shadow-[0_1px_2px_rgb(15_27_51/.04)]">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-6 px-1.5 min-w-7 rounded-md ring-1 grid place-items-center text-[11px] font-extrabold tracking-wide', x.b, x.c)}>{x.k}</span>
                        <span className="text-[13px] font-semibold text-ink tracking-tight">{x.t}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-snug text-muted">{x.d}</p>
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* globe cluster */}
              <div className="relative hidden xl:block justify-self-center w-[clamp(250px,48vh,480px)] aspect-square">
                <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-[6%]">
                  <Globe />
                </motion.div>
                <Chip icon="Users" label="SUPPLIERS" className="left-[2%] top-[4%]" delay={0} />
                <Chip icon="Lightbulb" label="IDEAS" className="right-[2%] top-[12%]" delay={0.1} />
                <Chip icon="BadgeCheck" label="APPROVALS" className="-left-[4%] top-[46%]" delay={0.2} />
                <Chip icon="ChartColumnIncreasing" label="ANALYTICS" className="-right-[2%] top-[56%]" delay={0.3} />
                <Chip icon="Rocket" label="EXECUTION" className="left-[4%] bottom-[4%]" delay={0.4} />
                <Chip icon="BadgeIndianRupee" label="REALISATION" className="right-[2%] bottom-[0%]" delay={0.5} />
              </div>
            </div>

            {/* process timeline */}
            <div className="relative max-w-[640px]">
              <div className="absolute left-[10%] right-[10%] top-[clamp(16px,2.2vh,20px)] border-t border-dashed border-black/15" />
              <div className="relative grid grid-cols-5 gap-2">
                {STEPS.map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 + i * 0.07 }} className="flex flex-col items-center text-center">
                    <div className={cn('h-[clamp(32px,4.4vh,40px)] w-[clamp(32px,4.4vh,40px)] rounded-xl bg-white border border-black/[.07] grid place-items-center shadow-[0_2px_6px_-2px_rgb(15_27_51/.1)]', i === 4 ? 'text-accent-600' : 'text-ink-2')}>
                      <Icon name={s.icon} size={17} />
                    </div>
                    <div className="text-[10px] font-semibold text-muted mt-[clamp(4px,0.8vh,8px)] tracking-[.12em]">0{i + 1}</div>
                    <div className="text-[11.5px] font-medium text-ink-2 mt-0.5 whitespace-pre-line leading-tight">{s.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* stats strip */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="grid grid-cols-4 rounded-2xl bg-white/75 backdrop-blur border border-black/[.06] shadow-[0_1px_2px_rgb(15_27_51/.04)] divide-x divide-black/[.06]">
              {stats.map(([icon, label, v]) => (
                <div key={label} className="flex items-center gap-3 px-4 py-[clamp(9px,1.5vh,14px)] min-w-0">
                  <span className="h-8 w-8 rounded-lg bg-slate-100/80 grid place-items-center text-ink-2 shrink-0"><Icon name={icon} size={15} /></span>
                  <div className="min-w-0"><div className="text-[clamp(16px,2.2vh,20px)] font-bold text-ink tracking-tight num leading-none">{v}</div><div className="text-[11px] text-muted mt-1 truncate">{label}</div></div>
                </div>
              ))}
            </motion.div>
          </section>

          {/* Right — sign-in card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: 'spring', duration: 0.8, bounce: 0.1 }} className="w-full max-w-[470px] mx-auto lg:mx-0 lg:justify-self-end">
            <div className="relative rounded-[20px] bg-white/90 backdrop-blur-xl border border-black/[.06] shadow-[0_1px_2px_rgb(15_27_51/.04),0_24px_60px_-24px_rgb(15_27_51/.22)] px-6 sm:px-7 py-[clamp(16px,2.8vh,28px)]">
              <div>
                <div className="text-[11.5px] font-semibold tracking-[.16em] uppercase text-accent-600">Welcome back</div>
                <h2 className="text-[clamp(19px,2.6vh,23px)] font-bold tracking-[-0.025em] text-ink mt-1">Sign in to Cost Innovation Hub</h2>
                <p className={cn('text-[12.5px] text-muted mt-1', '[@media(max-height:780px)]:hidden')}>Use your work email or employee ID and password.</p>
              </div>

              <form onSubmit={submit} className="mt-[clamp(12px,2.2vh,22px)] space-y-[clamp(8px,1.4vh,14px)]">
                <div>
                  <label className="label !text-[12px] !text-ink-2 !font-semibold">Email / Employee ID</label>
                  <div className="relative">
                    <Icon name="Mail" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input className="input !h-[clamp(38px,5vh,44px)] !pl-10 !rounded-xl !bg-[#f6f6f3] !border-black/[.07] focus:!bg-white" placeholder="you@ambergroupindia.com" value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} autoComplete="username" />
                  </div>
                </div>
                <div>
                  <label className="label !text-[12px] !text-ink-2 !font-semibold">Password</label>
                  <div className="relative">
                    <Icon name="LockKeyhole" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input type={show ? 'text' : 'password'} className="input !h-[clamp(38px,5vh,44px)] !pl-10 !pr-11 !rounded-xl !bg-[#f6f6f3] !border-black/[.07] focus:!bg-white" placeholder="Enter your password" value={password} onChange={(e) => { setPassword(e.target.value); setErr('') }} autoComplete="current-password" />
                    <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-black/[.04]"><Icon name={show ? 'EyeOff' : 'Eye'} size={15} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <label className="flex items-center gap-2 text-ink-2 cursor-pointer select-none"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-4 w-4 accent-brand-600" />Keep me signed in</label>
                  <button type="button" onClick={() => setForgot(true)} className="font-semibold text-brand-600 hover:text-brand-800">Forgot password?</button>
                </div>
                {err && <div className="text-[12px] text-red-600 bg-red-50/90 ring-1 ring-red-100 rounded-xl px-3 py-2 flex items-center gap-2"><Icon name="CircleAlert" size={14} className="shrink-0" />{err}</div>}
                <button className="group relative w-full h-[clamp(40px,5.2vh,46px)] rounded-xl text-white font-semibold text-[14px] overflow-hidden bg-[#111a2e] hover:bg-[#1a2540] shadow-[0_1px_0_rgb(255_255_255/.12)_inset,0_8px_20px_-10px_rgb(15_27_51/.6)] transition-all active:scale-[.99]">
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 opacity-90" />
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <span className="relative inline-flex items-center gap-2">Sign in <Icon name="ArrowRight" size={15} /></span>
                </button>
              </form>

              <div className="flex items-center gap-3 my-[clamp(10px,2vh,18px)] text-[10px] font-semibold uppercase tracking-[.2em] text-muted"><span className="h-px flex-1 bg-black/[.07]" />Quick demo access<span className="h-px flex-1 bg-black/[.07]" /></div>
              <div className="grid grid-cols-2 auto-rows-fr gap-1.5">
                {QUICK_LOGINS.map((d) => {
                  const u = users.find((x) => x.id === d.userId)!
                  const head = users.find((x) => x.id === d.signInAs)!
                  return (
                    <button key={d.userId} title={`${d.role} — signs in as ${head.name} (Sourcing Head)`} onClick={() => { loginAs(d.signInAs); toast(`Signed in as ${head.name} · Sourcing Head`); go() }}
                      className="group flex items-center gap-[7px] rounded-xl bg-[#f6f6f3] border border-transparent px-2 py-[clamp(5px,0.8vh,7px)] text-left hover:bg-white hover:border-black/[.08] hover:shadow-[0_6px_16px_-10px_rgb(15_27_51/.35)] transition-all min-w-0">
                      <Avatar name={u.name} color={u.avatarColor} size={22} />
                      <span className="min-w-0"><span className="block text-[10.5px] font-semibold text-ink line-clamp-2 leading-[1.15] tracking-[-0.005em]">{d.role}</span><span className="block text-[10px] text-muted truncate leading-tight mt-px">{u.name}</span></span>
                    </button>
                  )
                })}
              </div>

              <div className={cn('mt-[clamp(10px,1.8vh,16px)] flex items-center gap-3 text-[11.5px] leading-snug', '[@media(max-height:780px)]:hidden')}>
                <span className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center text-ink-2 shrink-0"><Icon name="UsersRound" size={15} /></span>
                <div><span className="font-semibold text-ink">New to COIN?</span> <span className="text-muted">Contact your account administrator (Sourcing Excellence / IT).</span></div>
              </div>
            </div>
            <p className="text-[11px] text-muted mt-[clamp(8px,1.4vh,12px)] text-center flex items-center justify-center gap-1.5 flex-wrap"><Icon name="ShieldCheck" size={13} className="text-accent-600" />Front-end demo · data stays in this browser · password <code className="font-mono font-semibold text-ink bg-black/[.04] px-1 rounded">coin@2026</code></p>
          </motion.div>
        </main>

        <footer className="shrink-0 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span>© 2026 Amber Enterprises India Ltd. All rights reserved.</span>
          <span>Scope of Work v1.0 · Prepared by Genessence · FY27 (Apr 2026 – Mar 2027)</span>
        </footer>
      </div>

      <Modal open={forgot} onClose={() => setForgot(false)} title="Reset your password" subtitle="Single sign-on / AD manages employee credentials" icon="KeyRound" size="sm"
        footer={<Button variant="primary" onClick={() => setForgot(false)}>Got it</Button>}>
        <div className="text-[13px] text-ink-2 space-y-2">
          <p>Employee passwords are managed by Amber's Active Directory. Use the standard IT self-service reset, or contact <b>Sourcing Excellence / IT</b> (COIN Admin).</p>
          <p>Suppliers access COIN through time-bound secure links sent with each feasibility request or workshop invitation.</p>
          <p className="text-muted">Demo: every persona's password is <code className="font-mono text-ink">coin@2026</code>.</p>
        </div>
      </Modal>
    </div>
  )
}
