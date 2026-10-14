// Hash simples para não guardar senha em texto puro no localStorage.
// Num backend real seria bcrypt/argon2, aqui SHA-256 com salt basta.
export async function hashPassword(password: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createSalt() {
  return crypto.randomUUID()
}
