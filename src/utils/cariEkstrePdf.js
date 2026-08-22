import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDate } from './format'

function txLabel(tx) {
  if (tx.transaction_type === 'DEBT') return 'Borç'
  if (tx.description?.startsWith('İade onayı')) return 'İade'
  return 'Tahsilat'
}

function txSignedAmount(tx) {
  const amount = Number(tx.amount) || 0
  return tx.transaction_type === 'DEBT' ? amount : -amount
}

/**
 * Bayi cari hareketlerinden PDF ekstre üretir ve indirir.
 * @param {{ name: string, tax_no?: string, phone?: string }} dealer
 * @param {Array} transactions - kronolojik (eskiden yeniye) veya ters; içeride sıralanır
 */
export function downloadCariEkstrePdf(dealer, transactions) {
  const sorted = [...(transactions || [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )

  let running = 0
  const rows = sorted.map((tx) => {
    const signed = txSignedAmount(tx)
    running += signed
    return [
      formatDate(tx.created_at),
      txLabel(tx),
      tx.description || '—',
      formatCurrency(Math.abs(Number(tx.amount))),
      signed > 0 ? `+${formatCurrency(signed)}` : formatCurrency(signed),
      formatCurrency(running),
    ]
  })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(88, 15, 28)
  doc.text('MEHMEDOGLU CIGKOFTE - CARI HESAP EKSTRESI', pageWidth / 2, 18, {
    align: 'center',
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Bayi: ${dealer?.name || '-'}`, 14, 30)
  if (dealer?.tax_no) doc.text(`VKN: ${dealer.tax_no}`, 14, 36)
  if (dealer?.phone) doc.text(`Tel: ${dealer.phone}`, 14, dealer?.tax_no ? 42 : 36)

  const metaY = dealer?.tax_no && dealer?.phone ? 48 : dealer?.tax_no || dealer?.phone ? 42 : 36
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(`Olusturma: ${formatDate(new Date().toISOString())}`, 14, metaY)
  doc.text(`Bakiye: ${formatCurrency(running)}`, pageWidth - 14, metaY, { align: 'right' })

  autoTable(doc, {
    startY: metaY + 6,
    head: [['Tarih', 'Tur', 'Aciklama', 'Tutar', 'Etki', 'Bakiye']],
    body: rows.length
      ? rows
      : [['-', '-', 'Hareket yok', '-', '-', formatCurrency(0)]],
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [88, 15, 28],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  const safeName = (dealer?.name || 'bayi')
    .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
  doc.save(`Cari_Ekstre_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
