import { useRef, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { useRemoveAvatar, useUpdateAvatar } from '@/api/account'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 1024 * 1024

// Confere tipo e tamanho antes de ler o arquivo; o servidor valida de novo.
function validateAvatarFile(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Envie uma imagem PNG, JPEG ou WebP.'
  if (file.size > MAX_BYTES) return 'A imagem precisa ter até 1 MB.'
  return null
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const primaryButton =
  'flex h-10 items-center justify-center rounded-[3px] bg-primary px-6 text-body leading-4 font-bold text-ink hover:bg-text-accent disabled:opacity-60'
const textButton =
  'flex h-10 items-center px-2 text-body leading-4 text-foreground hover:text-text-accent disabled:opacity-60'

interface AvatarFieldProps {
  avatarUrl: string | null
  onStatus: (message: string) => void
}

export function AvatarField({ avatarUrl, onStatus }: AvatarFieldProps) {
  const updateAvatar = useUpdateAvatar()
  const removeAvatar = useRemoveAvatar()
  const fileInput = useRef<HTMLInputElement>(null)
  // Imagem escolhida e ainda não enviada: aparece no círculo até "Enviar" ou "Cancelar".
  const [preview, setPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState('')
  const busy = updateAvatar.isPending || removeAvatar.isPending
  const error =
    fileError ||
    (updateAvatar.isError
      ? (updateAvatar.error.fields.imageDataUrl ?? updateAvatar.error.message)
      : '') ||
    (removeAvatar.isError ? removeAvatar.error.message : '')
  const shown = preview ?? avatarUrl

  async function handleFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    updateAvatar.reset()
    onStatus('')
    const problem = validateAvatarFile(file)
    if (problem) {
      setPreview(null)
      setFileError(problem)
      return
    }
    setFileError('')
    setPreview(await readFileAsDataUrl(file))
    onStatus('Pré-visualização pronta. Envie para trocar o avatar.')
  }

  function upload() {
    if (!preview) return
    updateAvatar.mutate(preview, {
      onSuccess: () => {
        setPreview(null)
        onStatus('Avatar atualizado.')
      },
    })
  }

  function remove() {
    setFileError('')
    removeAvatar.mutate(undefined, { onSuccess: () => onStatus('Avatar removido.') })
  }

  return (
    <div className="flex flex-col">
      <p id="avatar-label" className="flex h-[29px] items-center text-body leading-[15px]">
        Avatar
      </p>
      <div className="flex flex-wrap items-center gap-6">
        <div
          className={cn(
            'grid size-[50px] shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-raised',
            preview && 'border-primary',
          )}
        >
          {shown ? (
            <img
              src={shown}
              alt={preview ? 'Pré-visualização do novo avatar' : 'Seu avatar'}
              width={50}
              height={50}
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon aria-hidden="true" className="size-6 text-primary" strokeWidth={1.5} />
          )}
        </div>

        <input
          ref={fileInput}
          id="avatar-file"
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          aria-labelledby="avatar-label"
          aria-describedby={error ? 'avatar-error avatar-hint' : 'avatar-hint'}
          aria-invalid={error ? true : undefined}
          onChange={(event) => handleFile(event.target.files?.[0])}
          className="sr-only"
          tabIndex={-1}
        />
        {preview ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={upload} disabled={busy} className={primaryButton}>
              {updateAvatar.isPending ? 'Enviando...' : 'Enviar'}
              <span className="sr-only"> novo avatar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                onStatus('Troca de avatar cancelada.')
              }}
              disabled={busy}
              className={textButton}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              aria-describedby={error ? 'avatar-error avatar-hint' : 'avatar-hint'}
              className={primaryButton}
            >
              Alterar
            </button>
            {avatarUrl && (
              <button type="button" onClick={remove} disabled={busy} className={textButton}>
                {removeAvatar.isPending ? 'Removendo...' : 'Remover'}
              </button>
            )}
          </div>
        )}
      </div>
      <span id="avatar-hint" className="mt-2 text-caption text-text-secondary">
        PNG, JPEG ou WebP, até 1 MB.
      </span>
      {error && (
        <span id="avatar-error" role="alert" className="mt-1 text-caption text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}
