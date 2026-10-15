// Cinco estrelas do Figma; as que passam da nota ficam apagadas.
export function StarRating({ average }: { average: number }) {
  const filled = Math.round(average)

  return (
    <span className="flex items-center gap-1">
      <span className="sr-only">Nota {average.toFixed(1).replace('.', ',')} de 5.</span>
      {Array.from({ length: 5 }, (_, index) => (
        <img
          key={index}
          src="/icons/star.svg"
          alt=""
          width={15}
          height={15}
          className={index < filled ? undefined : 'opacity-30'}
        />
      ))}
    </span>
  )
}
