import type { ElementType } from 'react'
import { Link } from '@tanstack/react-router'
import { CircleX, LoaderCircle } from 'lucide-react'
import type { Order } from '@/api/contracts/orders'
import {
  formatReceiptDate,
  networkLabels,
  nftImageSources,
  shortHex,
  walletTypeLabels,
} from '@/lib/display'
import { cn } from '@/lib/utils'
import { ThankYouIcon } from './ThankYouIcon'

type Variant = 'desktop' | 'mobile'

const titles: Record<Order['status'], string> = {
  pending: 'Pagamento pendente',
  confirmed: 'Seus NFTs agora estão na sua carteira',
  declined: 'Pagamento recusado',
}

const failureMessages: Record<NonNullable<Order['failureReason']>, string> = {
  PAYMENT_DECLINED:
    'A carteira recusou o pagamento. Nada foi cobrado e seu carrinho continua igual.',
  OUT_OF_STOCK: 'Uma das edições esgotou antes da confirmação. Nada foi cobrado.',
}

const primaryButton =
  'flex h-12 items-center justify-center rounded-[5px] bg-primary px-4 text-body-md leading-4 font-bold text-ink hover:bg-text-accent'
const secondaryButton =
  'flex h-12 items-center justify-center rounded-[5px] border border-primary px-4 text-body-md leading-4 font-bold text-text-accent hover:bg-primary/10'

interface OrderReceiptProps {
  order: Order
  variant: Variant
  // No desktop o título é o DialogTitle do modal; no mobile, o h1 da página.
  titleAs: ElementType
}

// O recibo é o snapshot gravado na criação do pedido: nada aqui vem do catálogo atual.
export function OrderReceipt({ order, variant, titleAs: Title }: OrderReceiptProps) {
  const { receipt, status } = order
  const isDesktop = variant === 'desktop'
  const network = networkLabels[receipt.network]

  const meta = [
    {
      label: 'ID da transação',
      value: shortHex(`0x${receipt.transactionHash.slice(2).toUpperCase()}`),
      bold: true,
      testId: 'receipt-hash-short',
    },
    {
      label: 'Data',
      value: formatReceiptDate(receipt.confirmedAt ?? order.createdAt),
      testId: 'receipt-date',
    },
    { label: 'Total', value: `${receipt.totalEth} ETH` },
    { label: 'Carteira', value: walletTypeLabels[receipt.wallet.type], bold: true },
  ]

  return (
    <div className="rise-in flex flex-col text-text-secondary">
      <header className="flex flex-col items-center gap-4 px-6 pt-[22px] pb-[22px] text-center">
        <div className="grid size-20 place-items-center text-primary">
          {status === 'confirmed' && <ThankYouIcon />}
          {status === 'pending' && (
            <LoaderCircle aria-hidden="true" className="size-14 animate-spin" strokeWidth={1.5} />
          )}
          {status === 'declined' && (
            <CircleX aria-hidden="true" className="size-14 text-destructive" strokeWidth={1.5} />
          )}
        </div>
        <Title
          data-testid="order-status"
          className={cn(
            'text-body-md leading-6 font-bold',
            status === 'declined' ? 'text-destructive' : 'text-text-secondary',
          )}
        >
          {titles[status]}
        </Title>
        {status === 'pending' && (
          <p role="status" className="text-body-sm leading-[22px]">
            Aguardando a confirmação da rede. Esta tela atualiza sozinha.
          </p>
        )}
        {status === 'declined' && order.failureReason && (
          <p role="alert" className="text-body-sm leading-[22px] text-foreground">
            {failureMessages[order.failureReason]}
          </p>
        )}
      </header>

      <div className="h-px bg-primary" />
      <dl
        className={cn(
          isDesktop
            ? 'flex items-center justify-between px-9 py-[15px]'
            : 'grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4',
        )}
      >
        {meta.map((item, index) => (
          // O divisor do Figma é um pseudo-elemento: dentro do <dl> só cabem dt e dd.
          <div
            key={item.label}
            className={cn(
              'relative flex flex-col',
              isDesktop &&
                index > 0 &&
                'pl-[18px] before:absolute before:top-1/2 before:left-0 before:h-[31px] before:w-px before:-translate-y-1/2 before:bg-primary',
            )}
          >
            <dt className={cn('text-body-sm leading-4', item.bold && 'font-bold')}>{item.label}</dt>
            <dd data-testid={item.testId} className="text-body leading-5">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="h-px bg-primary" />

      <section
        aria-labelledby="receipt-details-title"
        className={cn('flex flex-col gap-3', isDesktop ? 'px-11 pt-5 pb-12' : 'px-4 pt-5 pb-8')}
      >
        <h2 id="receipt-details-title" className="text-body leading-4 font-bold text-foreground">
          Detalhes da transação
        </h2>
        {isDesktop ? (
          <table className="w-full text-foreground">
            <caption className="sr-only">Itens comprados</caption>
            <thead>
              <tr className="text-left text-body-md leading-4">
                <th scope="col" className="border-b border-primary/30 pb-3 font-bold">
                  NFTs
                </th>
                <th scope="col" className="w-[104px] border-b border-primary/30 pb-3 font-bold">
                  Quantidade
                </th>
                <th scope="col" className="border-b border-primary/30 pb-3 text-right font-medium">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody data-testid="receipt-items">
              {receipt.items.map((item) => (
                <tr key={`${item.nftId}-${item.editionId}`}>
                  <td className="px-0 pt-3 pb-0">
                    <ItemIdentity item={item} />
                  </td>
                  <td className="pt-3 text-body-sm leading-4 text-text-secondary">
                    (x {item.quantity})
                  </td>
                  <td className="pt-3 text-right text-body-lg leading-4 font-bold whitespace-nowrap text-text-accent">
                    {item.lineTotalEth} ETH
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // No mobile três colunas espremem os nomes: cada item vira uma linha da lista.
          <ul
            aria-label="Itens comprados"
            data-testid="receipt-items"
            className="flex flex-col gap-3 border-t border-primary/30 pt-3 text-foreground"
          >
            {receipt.items.map((item) => (
              <li key={`${item.nftId}-${item.editionId}`} className="flex flex-col gap-2">
                <ItemIdentity item={item} />
                <div className="flex items-center justify-end gap-3">
                  <span className="text-body-sm leading-4 text-text-secondary">
                    (x {item.quantity})
                  </span>
                  <span className="text-body-md leading-4 font-bold text-text-accent">
                    {item.lineTotalEth} ETH
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <dl
          className={cn(
            'flex flex-col gap-3 text-body leading-5 text-foreground [&_dd]:whitespace-nowrap',
            // No mobile os valores ficam em 16px para "Taxa de rede (Rede)" caber na linha.
            isDesktop
              ? 'ml-auto w-[340px] [&_dd]:text-body-lg [&_dt]:whitespace-nowrap'
              : '[&_dd]:text-body-md',
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <dt>Subtotal</dt>
            <dd className="leading-4">{receipt.subtotalEth} ETH</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>{receipt.couponCode ? `Desconto (${receipt.couponCode})` : 'Desconto'}</dt>
            <dd className="leading-4">(-) {receipt.discountEth} ETH</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>Taxa de rede ({network})</dt>
            <dd data-testid="receipt-fee" className="leading-4">
              {receipt.networkFeeEth} ETH
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-body-md leading-4 font-bold">Total</dt>
            <dd data-testid="receipt-total" className="leading-4 font-bold text-text-accent">
              {receipt.totalEth} ETH
            </dd>
          </div>
        </dl>
        <div className="h-px bg-primary/30" />

        <div className="flex flex-col items-center gap-5 text-center">
          {status === 'confirmed' && (
            <p className="text-body-sm leading-[22px]">
              Transação confirmada na {network}. A propriedade foi transferida para sua carteira
              conectada e registrada na rede.
            </p>
          )}
          {/* No lugar do "Ver no Etherscan": o hash é fictício e não existe em explorer nenhum. */}
          <p
            role="note"
            className="w-full rounded-[5px] border border-primary/40 bg-surface-dark px-4 py-3 text-caption leading-5 text-text-accent"
          >
            <strong>Transação simulada.</strong> Este hash não existe no Etherscan nem em outro
            explorer:{' '}
            <span data-testid="receipt-hash" className="break-all text-text-secondary">
              {receipt.transactionHash}
            </span>
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {status === 'declined' && (
              <Link to="/carrinho" className={secondaryButton}>
                Voltar ao carrinho
              </Link>
            )}
            <Link to="/" className={primaryButton}>
              Voltar ao catálogo
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function ItemIdentity({ item }: { item: Order['receipt']['items'][number] }) {
  const image = nftImageSources(item.imageUrl)
  return (
    <div className="flex items-center gap-3">
      <img
        src={image.src}
        alt=""
        width={70}
        height={70}
        className="size-14 shrink-0 rounded-[8px] object-cover md:size-[70px]"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-body-md leading-4 font-bold">{item.name}</span>
        <span className="text-body-sm leading-4 text-secondary">Edição {item.editionLabel}</span>
      </div>
    </div>
  )
}
