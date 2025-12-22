export function extractCKFromUrl(url: string): string | null {
  const match = url.match(/[?&]CK=([^&]+)/);
  return match ? match[1] : null;
}

export function extractLinkIdFromUrl(url: string): string | null {
  const match = url.match(/[?&]Link_id=([^&]+)/);
  return match ? match[1] : null;
}

export function addCKToUrl(url: string, ck: string): string {
  if (url.includes('CK=')) {
    return url.replace(/CK=[^&]+/, `CK=${ck}`);
  }
  return url.includes('?') ? `${url}&CK=${ck}` : `${url}?CK=${ck}`;
}

