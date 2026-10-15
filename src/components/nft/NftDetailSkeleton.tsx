import { Skeleton } from '@/components/ui/skeleton'

// Mesmas medidas da tela pronta, para nada pular quando os dados chegam.
export function NftDetailSkeleton({ isTabletUp }: { isTabletUp: boolean }) {
  if (!isTabletUp) {
    return (
      <div aria-hidden="true" data-testid="nft-detail-skeleton">
        <div className="px-7 pt-[23px] pb-[84px]">
          <div className="flex justify-between">
            <Skeleton className="size-[35px] rounded-full" />
            <Skeleton className="size-[35px] rounded-full" />
          </div>
          <Skeleton
            data-testid="skeleton-main-image"
            className="mt-2 aspect-[361/356] rounded-3xl"
          />
        </div>
        <div className="relative -mt-[114px] flex flex-col gap-3 rounded-t-[31px] bg-surface-card px-6 pt-8 pb-6">
          <Skeleton className="h-[27px] w-3/5" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[52px] w-3/5" />
          <Skeleton className="h-[84px] w-4/5" />
        </div>
      </div>
    )
  }

  return (
    <div aria-hidden="true" data-testid="nft-detail-skeleton" className="flex flex-col gap-3">
      <Skeleton className="h-4 w-36" />
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex w-full gap-7 lg:w-[572px] lg:shrink-0">
          <div className="flex shrink-0 flex-col gap-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="size-[100px] rounded-lg" />
            ))}
          </div>
          <Skeleton
            data-testid="skeleton-main-image"
            className="aspect-square w-full max-w-[444px] self-start rounded-md"
          />
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <Skeleton className="h-[81px]" />
          <Skeleton className="h-[94px]" />
          <Skeleton className="h-[56px] w-52" />
          <Skeleton className="h-[50px]" />
          <Skeleton className="h-[114px] w-80" />
        </div>
      </div>
    </div>
  )
}
