import * as cheerio from 'cheerio';
import type { File, Folder, UserSection } from '../types';

export function extractUsername(url: string, html: string): string {
  const urlMatch = url.match(/\/files\/user\/([^\/]+)\//);
  if (urlMatch) return urlMatch[1];
  
  const $ = cheerio.load(html);
  
  const userLink = $('a.horiz-menu__link').filter((_, el) => {
    return $(el).find('.horiz-menu__link-text_user').text().trim() === 'Вы';
  });
  
  if (userLink.length > 0) {
    const href = userLink.attr('href') || '';
    const match = href.match(/\/mysite\/index\/([^\/]+)/);
    if (match) return match[1];
  }
  
  const nickLink = $('a.mysite-link');
  if (nickLink.length > 0) {
    const nick = nickLink.find('.mysite-nick').text().trim();
    if (nick) return nick;
  }
  
  const playerParams = $('#player_params').attr('data-params');
  if (playerParams) {
    try {
      const params = JSON.parse(playerParams);
      if (params.user) return params.user;
    } catch {}
  }
  
  return '';
}

export function checkIsCurrentUser(html: string): boolean {
  const $ = cheerio.load(html);
  const userLink = $('.horiz-menu__link-text_user');
  return userLink.text().trim() === 'Вы';
}

export function extractAvatarUrl(html: string): string | undefined {
  const $ = cheerio.load(html);
  
  let avatarImg = $('.user__ava.user__ava_big img, .user__ava img').first();
  if (avatarImg.length === 0) {
    avatarImg = $('.change_avatar_link img').first();
  }
  if (avatarImg.length === 0) {
    avatarImg = $('.horiz-menu__link-ico_user img').first();
  }
  
  const avatarUrl = avatarImg.attr('src');
  
  if (avatarUrl) {
    const fullUrl = avatarUrl.startsWith('http') ? avatarUrl : `https:${avatarUrl}`;
    console.log('Found avatar URL:', fullUrl, 'from selector:', avatarImg.length > 0 ? 'user__ava' : 'horiz-menu');
    return fullUrl;
  }
  
  console.log('Avatar not found in HTML. Available selectors:', {
    userAva: $('.user__ava img').length,
    changeAvatarLink: $('.change_avatar_link img').length,
    horizMenu: $('.horiz-menu__link-ico_user img').length,
  });
  return undefined;
}

export function parseUserSections(html: string, username: string, baseUrl: string): UserSection[] {
  const $ = cheerio.load(html);
  const sections: UserSection[] = [];
  
  console.log('Parsing sections for username:', username);
  
  const sectionMap: Record<string, { name: string; folderName: string; icon: string; type: UserSection['type'] }> = {
    'pictures': { name: 'Фотографии', folderName: 'photos', icon: 'ico_colored_photo', type: 'pictures' },
    'music': { name: 'Музыка', folderName: 'music', icon: 'ico_colored_music', type: 'music' },
    'video': { name: 'Видео', folderName: 'videos', icon: 'ico_colored_video', type: 'video' },
    'files': { name: 'Файлы', folderName: 'files', icon: 'ico_colored_file', type: 'files' },
  };
  
  const foundSections = new Set<string>();
  
  $('a.list-link-darkblue').each((_, elem) => {
    const $elem = $(elem);
    const href = $elem.attr('href') || '';
    
    for (const [key, info] of Object.entries(sectionMap)) {
      if (href.includes(`/${key}/user/${username}/`) && !foundSections.has(key)) {
        let count = 0;
        
        const countElem = $elem.find('.cnt');
        if (countElem.length > 0) {
          const countText = countElem.text().trim();
          count = parseInt(countText) || 0;
          console.log(`Found count from .cnt: ${countText} -> ${count}`);
        } else {
          const fullText = $elem.text();
          const countMatch = fullText.match(/(\d+)/);
          if (countMatch) {
            count = parseInt(countMatch[1]) || 0;
            console.log(`Found count from text: ${fullText} -> ${count}`);
          }
        }
        
        console.log(`✓ Found section: ${key}`, { href, count, html: $elem.html() });
        foundSections.add(key);
        sections.push({
          id: key,
          name: info.name,
          folderName: info.folderName,
          url: href.startsWith('http') ? href : `${baseUrl}${href}`,
          icon: info.icon,
          count,
          type: info.type,
        });
        break;
      }
    }
  });
  
  if (sections.length === 0) {
    console.log('No sections found with list-link-darkblue, trying all links...');
    $('a').each((_, elem) => {
      const $elem = $(elem);
      const href = $elem.attr('href') || '';
      
      for (const [key, info] of Object.entries(sectionMap)) {
        if (href.includes(`/${key}/user/${username}/`) && !foundSections.has(key)) {
          let count = 0;
          
          const countElem = $elem.find('.cnt');
          if (countElem.length > 0) {
            const countText = countElem.text().trim();
            count = parseInt(countText) || 0;
          }
          
          console.log(`✓ Found section (fallback): ${key}`, { href, count });
          foundSections.add(key);
          sections.push({
            id: key,
            name: info.name,
            folderName: info.folderName,
            url: href.startsWith('http') ? href : `${baseUrl}${href}`,
            icon: info.icon,
            count,
            type: info.type,
          });
          break;
        }
      }
    });
  }
  
  console.log('Final sections:', sections);
  return sections;
}

export function parseFolders(html: string): Folder[] {
  const $ = cheerio.load(html);
  const folders: Folder[] = [];
  
  console.log('Parsing folders...');
  
  $('a.js-dir, a[data-nid][href*="/list/"]').each((_, elem) => {
    const $elem = $(elem);
    const href = $elem.attr('href');
    const id = $elem.attr('data-nid');
    
    const passwordIcon = $elem.find('.ico_files_dir_password');
    if (passwordIcon.length > 0) {
      console.log(`Skipping password-protected folder (id: ${id})`);
      return;
    }
    
    let name = $elem.find('.js-dir_name').text().trim();
    if (!name) {
      name = $elem.find('.list-link__name').text().trim();
    }
    if (!name) {
      name = $elem.find('b').first().text().trim();
    }
    
    const fileCountText = $elem.find('.grey').first().text().trim();
    const fileCountMatch = fileCountText.match(/(\d+)\s+файл/);
    const fileCount = fileCountMatch ? parseInt(fileCountMatch[1]) : undefined;
    
    console.log(`Folder candidate: href=${href}, id=${id}, name=${name}, fileCountText=${fileCountText}`);
    
    if (href && id && name) {
      const fullUrl = href.startsWith('http') ? href : `https://spaces.im${href}`;
      console.log(`Found folder: ${name} (id: ${id}, href: ${fullUrl}, files: ${fileCount || 0})`);
      folders.push({
        id,
        name,
        url: fullUrl,
        path: '',
        fileCount,
        files: [],
        folders: [],
      });
    } else {
      console.log(`Skipped folder element (href: ${href}, id: ${id}, name: ${name})`);
    }
  });
  
  console.log(`Parsed ${folders.length} folders`);
  return folders;
}

export function parseFiles(html: string): File[] {
  const $ = cheerio.load(html);
  const files: File[] = [];
  
  console.log('Parsing files...');
  console.log(`Found ${$('.js-file_item').length} .js-file_item elements`);
  console.log(`Found ${$('[data-nid][data-type]').length} [data-nid][data-type] elements`);
  console.log(`Found ${$('.tiled_item').length} .tiled_item elements`);
  
  
  $('.js-file_item, [data-nid][data-type], .list-item[data-nid], .tiled_item[data-nid]').each((_, elem) => {
    const $elem = $(elem);
    const id = $elem.attr('data-nid');
    const type = parseInt($elem.attr('data-type') || '0');
    
    if (!id) {
      return;
    }
    
    let name = '';
    let extension = '';
    
    const isTiledItem = $elem.hasClass('tiled_item');
    
    if (isTiledItem) {
      const nameElem = $elem.find('.tile_descr_2l.darkblue').first();
      if (nameElem.length > 0) {
        const fullName = nameElem.text().trim();
        const parts = fullName.match(/^(.+?)(\.[^.]+)$/);
        if (parts) {
          name = parts[1];
          extension = parts[2];
        } else {
          name = fullName;
          extension = '.jpg';
        }
      }
    } else {
      const nameElem = $elem.find('.darkblue.break-word').first();
      const extElem = $elem.find('.lightgrey.break-word').first();
      
      if (nameElem.length && extElem.length) {
        name = nameElem.text().trim();
        extension = extElem.text().trim();
      } else {
        const linkElem = $elem.find('a.arrow_link, a.strong_link').first();
        if (linkElem.length > 0) {
          const namePart = linkElem.find('b.darkblue').text().trim();
          const extPart = linkElem.find('b.lightgrey').text().trim();
          if (namePart && extPart) {
            name = namePart;
            extension = extPart;
          } else {
            const fullText = linkElem.text().trim();
            const parts = fullText.match(/^(.+?)(\.[^.]+)$/);
            if (parts) {
              name = parts[1];
              extension = parts[2];
            } else {
              name = fullText;
              extension = '';
            }
          }
        } else {
          const textContent = $elem.find('b.darkblue, b.break-word').first().text().trim();
          if (textContent) {
            const parts = textContent.match(/^(.+?)(\.[^.]+)$/);
            if (parts) {
              name = parts[1];
              extension = parts[2];
            } else {
              name = textContent;
            }
          }
        }
      }
    }
    
    let downloadLink = $elem.find('a.__adv_download').attr('href');
    if (!downloadLink) {
      downloadLink = $elem.find('a.list-link-blue[href*="/download/"]').attr('href');
    }
    if (!downloadLink) {
      downloadLink = $elem.find('a[href*="/files/download/"]').attr('href');
    }
    if (!downloadLink) {
      downloadLink = $elem.find('a[href*="/pictures/download/"]').attr('href');
    }
    if (!downloadLink) {
      downloadLink = $elem.find('a[href*="/music/download/"]').attr('href');
    }
    if (!downloadLink) {
      downloadLink = $elem.find('a[href*="/video/download/"]').attr('href');
    }
    
    const viewLink = $elem.find('a[href*="/files/view/"], a[href*="/pictures/view/"], a[href*="/music/view/"], a[href*="/video/view/"]').attr('href');
    const playerElem = $elem.find('.player_item');
    const directUrl = playerElem.attr('data-src');
    
    if (!name && isTiledItem) {
      const imgAlt = $elem.find('img').attr('alt') || $elem.find('img').attr('aria-label');
      if (imgAlt) {
        const parts = imgAlt.match(/^(.+?)(\.[^.]+)$/);
        if (parts) {
          name = parts[1];
          extension = parts[2];
        } else {
          name = imgAlt;
          extension = '.jpg';
        }
      }
    }
    
    if (id && name) {
      if (!downloadLink && viewLink) {
        downloadLink = viewLink.startsWith('http') ? viewLink : `https://spaces.im${viewLink}`;
        console.log(`File ${name}${extension} (id: ${id}, type: ${type}) has view link, will fetch download URL from page`);
      } else if (!downloadLink) {
        if (type === 7) {
          downloadLink = `https://spaces.im/pictures/view/${id}/`;
        } else if (type === 6) {
          downloadLink = `https://spaces.im/music/view/${id}/`;
        } else if (type === 5) {
          downloadLink = `https://spaces.im/files/view/${id}/`;
        } else {
          downloadLink = `https://spaces.im/files/view/${id}/`;
        }
        console.log(`Warning: File ${name}${extension} (id: ${id}, type: ${type}) has no download link, will fetch from page`);
      } else {
        downloadLink = downloadLink.startsWith('http') 
          ? downloadLink 
          : `https://spaces.im${downloadLink}`;
      }
      
      console.log(`Found file: ${name}${extension} (id: ${id}, type: ${type}, downloadLink: ${downloadLink})`);
      files.push({
        id,
        name,
        extension,
        type,
        downloadUrl: downloadLink,
        directUrl: directUrl 
          ? (directUrl.startsWith('http') ? directUrl : `https:${directUrl}`)
          : undefined,
        path: '',
      });
    } else {
      console.log(`Skipped file element (id: ${id}, name: ${name || 'empty'}, downloadLink: ${downloadLink || 'empty'})`);
    }
  });
  
  console.log(`Parsed ${files.length} files`);
  return files;
}

export function parsePagination(html: string): number | null {
  const $ = cheerio.load(html);
  
  const pgnDiv = $('div.pgn');
  const total = pgnDiv.attr('data-total');
  if (total) {
    const maxPages = parseInt(total);
    if (!isNaN(maxPages)) return maxPages;
  }
  
  const counterElem = $('div.pgn__counter.pgn__range');
  const counterText = counterElem.text().trim();
  if (counterText.includes('из')) {
    const parts = counterText.split('из');
    if (parts.length === 2) {
      const maxPages = parseInt(parts[1].trim());
      if (!isNaN(maxPages)) return maxPages;
    }
  }
  
  return null;
}

export function addPagination(url: string, page: number): string {
  if (page === 1) return url;
  
  if (url.includes('?')) {
    if (url.includes('P=')) {
      return url.replace(/[?&]P=\d+/, `&P=${page}`);
    }
    return `${url}&P=${page}`;
  }
  return `${url}?P=${page}`;
}
