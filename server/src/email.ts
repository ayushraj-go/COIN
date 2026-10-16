// Email delivery. Every email the workflow writes is stored in the `emails` table (the outbox, readable in the app).
// EMAIL_DRIVER=outbox keeps them there; EMAIL_DRIVER=smtp also sends them through SMTP_URL (AWS SES SMTP works)
// and records sent / failed per email.
import nodemailer from 'nodemailer'
import type { Config } from './config'
import type { Db } from './db'

export class Mailer {
  private transport: nodemailer.Transporter | null = null
  constructor(private db: Db, private config: Config, private log: { warn: (o: object, m: string) => void }) {
    if (config.EMAIL_DRIVER === 'smtp') {
      if (!config.SMTP_URL) throw new Error('EMAIL_DRIVER=smtp needs SMTP_URL')
      this.transport = nodemailer.createTransport(config.SMTP_URL)
    }
  }

  /** Deliver newly written emails (after the command committed). Never throws — failures are recorded. */
  async deliver(orgId: string, ids: string[]) {
    if (!this.transport || !ids.length) return
    const { rows } = await this.db.query('select id, to_addrs, subject, data from emails where org_id = $1 and id = any($2) and status = $3', [orgId, ids, 'logged'])
    for (const e of rows) {
      try {
        await this.transport.sendMail({ from: this.config.EMAIL_FROM, to: e.to_addrs.join(', '), subject: e.subject, text: e.data?.body ?? '' })
        await this.db.query("update emails set status = 'sent', sent_at = now(), error = null where org_id = $1 and id = $2", [orgId, e.id])
      } catch (err) {
        this.log.warn({ err, email: e.id }, 'email delivery failed')
        await this.db.query("update emails set status = 'failed', error = $3 where org_id = $1 and id = $2", [orgId, e.id, String((err as Error).message).slice(0, 300)])
      }
    }
  }
}
