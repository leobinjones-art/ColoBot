export function handleAuthFailure(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

export function updateTokenFromHeader(headers: Record<string, string>): void {
  const newToken = headers['x-new-token']
  if (newToken) {
    localStorage.setItem('token', newToken)
  }
}

export function getToken(): string | null {
  return localStorage.getItem('token')
}

export function setToken(token: string): void {
  localStorage.setItem('token', token)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}
