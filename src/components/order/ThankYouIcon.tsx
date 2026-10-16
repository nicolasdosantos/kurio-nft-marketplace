// Ícone "thank-you" redesenhado: o SVG original do Figma não pôde ser exportado.
// Decorativo: o título ao lado diz o mesmo.
export function ThankYouIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 65 80"
      width={65}
      height={80}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 39V7a2 2 0 0 1 2-2h14.5a9 5 0 0 1 18 0H56a2 2 0 0 1 2 2v32" />
      <path d="M7 27.5 2 32.5V76a2 2 0 0 0 2 2h57a2 2 0 0 0 2-2V32.5l-5-5" />
      <path d="M2.5 32.5 20.5 52.5M62.5 32.5 46.5 52.5" />
      <path d="M3 77 30 49a4 4 0 0 1 5.5 0L51.5 61.5M56.5 66l7 9.5" />
      <text
        x="32.5"
        y="24.5"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        THANK
      </text>
      <text
        x="32.5"
        y="38"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        YOU
      </text>
    </svg>
  )
}
