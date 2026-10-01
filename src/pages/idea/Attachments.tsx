// Attachments gallery — up to 10 files per idea, 10 MB each; images preview, others as file tiles (NFR).
import { useRef, useState } from 'react'
import type { Attachment, Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { Button, Card, EmptyState, Icon, Modal, cn } from '../../components/ui'
import { fmtDate, nowIso, uid } from '../../lib/format'
import { fileSize, ideaPerms } from './model'

const MAX_FILES = 10
const MAX_BYTES = 10 * 1024 * 1024
const EMBED_LIMIT = 1.5 * 1024 * 1024 // larger non-image files are stored as references (browser storage budget)

const isImage = (a: Pick<Attachment, 'type' | 'name'>) => a.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.name)
function fileIcon(a: Attachment): [string, string] {
  const n = a.name.toLowerCase()
  if (isImage(a)) return ['FileImage', '#7c3aed']
  if (n.endsWith('.pdf')) return ['FileText', '#e0364f']
  if (/\.(xlsx?|csv)$/.test(n)) return ['FileSpreadsheet', '#0f9f6e']
  if (/\.(docx?|txt)$/.test(n)) return ['FileText', '#4470d6']
  if (/\.(zip|rar|7z)$/.test(n)) return ['FileArchive', '#ec8a1c']
  if (/\.(dwg|dxf|step|stp|igs)$/.test(n)) return ['FileCode2', '#0d9488']
  return ['File', '#64748b']
}

function readDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f) })
}
/** Downscale large photos so previews stay within the browser storage budget */
async function imageDataUrl(f: File): Promise<string | undefined> {
  const raw = await readDataUrl(f)
  if (f.size <= 700 * 1024 || f.type === 'image/svg+xml' || f.type === 'image/gif') return f.size <= EMBED_LIMIT ? raw : undefined
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      res(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => res(undefined)
    img.src = raw
  })
}

export function Attachments({ idea, compact }: { idea: Idea; compact?: boolean }) {
  const me = useMe()
  const addAttachments = useStore((s) => s.addAttachments)
  const toast = useStore((s) => s.toast)
  const perms = ideaPerms(me, idea)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState<Attachment | null>(null)
  const remaining = MAX_FILES - idea.attachments.length

  const onFiles = async (files: FileList | File[] | null) => {
    if (!files || !me) return
    const list = Array.from(files)
    if (!list.length) return
    if (remaining <= 0) { toast('Up to 10 files per idea — this idea already has 10', 'error'); return }
    const tooBig = list.filter((f) => f.size > MAX_BYTES)
    if (tooBig.length) toast(`${tooBig.map((f) => f.name).join(', ')} exceed${tooBig.length === 1 ? 's' : ''} the 10 MB limit`, 'error')
    const okFiles = list.filter((f) => f.size <= MAX_BYTES)
    if (okFiles.length > remaining) toast(`Only ${remaining} more file${remaining === 1 ? '' : 's'} allowed — up to 10 files per idea`, 'warning')
    const take = okFiles.slice(0, remaining)
    if (!take.length) return
    setBusy(true)
    try {
      let refOnly = 0
      const atts: Attachment[] = await Promise.all(take.map(async (f) => {
        let dataUrl: string | undefined
        try { dataUrl = isImage(f) ? await imageDataUrl(f) : f.size <= EMBED_LIMIT ? await readDataUrl(f) : undefined } catch { dataUrl = undefined }
        if (!dataUrl) refOnly++
        return { id: uid('att'), name: f.name, size: f.size, type: f.type || 'application/octet-stream', dataUrl, uploadedAt: nowIso(), by: me.name }
      }))
      try {
        addAttachments(idea.id, atts)
      } catch {
        // storage quota — keep the files as references only
        const ids = new Set(atts.map((a) => a.id))
        useStore.setState((s) => ({ ideas: s.ideas.map((i) => (i.id === idea.id ? { ...i, attachments: i.attachments.map((a) => (ids.has(a.id) ? { ...a, dataUrl: undefined } : a)) } : i)) }))
        refOnly = atts.length
      }
      toast(`${atts.length} attachment${atts.length === 1 ? '' : 's'} added to ${idea.id}${refOnly ? ` · ${refOnly} stored as reference` : ''}`, 'success')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const open = (a: Attachment) => {
    if (a.dataUrl && isImage(a)) { setPreview(a); return }
    if (a.dataUrl) { const el = document.createElement('a'); el.href = a.dataUrl; el.download = a.name; el.click(); return }
    toast(`${a.name} is held in the document repository — preview not available here`, 'info')
  }

  return (
    <Card title="Attachments" icon="Paperclip" subtitle={compact ? undefined : `${idea.attachments.length} of ${MAX_FILES} files · images, PDF, Excel, CAD-export PDF · 10 MB each`}
      actions={perms.upload && remaining > 0 ? <Button size="sm" icon="Upload" loading={busy} onClick={() => input.current?.click()}>Upload</Button> : undefined}>
      <input ref={input} type="file" multiple hidden accept="image/*,.pdf,.xls,.xlsx,.csv,.doc,.docx,.dwg,.dxf,.step,.stp,.zip" onChange={(e) => onFiles(e.target.files)} />
      <div
        onDragOver={(e) => { if (!perms.upload) return; e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { if (!perms.upload) return; e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files) }}
        className={cn('rounded-xl transition', drag && 'ring-2 ring-brand-400 ring-offset-2 bg-brand-50/40')}>
        {idea.attachments.length === 0 ? (
          <EmptyState icon="Paperclip" className="py-6" title="No attachments yet"
            desc={perms.upload ? 'Drop quotes, drawings, trial reports or photos here — up to 10 files, 10 MB each.' : 'The submitter has not attached any evidence.'}
            action={perms.upload ? <Button size="sm" variant="primary" icon="Upload" onClick={() => input.current?.click()}>Add files</Button> : undefined} />
        ) : (
          <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')}>
            {idea.attachments.map((a) => {
              const [icon, color] = fileIcon(a)
              return (
                <button key={a.id} onClick={() => open(a)} className="group text-left rounded-xl border border-line bg-white overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
                  {a.dataUrl && isImage(a) ? (
                    <div className="h-24 bg-slate-100 overflow-hidden"><img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" /></div>
                  ) : (
                    <div className="h-24 grid place-items-center" style={{ background: `${color}0d` }}>
                      <div className="flex flex-col items-center gap-1" style={{ color }}>
                        <Icon name={icon} size={28} strokeWidth={1.6} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{a.name.split('.').pop()}</span>
                      </div>
                    </div>
                  )}
                  <div className="px-2 py-1.5 border-t border-line">
                    <div className="text-[11.5px] font-semibold text-ink truncate" title={a.name}>{a.name}</div>
                    <div className="text-[10.5px] text-muted truncate">{fileSize(a.size)} · {a.by} · {fmtDate(a.uploadedAt.slice(0, 10))}</div>
                  </div>
                </button>
              )
            })}
            {perms.upload && remaining > 0 && (
              <button onClick={() => input.current?.click()} className="rounded-xl border-2 border-dashed border-slate-200 hover:border-brand-300 hover:bg-brand-50/40 text-muted hover:text-brand-700 grid place-items-center min-h-[140px] transition">
                <span className="flex flex-col items-center gap-1 text-[11.5px] font-semibold"><Icon name="CloudUpload" size={22} />Add files<span className="font-normal text-[10.5px]">{remaining} remaining</span></span>
              </button>
            )}
          </div>
        )}
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? ''} subtitle={preview ? `${fileSize(preview.size)} · uploaded by ${preview.by} on ${fmtDate(preview.uploadedAt.slice(0, 10))}` : ''} icon="FileImage" size="xl">
        {preview?.dataUrl && <img src={preview.dataUrl} alt={preview.name} className="max-h-[70vh] mx-auto rounded-lg" />}
      </Modal>
    </Card>
  )
}
