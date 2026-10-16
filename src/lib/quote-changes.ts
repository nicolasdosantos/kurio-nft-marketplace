import type { CartItem, Quote, QuoteIssue } from '@/api/contracts/cart'

const stockIssues: QuoteIssue[] = ['OUT_OF_STOCK', 'QUANTITY_EXCEEDS_STOCK']

function stockIssueOf(issues: QuoteIssue[]) {
  return issues.find((issue) => stockIssues.includes(issue)) ?? null
}

// O que o usuário revisou: se algo disso mudar, ele precisa confirmar de novo.
export function sameQuote(reviewed: Quote, current: Quote) {
  return (
    reviewed.valid === current.valid &&
    reviewed.totalEth === current.totalEth &&
    reviewed.networkFeeEth === current.networkFeeEth &&
    reviewed.discountEth === current.discountEth &&
    reviewed.lines.length === current.lines.length &&
    reviewed.lines.every((line) => {
      const match = current.lines.find((item) => item.itemId === line.itemId)
      return (
        match !== undefined &&
        match.quantity === line.quantity &&
        match.unitPriceEth === line.unitPriceEth &&
        stockIssueOf(match.issues) === stockIssueOf(line.issues)
      )
    })
  )
}

// Frases curtas com cada mudança entre a cotação revisada e a atual, na ordem dos itens.
export function describeQuoteChanges(reviewed: Quote, current: Quote, items: CartItem[]) {
  const nameOf = (itemId: string) => items.find((item) => item.id === itemId)?.name ?? 'Um item'
  const changes: string[] = []

  for (const line of current.lines) {
    const name = nameOf(line.itemId)
    const before = reviewed.lines.find((item) => item.itemId === line.itemId)
    if (!before) {
      changes.push(`${name} entrou no pedido.`)
      continue
    }
    if (before.unitPriceEth !== line.unitPriceEth) {
      changes.push(
        `${name}: o preço mudou de ${before.unitPriceEth} para ${line.unitPriceEth} ETH.`,
      )
    }
    if (before.quantity !== line.quantity) {
      changes.push(`${name}: a quantidade mudou de ${before.quantity} para ${line.quantity}.`)
    }
    const stockIssue = stockIssueOf(line.issues)
    if (stockIssue !== stockIssueOf(before.issues)) {
      if (stockIssue === 'OUT_OF_STOCK') changes.push(`${name} esgotou.`)
      else if (stockIssue === 'QUANTITY_EXCEEDS_STOCK') {
        changes.push(`${name}: não há mais estoque para ${line.quantity}.`)
      } else changes.push(`${name} voltou a ter estoque.`)
    }
  }
  for (const line of reviewed.lines) {
    if (!current.lines.some((item) => item.itemId === line.itemId)) {
      changes.push(`${nameOf(line.itemId)} saiu do pedido.`)
    }
  }
  if (reviewed.discountEth !== current.discountEth) {
    changes.push(`O desconto mudou de ${reviewed.discountEth} para ${current.discountEth} ETH.`)
  }
  if (reviewed.networkFeeEth !== current.networkFeeEth) {
    changes.push(
      `A taxa de rede mudou de ${reviewed.networkFeeEth} para ${current.networkFeeEth} ETH.`,
    )
  }
  if (reviewed.totalEth !== current.totalEth) {
    changes.push(`O total mudou de ${reviewed.totalEth} para ${current.totalEth} ETH.`)
  }
  return changes
}
