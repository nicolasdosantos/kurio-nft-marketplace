import { useEffect, useRef } from 'react'

// Seção abaixo da dobra: começa invisível e entra (fade + leve subida) quando aparece na
// tela. O que já está visível no carregamento não anima, e com prefers-reduced-motion
// nada muda. O estado vai em data-reveal; a transição está no index.css.
export function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (element.getBoundingClientRect().top < window.innerHeight) return

    element.dataset.reveal = 'hidden'
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        element.dataset.reveal = 'shown'
        observer.disconnect()
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return ref
}
