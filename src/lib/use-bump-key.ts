import { useState } from 'react'

// Muda só quando o valor sobe (item adicionado ao carrinho). Usado como `key` do contador,
// a troca remonta o elemento e a animação roda de novo; no primeiro render e quando o
// valor desce, nada acontece.
export function useBumpKey(value: number) {
  const [state, setState] = useState({ previous: value, bumps: 0 })
  if (value !== state.previous) {
    setState({ previous: value, bumps: value > state.previous ? state.bumps + 1 : state.bumps })
  }
  return state.bumps
}
