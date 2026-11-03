import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useStore } from '../store/useStore'
import { Icon, Modal, Button, cn } from '../components/ui'
import { AmberWordmark } from '../components/Logo'

// Film grain as an inline SVG (fractal noise), tiled at very low opacity.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── Backdrop: warm near-white, a quiet mesh of blue + teal light, faint grid and grain ──
function Backdrop() {
  return (
    <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[var(--color-gray-50)]" />
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(60% 55% at 12% 8%, rgb(34 60 134 / .085), transparent 70%)',
            'radial-gradient(45% 50% at 96% 4%, rgb(20 171 146 / .07), transparent 70%)',
            'radial-gradient(50% 55% at 88% 100%, rgb(34 60 134 / .06), transparent 70%)',
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

const STEPS = [
  { icon: 'Lightbulb', label: 'Idea\nsubmitted' },
  { icon: 'Presentation', label: 'Workshop /\nevent' },
  { icon: 'BadgeCheck', label: 'Workshops &\nManagement approval' },
  { icon: 'Rocket', label: 'Execution\nstarted' },
  { icon: 'BadgeIndianRupee', label: 'Verification' },
]

// CO / IN is chosen first, as its own step; the sign-in form appears only after a pick and the ID then lands on that workspace's dashboard
const SPACES = [
  { k: 'IN', t: 'Innovation Network', d: 'Submit ideas, run workshops and events, and take them to Management approval.', tags: ['Ideas', 'Workshops', 'Approval'], c: 'text-accent-600', b: 'bg-accent-50 ring-accent-100' },
  { k: 'CO', t: 'Cost Optimisation', d: 'Execute approved ideas, run MRN realisation and verify the savings.', tags: ['Execution', 'MRN', 'Verification'], c: 'text-brand-600', b: 'bg-brand-50 ring-brand-100' },
] as const
type SpaceKey = (typeof SPACES)[number]['k']

function WorkspacePicker({ onPick }: { onPick: (k: SpaceKey) => void }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold tracking-[.16em] uppercase text-accent-600">Welcome</div>
      <h2 className="text-[clamp(19px,2.6vh,23px)] font-bold tracking-[-0.025em] text-ink mt-1">Where are you headed?</h2>
      <p className="text-[12.5px] text-muted mt-1">COIN has two workspaces. Pick one to sign in.</p>
      <div className="mt-[clamp(12px,2vh,18px)] space-y-2.5">
        {SPACES.map((x, i) => (
          <motion.button key={x.k} type="button" onClick={() => onPick(x.k)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
            className="group w-full text-left rounded-2xl border border-black/[.08] bg-white px-4 py-3.5 transition-all hover:border-brand-400 hover:shadow-[0_14px_30px_-18px_rgb(15_27_51/.4)] hover:-translate-y-px outline-none focus-visible:ring-2 focus-visible:ring-brand-300 active:scale-[.995]">
            <span className="flex items-start gap-3">
              <span className={cn('h-10 w-10 shrink-0 rounded-xl ring-1 grid place-items-center text-[12px] font-extrabold tracking-wide', x.b, x.c)}>{x.k}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-ink tracking-tight">{x.t}</span>
                  <Icon name="ArrowRight" size={15} className="ml-auto shrink-0 text-muted transition-all group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </span>
                <span className="block mt-0.5 text-[12.5px] leading-snug text-ink-2">{x.d}</span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {x.tags.map((t) => <span key={t} className="h-5 px-2 rounded-full bg-slate-100 text-[10.5px] font-semibold text-ink-2 inline-flex items-center">{t}</span>)}
                </span>
              </span>
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

export default function Login() {
  const { login, toast, ideas, suppliers } = useStore()
  const nav = useNavigate()
  const loc = useLocation() as any
  const [space, setSpace] = useState<SpaceKey | null>(null)
  const cur = SPACES.find((x) => x.k === space)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [show, setShow] = useState(false)
  const [keep, setKeep] = useState(true)
  const [forgot, setForgot] = useState(false)
  const go = () => { useStore.getState().setSpace(space); nav(loc.state?.from && loc.state.from !== '/login' ? loc.state.from : '/', { replace: true }) }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) { setErr('Enter your ID and password.'); return }
    if (login(email, password)) { toast('Welcome to COIN'); go() }
    else setErr('Invalid ID or password.')
  }
  const stats: [string, string, string][] = [
    ['CircleCheckBig', 'Ideas implemented', String(ideas.filter((i) => i.bucket === 'Implemented').length)],
    ['Lightbulb', 'Ideas in the network', String(ideas.filter((i) => i.stage !== 'Draft').length)],
    ['Factory', 'Suppliers', String(suppliers.length)],
    ['LayoutGrid', 'Modules · 25 KPIs', '12'],
  ]

  return (
    <div className="relative min-h-dvh lg:h-dvh w-full overflow-x-hidden bg-[var(--color-gray-50)] text-ink">
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
          <section className="relative min-w-0 w-full max-w-[720px] hidden lg:flex flex-col justify-center gap-[clamp(14px,3vh,34px)]">
            <div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/80 border border-black/[.06] text-[11.5px] font-medium text-ink-2 shadow-[0_1px_2px_rgb(15_27_51/.04)]">
                Ideas <Icon name="ChevronRight" size={11} className="text-muted" /> Value <Icon name="ChevronRight" size={11} className="text-muted" /> Approve <Icon name="ChevronRight" size={11} className="text-muted" /> Execute <Icon name="ChevronRight" size={11} className="text-muted" /> Prove
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }} className="mt-[clamp(10px,2vh,20px)] text-[clamp(32px,5.2vh,54px)] leading-[1.04] font-bold tracking-[-0.04em] text-ink">
                Every idea valued.<br />Every rupee <span className="text-brand-grad">proven.</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-[clamp(8px,1.6vh,16px)] text-[clamp(13px,1.6vh,15px)] leading-relaxed text-ink-2/90 max-w-[520px]">
                The single system Amber's Sourcing team uses to capture, value, approve, execute and prove every cost-reduction idea.
              </motion.p>
            </div>

            {/* process timeline */}
            <div className="relative">
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
                <div key={label} className="flex items-center gap-2.5 px-3 py-[clamp(9px,1.5vh,14px)] min-w-0">
                  <span className="h-8 w-8 rounded-lg bg-slate-100/80 grid place-items-center text-ink-2 shrink-0"><Icon name={icon} size={15} /></span>
                  <div className="min-w-0"><div className="text-[clamp(16px,2.2vh,20px)] font-bold text-ink tracking-tight num leading-none">{v}</div><div className="text-[11px] text-muted mt-1 truncate">{label}</div></div>
                </div>
              ))}
            </motion.div>
          </section>

          {/* Right — step 1 picks the workspace, step 2 signs in; the two swap in place */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: 'spring', duration: 0.8, bounce: 0.1 }} className="w-full max-w-[470px] mx-auto lg:mx-0 lg:justify-self-end">
            <AnimatePresence mode="wait" initial={false}>
            <motion.div key={cur ? 'sign-in' : 'pick'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-[20px] bg-white/90 backdrop-blur-xl border border-black/[.06] shadow-[0_1px_2px_rgb(15_27_51/.04),0_24px_60px_-24px_rgb(15_27_51/.22)] px-6 sm:px-7 py-[clamp(16px,2.8vh,28px)]">
            {!cur ? <WorkspacePicker onPick={(k) => { setSpace(k); setErr('') }} /> : <>
              <div className="flex items-center gap-2 pb-[clamp(10px,1.8vh,16px)] mb-[clamp(10px,1.8vh,16px)] border-b border-black/[.06]">
                <span className={cn('h-6 px-1.5 min-w-7 rounded-md ring-1 grid place-items-center text-[10.5px] font-extrabold tracking-wide', cur.b, cur.c)}>{cur.k}</span>
                <span className="text-[13px] font-semibold text-ink tracking-tight truncate">{cur.t}</span>
                <button type="button" onClick={() => { setSpace(null); setErr('') }} className="ml-auto shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-600 hover:text-brand-800"><Icon name="ArrowLeft" size={12} />Change</button>
              </div>
              <div>
                <div className="text-[11.5px] font-semibold tracking-[.16em] uppercase text-accent-600">Welcome back</div>
                <h2 className="text-[clamp(19px,2.6vh,23px)] font-bold tracking-[-0.025em] text-ink mt-1">Sign in to COIN</h2>
                <p className={cn('text-[12.5px] text-muted mt-1', '[@media(max-height:780px)]:hidden')}>Use your team's ID.</p>
              </div>

              <form onSubmit={submit} className="mt-[clamp(10px,1.8vh,16px)] space-y-[clamp(8px,1.4vh,14px)]">
                <div>
                  <label className="label !text-[12px] !text-ink-2 !font-semibold">Your ID</label>
                  <div className="relative">
                    <Icon name="Mail" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input className="input !h-[clamp(38px,5vh,44px)] !pl-10 !rounded-xl !bg-[var(--color-gray-100)] !border-black/[.07] focus:!bg-white" placeholder="sourcing@ambergroupindia.com" value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} autoComplete="username" />
                  </div>
                </div>
                <div>
                  <label className="label !text-[12px] !text-ink-2 !font-semibold">Password</label>
                  <div className="relative">
                    <Icon name="LockKeyhole" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input type={show ? 'text' : 'password'} className="input !h-[clamp(38px,5vh,44px)] !pl-10 !pr-11 !rounded-xl !bg-[var(--color-gray-100)] !border-black/[.07] focus:!bg-white" placeholder="Enter your password" value={password} onChange={(e) => { setPassword(e.target.value); setErr('') }} autoComplete="current-password" />
                    <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-black/[.04]"><Icon name={show ? 'EyeOff' : 'Eye'} size={15} /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <label className="flex items-center gap-2 text-ink-2 cursor-pointer select-none"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-4 w-4 accent-brand-600" />Keep me signed in</label>
                  <button type="button" onClick={() => setForgot(true)} className="font-semibold text-brand-600 hover:text-brand-800">Forgot password?</button>
                </div>
                {err && <div className="text-[12px] text-red-600 bg-red-50/90 ring-1 ring-red-100 rounded-xl px-3 py-2 flex items-center gap-2"><Icon name="CircleAlert" size={14} className="shrink-0" />{err}</div>}
                <button className="group relative w-full h-[clamp(40px,5.2vh,46px)] rounded-xl text-white font-semibold text-[14px] overflow-hidden bg-[var(--color-slate-900)] hover:bg-[var(--color-slate-800)] shadow-[0_1px_0_rgb(255_255_255/.12)_inset,0_8px_20px_-10px_rgb(15_27_51/.6)] transition-all active:scale-[.99]">
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 opacity-90" />
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <span className="relative inline-flex items-center gap-2">Sign in <Icon name="ArrowRight" size={15} /></span>
                </button>
              </form>

            </>}
            </motion.div>
            </AnimatePresence>
            <p className="text-[11px] text-muted mt-[clamp(8px,1.4vh,12px)] text-center flex items-center justify-center gap-1.5 flex-wrap"><Icon name="ShieldCheck" size={13} className="text-accent-600" />Front-end demo · data stays in this browser</p>
          </motion.div>
        </main>

        <footer className="shrink-0 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span>© 2026 Amber Enterprises India Ltd. All rights reserved.</span>
          <span>Scope of Work v3.0 · Prepared by Genessence · FY27 (Apr 2026 – Mar 2027)</span>
        </footer>
      </div>

      <Modal open={forgot} onClose={() => setForgot(false)} title="Reset your password" subtitle="IT manages the sign-in IDs" icon="KeyRound" size="sm"
        footer={<Button variant="primary" onClick={() => setForgot(false)}>Got it</Button>}>
        <div className="text-[13px] text-ink-2 space-y-2">
          <p>Each team shares one ID. To reset its password, contact <b>Sourcing Excellence / IT</b> (the Management ID).</p>
          <p>Suppliers do not sign in. They reach COIN through the unique link of a campaign.</p>
        </div>
      </Modal>
    </div>
  )
}
