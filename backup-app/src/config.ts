export const config = {
  baseUrl: import.meta.env.VITE_SPACES_BASE_URL || 'https://spaces.im',
  proxyUrl: import.meta.env.VITE_PROXY_URL || 'http://localhost:3001',

  fileTypeCategories: {
    7: 'pictures',
    6: 'music',
    25: 'video',
    5: 'files',
  } as const,
} as const;

export function buildSpacesUrl(
  type: number,
  id: string,
  action: 'view' | 'download'
): string {
  const category = config.fileTypeCategories[type as keyof typeof config.fileTypeCategories] || 'files';
  return `${config.baseUrl}/${category}/${action}/${id}/`;
}