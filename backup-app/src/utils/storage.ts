const COOKIES_KEY = 'spaces_backup_cookies';
const USER_KEY = 'spaces_backup_user';

export function saveCookies(cookies: string): void {
  localStorage.setItem(COOKIES_KEY, cookies);
}

export function loadCookies(): string | null {
  return localStorage.getItem(COOKIES_KEY);
}

export function clearCookies(): void {
  localStorage.removeItem(COOKIES_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveUser(user: { username: string; isCurrentUser: boolean; avatarUrl?: string }): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadUser(): { username: string; isCurrentUser: boolean; avatarUrl?: string } | null {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}

