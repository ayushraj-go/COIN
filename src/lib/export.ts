// Every list and report exports to Excel; reports to PDF (Section 15)
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportExcel(filename: string, sheets: { name: string; rows: Record<string, any>[] }[]) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ Info: 'No data for the active filters' }])
    const keys = Object.keys(s.rows[0] ?? { Info: '' })
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(48, Math.max(10, k.length + 2, ...s.rows.slice(0, 50).map((r) => String(r[k] ?? '').length + 1))) }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export interface PdfSection { title: string; head: string[]; body: (string | number)[][] }
export function exportPdf(opts: { filename: string; title: string; subtitle?: string; filters?: string; kpis?: [string, string][]; sections: PdfSection[]; landscape?: boolean }) {
  const doc = new jsPDF({ orientation: opts.landscape === false ? 'portrait' : 'landscape', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setFillColor(200, 16, 46)
  doc.rect(0, 0, W, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text(opts.title.replace(/₹\s?/g, 'Rs '), 32, 30)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
  doc.text(`COIN - Cost Optimisation & Innovation Network | Amber Enterprises India Ltd.${opts.subtitle ? ' | ' + opts.subtitle : ''}`, 32, 48)
  let y = 84
  doc.setTextColor(71, 85, 105); doc.setFontSize(8.5)
  if (opts.filters) { doc.text(`Filters: ${opts.filters}`, 32, y); y += 14 }
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, 32, y); y += 12
  if (opts.kpis?.length) {
    const bw = (W - 64 - (opts.kpis.length - 1) * 8) / opts.kpis.length
    opts.kpis.forEach(([k, v], i) => {
      const x = 32 + i * (bw + 8)
      doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240)
      doc.roundedRect(x, y, bw, 44, 4, 4, 'FD')
      doc.setTextColor(100, 116, 139); doc.setFontSize(7.5); doc.text(k.toUpperCase(), x + 8, y + 15)
      doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(v.replace(/₹\s?/g, 'Rs '), x + 8, y + 34)
      doc.setFont('helvetica', 'normal')
    })
    y += 58
  }
  for (const s of opts.sections) {
    doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    if (y > H - 80) { doc.addPage(); y = 40 }
    doc.text(s.title, 32, y + 4)
    autoTable(doc, {
      startY: y + 10,
      head: [s.head.map((h) => h.replace(/₹\s?/g, 'Rs '))],
      body: s.body.map((r) => r.map((c) => String(c).replace(/₹\s?/g, 'Rs ').replace(/−/g, '-'))),
      styles: { fontSize: 7.5, cellPadding: 3.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 32, right: 32 },
    })
    y = (doc as any).lastAutoTable.finalY + 22
  }
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184)
    doc.text(`Page ${i} of ${pages} | Confidential - Amber Sourcing`, 32, H - 16)
  }
  doc.save(`${opts.filename}.pdf`)
}
