import { createCn } from 'cn/config'

// Os tamanhos de texto do Figma (--text-* em index.css) precisam ser declarados aqui.
// Sem isso o cn trata "text-body" como uma cor e, ao juntar com "text-ink", descarta
// um dos dois (o botão perdia a cor ou o tamanho da fonte).
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'heading',
            'body-lg',
            'body-md',
            'body',
            'body-sm',
            'caption',
            'caption-sm',
            'tiny',
            'tiny-sm',
          ],
        },
      ],
    },
  },
})
