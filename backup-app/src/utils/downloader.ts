import { fetchPage } from '@/utils/http';
import * as cheerio from 'cheerio';


export async function extractDownloadUrlFromFilePage(
  fileUrl: string,
  cookies: Record<string, string>
): Promise<string | null> {
  try {
    const html = await fetchPage(fileUrl, cookies);
    const $ = cheerio.load(html);

    let downloadLink: string | undefined;

    $('a').each((_, elem) => {
      const $elem = $(elem);
      const href = $elem.attr('href');
      const text = $elem.text().trim();
      const hasDownloadIcon = $elem.find('.ico_download2_blue, .ico_download, [class*="download"]').length > 0;
      const hasDownloadClass = $elem.hasClass('list-link-blue') || $elem.hasClass('c-blue');

      if (href && (text.includes('Скачать') || hasDownloadIcon || (hasDownloadClass && href.includes('/download/')))) {
        if (href.includes('/download/')) {
          downloadLink = href;
          return false;
        }
      }
    });

    if (!downloadLink) {
      const selectors = [
        'a.list-link-blue[href*="/download/"]',
        'a[href*="/files/download/"][target="_blank"]',
        'a[href*="/download/"][href*="/files/"]',
        'a[href*="/files/download/"]',
        'a[href*="/pictures/download/"]',
        'a[href*="/music/download/"]',
        'a[href*="/video/download/"]'
      ];

      for (const selector of selectors) {
        downloadLink = $(selector).first().attr('href');
        if (downloadLink) break;
      }
    }

    if (downloadLink) {
      const fullUrl = downloadLink.startsWith('http')
        ? downloadLink
        : `https://spaces.im${downloadLink}`;
      console.log(`Extracted download URL from file page: ${fullUrl}`);
      return fullUrl;
    }

    console.log('No download link found on file page');
    return null;
  } catch (error) {
    console.error('Error extracting download URL from file page:', error);
    return null;
  }
}

