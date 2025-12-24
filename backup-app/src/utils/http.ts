import axios from 'axios';
import { config } from '@/config';

export interface FetchResponse {
  html: string;
  cookies: Record<string, string>;
}

export async function fetchPage(
  url: string,
  cookies: Record<string, string>
): Promise<string> {
  const response = await axios.post(`${config.proxyUrl}/api/fetch`, {
    url,
    cookies,
  });
  return response.data.html || response.data;
}

export async function fetchPageWithCookies(
  url: string,
  cookies: Record<string, string>
): Promise<FetchResponse> {
  const response = await axios.post(`${config.proxyUrl}/api/fetch`, {
    url,
    cookies,
  }, {
    timeout: 180000,
  });
  return {
    html: response.data.html || response.data,
    cookies: response.data.cookies || {},
  };
}

export async function downloadFileBuffer(
  url: string,
  cookies: Record<string, string>,
  onProgress?: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
  const response = await axios.post(
    `${config.proxyUrl}/api/download`,
    { url, cookies },
    {
      responseType: 'arraybuffer',
      timeout: 300000,
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(progressEvent.loaded, progressEvent.total);
        }
      },
    }
  );
  return response.data;
}
