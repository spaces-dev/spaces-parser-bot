export function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  cookieString.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    if (trimmed.includes('\t')) {
      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        const name = parts[5];
        const value = parts[6];
        if (name && value) {
          cookies[name] = value;
        }
      }
    } else if (trimmed.includes('=')) {
      const [name, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    }
  });
  
  return cookies;
}

export function formatCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

