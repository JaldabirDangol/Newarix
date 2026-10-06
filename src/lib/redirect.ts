/** Keep post-authentication navigation within the application origin. */
export function safeRedirectPath(value: string | undefined): string {
  if (
    !value?.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some(
      (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
    )
  )
    return '/'
  const base = 'https://redirect.invalid'
  try {
    return new URL(value, base).origin === base ? value : '/'
  } catch {
    return '/'
  }
}
