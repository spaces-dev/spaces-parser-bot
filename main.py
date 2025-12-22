import asyncio
import logging
import random
import os
import json
from aiogram import Bot, Dispatcher
from aiogram.types import InlineQuery, InlineQueryResultAudio, InlineQueryResultPhoto, InlineQueryResultArticle, InputTextMessageContent, ChosenInlineResult, InlineKeyboardMarkup, InlineKeyboardButton, InputMediaPhoto, InputMediaVideo, InputMediaAudio, FSInputFile, BufferedInputFile
import httpx
from selectolax.parser import HTMLParser


BOT_TOKEN = ""

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

SPACES_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
}

SPACES_COOKIES = {
   
}

CATEGORIES_BASE_URL = "https://spaces.im/sz/muzyka/"
SEARCH_BASE_URL = "https://spaces.im/music-online/search/index/"
FILES_SEARCH_BASE_URL = "https://spaces.im/search/"
FILES_SEARCH_RESULTS_URL = "https://spaces.im/files/search/"
COOKIES_TXT_FILE = "spaces_cookies.txt"
CATEGORIES_JSON_FILE = "categories.json"
DEVICE_TYPE_URL = "https://spaces.im/device_type/?CK=&Link_id=1156552&dtype=touch_light&sid="
TM_INIT_URL = "https://spaces.im/tm/"

track_info_cache = {}
picture_info_cache = {}
video_info_cache = {}
search_cache = {}
picture_search_cache = {}
music_files_search_cache = {}
video_files_search_cache = {}
cookies_loaded = False
categories_cache = None
tracks_cache = {}


def format_cookies_header(cookies_dict):
    """Форматирует словарь куки в строку для заголовка Cookie"""
    return "; ".join([f"{name}={value}" for name, value in cookies_dict.items()])


def get_request_headers():
    """Возвращает headers с куками для запросов"""
    headers = SPACES_HEADERS.copy()
    headers['Cookie'] = format_cookies_header(SPACES_COOKIES)
    return headers


def load_cookies_from_txt():
    """Загружает куки из TXT файла в формате Netscape Cookie File"""
    if not os.path.exists(COOKIES_TXT_FILE):
        return None
    
    try:
        cookies_dict = {}
        with open(COOKIES_TXT_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Пропускаем комментарии и пустые строки
                if not line or line.startswith('#'):
                    continue
                
                # Парсим формат: domain, flag, path, secure, expiration, name, value
                parts = line.split('\t')
                if len(parts) >= 7:
                    name = parts[5]
                    value = parts[6]
                    cookies_dict[name] = value
        
        if cookies_dict:
            logger.info(f"Куки загружены из {COOKIES_TXT_FILE}: {len(cookies_dict)} шт")
            return cookies_dict
        return None
    except Exception as e:
        logger.warning(f"Ошибка загрузки куки из TXT файла: {e}")
        return None


def save_cookies_to_txt(cookies_dict):
    """Сохраняет куки в TXT файл в формате Netscape Cookie File"""
    try:
        with open(COOKIES_TXT_FILE, 'w', encoding='utf-8') as f:
            f.write("# Netscape HTTP Cookie File\n")
            f.write("# This is a generated file! Do not edit.\n\n")
            for name, value in cookies_dict.items():
                # Формат: domain, flag, path, secure, expiration, name, value
                f.write(f"spaces.im\tTRUE\t/\tFALSE\t0\t{name}\t{value}\n")
        logger.info(f"Куки сохранены в {COOKIES_TXT_FILE}: {len(cookies_dict)} шт")
    except Exception as e:
        logger.error(f"Ошибка сохранения куки в TXT: {e}")


async def load_and_save_cookies():
    """Загружает куки из JSON или делает запрос для получения новых"""
    global SPACES_COOKIES, cookies_loaded
    
    # Предустановленные куки из браузера
    default_cookies = {
        '_ga': 'GA1.1.115955931.1755168247',
        '_ga_P2XYXHQT4M': 'GS2.1.s1762119834$o51$g1$t1762129885$j33$l0$h0',
        '_ym_d': '',
        '_ym_isad': '2',
        '_ym_uid': '',
        'dpr': '1',
        'Htzct': '1',
        'last_event': '474',
        'pageLoadTime': '',
        'sid': '',
        'spacesactive': 'true',
        'theme': 'dark',
        'user_id': '',
        'ymab': '%7B%7D',
        '_ymab_param': 't'
    }
    
    # Обновляем куки предустановленными
    SPACES_COOKIES.update(default_cookies)
    
    # Загружаем куки из TXT файла
    loaded_cookies = load_cookies_from_txt()
    if loaded_cookies:
        SPACES_COOKIES.update(loaded_cookies)
        cookies_loaded = True
        return
    
    # Используем предустановленные куки, если файл не найден
    logger.info(f"Использованы предустановленные куки: {list(default_cookies.keys())}")
    cookies_loaded = True
    
    try:
        logger.info("Получение куки через tm URL при первом запуске...")
        async with httpx.AsyncClient(cookies=SPACES_COOKIES, follow_redirects=True) as client:
            # Сначала заходим на tm URL для получения куки (без Cookie заголовка, чтобы сервер установил свои)
            response = await client.get(TM_INIT_URL, headers=SPACES_HEADERS, timeout=30.0)
            response.raise_for_status()
            
            # Получаем все куки из сессии
            cookies_from_response = {}
            for cookie in client.cookies.jar:
                cookies_from_response[cookie.name] = cookie.value
            
            if cookies_from_response:
                SPACES_COOKIES.update(cookies_from_response)
                logger.info(f"Получено куки из tm URL: {list(cookies_from_response.keys())}")
            
            # Дополнительно запрашиваем через device_type для обновления
            try:
                logger.info("Запрос куки через device_type...")
                response = await client.get(DEVICE_TYPE_URL, headers=get_request_headers(), timeout=30.0)
                response.raise_for_status()
                
                # Обновляем куки из device_type
                device_cookies = {}
                for cookie in client.cookies.jar:
                    device_cookies[cookie.name] = cookie.value
                
                if device_cookies:
                    SPACES_COOKIES.update(device_cookies)
                    cookies_from_response.update(device_cookies)
                    logger.info(f"Дополнительно получено куки из device_type: {list(device_cookies.keys())}")
            except Exception as device_error:
                logger.warning(f"Ошибка получения куки через device_type: {device_error}")
            
            # Сохраняем все полученные куки в файлы
            if cookies_from_response:
                save_cookies_to_txt(cookies_from_response)
                cookies_loaded = True
            else:
                logger.warning("Не получено новых куки из ответов")
                # Сохраняем хотя бы предустановленные куки
                save_cookies_to_txt(SPACES_COOKIES)
    except Exception as e:
        logger.error(f"Ошибка получения куки: {e}", exc_info=True)
        # Сохраняем хотя бы предустановленные куки
        try:
            save_cookies_to_txt(SPACES_COOKIES)
        except:
            pass


def parse_categories_from_html(html_text):
    """Парсит список категорий из HTML"""
    tree = HTMLParser(html_text)
    categories = []
    
    links = tree.css('a.list-link.list-link-darkblue, a.list-link-darkblue')
    
    if not links:
        links = tree.css('a.list-link, a[class*="darkblue"]')
    
    for link in links:
        try:
            href = link.attributes.get('href', '')
            
            if '/muzyka/' in href and '?Link_id=' in href:
                category_name = None
                
                js_text_span = link.css_first('span.t.js-text, span.js-text.t')
                if js_text_span:
                    category_name = js_text_span.text(strip=True)
                
                if not category_name:
                    all_spans = link.css('span.t')
                    for span in all_spans:
                        text = span.text(strip=True)
                        if text and 'тыс' not in text and len(text) > 2:
                            category_name = text
                            break
                
                if not category_name:
                    link_text = link.text(strip=True)
                    if link_text and 'тыс' not in link_text and len(link_text) > 2:
                        category_name = link_text.split('(')[0].strip()
                
                if category_name:
                    category_url = href if href.startswith('http') else f"https://spaces.im{href}"
                    categories.append({
                        'name': category_name,
                        'url': category_url
                    })
                    logger.debug(f"Добавлена категория: {category_name} -> {category_url}")
        except Exception as e:
            logger.error(f"Ошибка парсинга категории: {e}")
            continue
    
    logger.debug(f"Всего найдено категорий: {len(categories)}")
    return categories


def load_categories_from_json():
    """Загружает категории из JSON файла"""
    global categories_cache
    
    if os.path.exists(CATEGORIES_JSON_FILE):
        try:
            with open(CATEGORIES_JSON_FILE, 'r', encoding='utf-8') as f:
                categories = json.load(f)
                categories_cache = categories
                logger.info(f"Категории загружены из {CATEGORIES_JSON_FILE}: {len(categories)} шт")
                return categories
        except Exception as e:
            logger.warning(f"Ошибка загрузки категорий из файла: {e}")
    
    return None


def save_categories_to_json(categories):
    """Сохраняет категории в JSON файл"""
    try:
        with open(CATEGORIES_JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(categories, f, indent=2, ensure_ascii=False)
        logger.info(f"Категории сохранены в {CATEGORIES_JSON_FILE}: {len(categories)} шт")
    except Exception as e:
        logger.error(f"Ошибка сохранения категорий: {e}")


async def get_categories():
    """Получает список категорий"""
    global categories_cache
    
    if categories_cache:
        return categories_cache
    
    loaded = load_categories_from_json()
    if loaded:
        return loaded
    
    try:
        async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0) as client:
            response = await client.get(CATEGORIES_BASE_URL, headers=get_request_headers())
            response.raise_for_status()
            
            html_text = response.text
            
            if len(html_text) < 1000:
                logger.error(f"HTML слишком короткий: {len(html_text)} символов")
                return []
            
            categories = parse_categories_from_html(html_text)
            categories_cache = categories
            save_categories_to_json(categories)
            logger.info(f"Найдено категорий: {len(categories)}")
            return categories
    except Exception as e:
        logger.error(f"Ошибка получения категорий: {e}", exc_info=True)
        return []


def parse_photo_info_from_view_page(html_text):
    """Парсит описание и информацию об авторе со страницы просмотра фото"""
    tree = HTMLParser(html_text)
    
    description = None
    author_name = None
    author_date = None
    
    # Парсим описание из <div itemprop="description"> <div class="pad_t_a break-word">
    desc_div = tree.css_first('div[itemprop="description"]')
    if desc_div:
        desc_inner = desc_div.css_first('div.pad_t_a.break-word')
        if desc_inner:
            description = desc_inner.text(strip=True)
        else:
            # Пробуем другой вариант
            desc_inner = desc_div.css_first('div.break-word.pad_t_a')
            if desc_inner:
                description = desc_inner.text(strip=True)
            else:
                # Берем весь текст из div[itemprop="description"]
                description = desc_div.text(strip=True)
    
    # Парсим информацию об авторе из <div class="content-item3 wbg break-word">
    author_div = tree.css_first('div.content-item3.wbg.break-word')
    if author_div:
        # Ищем блок с "Добавлен:"
        added_div = author_div.css_first('div.grey')
        if added_div:
            added_text = added_div.text(strip=True)
            # Ищем имя пользователя в <b class="mysite-nick">
            nick_elem = added_div.css_first('b.mysite-nick')
            if nick_elem:
                nick_span = nick_elem.css_first('span.mysite-nick')
                if nick_span:
                    author_name = nick_span.text(strip=True)
                else:
                    author_name = nick_elem.text(strip=True)
            
            # Ищем дату в скобках
            import re
            date_match = re.search(r'\((\d+\s+\w+\s+\d+)\)', added_text)
            if date_match:
                author_date = date_match.group(1)
    
    return {
        'description': description,
        'author_name': author_name,
        'author_date': author_date
    }


def parse_video_info_from_view_page(html_text):
    """Парсит описание и информацию об авторе со страницы просмотра видео"""
    tree = HTMLParser(html_text)
    
    description = None
    author_name = None
    author_date = None
    
    # Парсим описание из <div itemprop="description"> <div class="pad_t_a break-word">
    desc_div = tree.css_first('div[itemprop="description"]')
    if desc_div:
        desc_inner = desc_div.css_first('div.pad_t_a.break-word')
        if desc_inner:
            description = desc_inner.text(strip=True)
        else:
            desc_inner = desc_div.css_first('div.break-word.pad_t_a')
            if desc_inner:
                description = desc_inner.text(strip=True)
            else:
                description = desc_div.text(strip=True)
    
    # Парсим информацию об авторе из <div class="content-item3 wbg break-word">
    author_div = tree.css_first('div.content-item3.wbg.break-word')
    if author_div:
        added_div = author_div.css_first('div.grey')
        if added_div:
            added_text = added_div.text(strip=True)
            nick_elem = added_div.css_first('b.mysite-nick')
            if nick_elem:
                nick_span = nick_elem.css_first('span.mysite-nick')
                if nick_span:
                    author_name = nick_span.text(strip=True)
                else:
                    author_name = nick_elem.text(strip=True)
            
            import re
            # Поддерживаем форматы: "(19 авг в 06:29)" и "(30 янв 2010)"
            # Сначала пробуем формат с временем
            date_match = re.search(r'\((\d+\s+\w+\s+в\s+\d+:\d+)\)', added_text)
            if date_match:
                # Убираем "в" и время, оставляем только дату
                date_text = date_match.group(1)
                author_date = re.sub(r'\s+в\s+\d+:\d+', '', date_text).strip()
            else:
                # Пробуем формат с годом
                date_match = re.search(r'\((\d+\s+\w+\s+\d{4})\)', added_text)
                if date_match:
                    author_date = date_match.group(1)
                else:
                    # Универсальный паттерн - любая дата в скобках
                    date_match = re.search(r'\(([^)]+)\)', added_text)
                    if date_match:
                        date_text = date_match.group(1)
                        # Убираем "в" и время, если есть
                        author_date = re.sub(r'\s+в\s+\d+:\d+', '', date_text).strip()
    
    return {
        'description': description,
        'author_name': author_name,
        'author_date': author_date
    }


def parse_pagination_info(html_text):
    """Парсит информацию о пагинации из HTML"""
    tree = HTMLParser(html_text)
    
    # Сначала пробуем получить из data-total атрибута (самый надежный способ)
    pgn_div = tree.css_first('div.pgn')
    if pgn_div:
        total = pgn_div.attributes.get('data-total')
        if total:
            try:
                max_pages = int(total)
                logger.debug(f"Найдено страниц через data-total: {max_pages}")
                return max_pages
            except ValueError:
                pass
    
    # Если data-total не нашли, пробуем из текста счетчика
    counter_elem = tree.css_first('div.pgn__counter.pgn__range')
    if counter_elem:
        counter_text = counter_elem.text(strip=True)
        if 'из' in counter_text:
            try:
                parts = counter_text.split('из')
                if len(parts) == 2:
                    max_pages = int(parts[1].strip())
                    logger.debug(f"Найдено страниц через счетчик: {max_pages}")
                    return max_pages
            except (ValueError, IndexError):
                pass
    
    logger.warning("Не удалось определить количество страниц из HTML")
    return None


def parse_search_link_id(html_text):
    """Парсит Link_id из страницы поиска"""
    tree = HTMLParser(html_text)
    
    # Пробуем разные селекторы
    all_link = tree.css_first('a.b-title__all')
    if not all_link:
        all_link = tree.css_first('a.list-link-blue')
    if not all_link:
        # Ищем любую ссылку с классом list-link-blue (может быть с другими классами)
        all_links = tree.css('a[class*="list-link-blue"]')
        if all_links:
            all_link = all_links[0]
    if not all_link:
        # Ищем любую ссылку на music-online/search с Link_id
        all_links = tree.css('a[href*="music-online/search"]')
        for link in all_links:
            href = link.attributes.get('href', '')
            if 'Link_id=' in href:
                all_link = link
                break
    
    if all_link:
        href = all_link.attributes.get('href', '')
        # Декодируем HTML entities (&amp; -> &)
        import html
        href = html.unescape(href)
        
        if 'Link_id=' in href:
            try:
                parts = href.split('Link_id=')
                if len(parts) == 2:
                    link_id = parts[1].split('&')[0].split('?')[0]
                    return link_id
            except (ValueError, IndexError):
                pass
    
    # Fallback: ищем Link_id напрямую в HTML через regex
    import re
    link_id_match = re.search(r'Link_id=(\d+)', html_text)
    if link_id_match:
        return link_id_match.group(1)
    
    return None


def parse_files_search_link(html_text):
    """Парсит ссылку на фото из результатов поиска (из списка категорий)"""
    tree = HTMLParser(html_text)
    
    # Ищем ссылки в блоке с категориями (класс list-link)
    photo_links = tree.css('a.list-link')
    for link in photo_links:
        link_text = link.text(strip=True)
        href = link.attributes.get('href', '')
        
        # Ищем ссылку "Фото и картинки" с Slist=1690
        if ('Фото' in link_text or 'картинки' in link_text.lower() or 'Фото и картинки' in link_text) and 'Slist=1690' in href:
            href = href.replace('&amp;', '&')
            return href if href.startswith('http') else f"https://spaces.im{href}"
    
    # Fallback: ищем любую ссылку с Slist=1690
    all_links = tree.css('a[href*="Slist=1690"]')
    for link in all_links:
        href = link.attributes.get('href', '')
        if 'files/search' in href and 'Link_id=' in href:
            href = href.replace('&amp;', '&')
            return href if href.startswith('http') else f"https://spaces.im{href}"
    
    return None


def parse_music_search_link(html_text):
    """Парсит ссылку на музыку из результатов поиска (из списка категорий)"""
    tree = HTMLParser(html_text)
    
    # Ищем ссылки в блоке с категориями (класс list-link)
    music_links = tree.css('a.list-link')
    for link in music_links:
        link_text = link.text(strip=True)
        href = link.attributes.get('href', '')
        
        # Ищем ссылку "Музыка" с Slist=61
        if ('Музыка' in link_text or 'музыка' in link_text.lower()) and 'Slist=61' in href:
            href = href.replace('&amp;', '&')
            return href if href.startswith('http') else f"https://spaces.im{href}"
    
    # Fallback: ищем любую ссылку с Slist=61
    all_links = tree.css('a[href*="Slist=61"]')
    for link in all_links:
        href = link.attributes.get('href', '')
        if 'files/search' in href and 'Link_id=' in href:
            href = href.replace('&amp;', '&')
            return href if href.startswith('http') else f"https://spaces.im{href}"
    
    return None


def parse_video_search_link(html_text):
    """Парсит ссылку на видео из результатов поиска (из списка категорий)"""
    tree = HTMLParser(html_text)
    
    # Ищем ссылки в блоке с категориями (класс list-link)
    video_links = tree.css('a.list-link')
    for link in video_links:
        link_text = link.text(strip=True)
        href = link.attributes.get('href', '')
        
        # Ищем ссылку "Видео" с Slist=4
        if ('Видео' in link_text or 'видео' in link_text.lower()) and 'Slist=4' in href:
            href = href.replace('&amp;', '&')
            return href if href.startswith('http') else f"https://spaces.im{href}"
    
    # Fallback: ищем любую ссылку с Slist=4
    all_links = tree.css('a[href*="Slist=4"]')
    for link in all_links:
        href = link.attributes.get('href', '')
        if 'files/search' in href and 'Link_id=' in href:
            href = href.replace('&amp;', '&')
            return href if href.startswith('http') else f"https://spaces.im{href}"
    
    return None


def parse_size_to_mb(size_text):
    """Преобразует размер из текста (Kб, Мб) в МБ"""
    if not size_text:
        return None
    
    import re
    # Ищем число и единицу измерения
    match = re.search(r'([\d.]+)\s*(Кб|Мб|Kб|Mб|KB|MB)', size_text)
    if match:
        value = float(match.group(1))
        unit = match.group(2).lower()
        
        if 'кб' in unit or 'kb' in unit:
            return value / 1024  # Конвертируем в МБ
        elif 'мб' in unit or 'mb' in unit:
            return value
    
    return None


def parse_videos_from_search(html_text):
    """Парсит список видео из результатов поиска (виджет)"""
    tree = HTMLParser(html_text)
    videos = []
    
    # Ищем видео в виджете widgets-group с data-type="25"
    items = tree.css('div.list-item.content-item3.wbg.content-bl__sep.js-file_item.oh[data-type="25"]')
    
    if not items:
        # Пробуем другие варианты селекторов
        items = tree.css('div[data-type="25"]')
    
    for i, item in enumerate(items):
        try:
            video_name = None
            view_url = None
            preview_url = None
            size_mb = None
            
            # Получаем название видео из <b class="darkblue break-word">
            title_elem = item.css_first('b.darkblue.break-word')
            if title_elem:
                video_name = title_elem.text(strip=True)
            
            # Получаем ссылку на страницу просмотра
            view_link = item.css_first('a.arrow_link.strong_link')
            if not view_link:
                view_link = item.css_first('a.arrow_link')
            
            if view_link:
                view_href = view_link.attributes.get('href', '')
                if view_href:
                    view_url = view_href.replace('&amp;', '&')
                    if not view_url.startswith('http'):
                        view_url = f"https://spaces.im{view_url}" if view_url.startswith('/') else f"https://spaces.im/{view_url}"
            
            # Получаем preview изображение (последнее значение из srcset)
            img_elem = item.css_first('img.preview')
            if img_elem:
                srcset = img_elem.attributes.get('srcset', '')
                if srcset:
                    import re
                    # Берем последнее значение из srcset (самое большое)
                    all_urls = re.findall(r'(https?://[^\s,]+)', srcset)
                    if all_urls:
                        preview_url = all_urls[-1]
                else:
                    preview_url = img_elem.attributes.get('src', '')
                
                if preview_url and not preview_url.startswith('http'):
                    preview_url = f"https://spaces.im{preview_url}" if preview_url.startswith('/') else f"https://spaces.im/{preview_url}"
            
            # Получаем размер файла
            size_elem = item.css_first('span.right.t-padd_left')
            if size_elem:
                size_text = size_elem.text(strip=True)
                size_mb = parse_size_to_mb(size_text)
            
            # Фильтруем только видео до 50 МБ
            if size_mb and size_mb > 50:
                logger.debug(f"Элемент {i}: Видео пропущено - размер {size_mb} МБ превышает 50 МБ")
                continue
            
            if video_name and view_url:
                videos.append({
                    'name': video_name,
                    'view_url': view_url,
                    'preview_url': preview_url,
                    'size_mb': size_mb
                })
                logger.debug(f"Элемент {i}: Найдено видео '{video_name}', размер: {size_mb} МБ" if size_mb else f"Элемент {i}: Найдено видео '{video_name}'")
            else:
                logger.debug(f"Элемент {i}: Пропущено - name={bool(video_name)}, view_url={bool(view_url)}")
        except Exception as e:
            logger.error(f"Элемент {i}: Ошибка парсинга видео: {e}", exc_info=True)
            continue
    
    logger.debug(f"Всего найдено видео в поиске: {len(videos)}")
    return videos


def parse_music_tracks_from_search(html_text):
    """Парсит список треков из результатов поиска музыки (виджет)"""
    tree = HTMLParser(html_text)
    tracks = []
    
    # Используем те же селекторы, что и в parse_tracks_from_html для надежности
    items = tree.css('div.list-item.content-item3.wbg.content-bl__sep.js-file_item.oh.__adv_list_track')
    
    if not items:
        items = tree.css('div.list-item.__adv_list_track, div.__adv_list_track, div.light_border_bottom.t-bg3.__adv_list_track')
    
    if not items:
        items = tree.css('div.list-item, div[data-type="6"]')
    
    for i, item in enumerate(items):
        try:
            track_name = None
            download_link = None
            
            # Используем ту же логику извлечения названия, что и в parse_tracks_from_html
            if item.css_first('div.light_border_bottom'):
                artist_elem = item.css_first('div.oh.t-padd_left > div.oh')
                if artist_elem:
                    artist_text = artist_elem.text(strip=True)
                    if ':' in artist_text:
                        parts = artist_text.split(':', 1)
                        artist = parts[0].strip()
                        title_link = item.css_first('a.arrow_link')
                        if title_link:
                            span = title_link.css_first('span')
                            if span:
                                title = span.text(strip=True)
                                track_name = f"{artist}: {title}"
                        else:
                            track_name = artist_text.strip()
                    else:
                        title_link = item.css_first('a.arrow_link')
                        if title_link:
                            span = title_link.css_first('span')
                            if span:
                                track_name = span.text(strip=True)
            
            # Если название не найдено, ищем через другие селекторы
            if not track_name:
                title_elem = item.css_first('b.darkblue.break-word')
                if not title_elem:
                    title_elem = item.css_first('b.break-word.darkblue')
                if not title_elem:
                    title_elem = item.css_first('b.darkblue')
                if title_elem:
                    track_name = title_elem.text(strip=True)
            
            # Используем ту же логику поиска URL, что и в parse_tracks_from_html
            # Сначала пробуем через player_item (data-src) - более надежный способ
            player_div = item.css_first('div.player_item')
            if player_div:
                data_src = player_div.attributes.get('data-src', '')
                if data_src:
                    download_link = data_src if data_src.startswith('http') else f"https://spaces.im{data_src}"
            
            # Если не нашли через data-src, пробуем через __adv_download
            if not download_link:
                download_a = item.css_first('a.__adv_download')
                if download_a:
                    download_link = download_a.attributes.get('href', '')
                    if download_link:
                        download_link = download_link.replace('&amp;', '&')
                        if not download_link.startswith('http'):
                            download_link = f"https://spaces.im{download_link}"
            
            if track_name and download_link:
                tracks.append({
                    'name': track_name,
                    'url': download_link
                })
                logger.debug(f"Элемент {i}: Найден трек '{track_name}'")
            else:
                logger.debug(f"Элемент {i}: Пропущен - title={bool(track_name)}, url={bool(download_link)}")
        except Exception as e:
            logger.error(f"Элемент {i}: Ошибка парсинга трека: {e}", exc_info=True)
            continue
    
    logger.debug(f"Всего найдено треков в поиске: {len(tracks)}")
    return tracks


def parse_pictures_from_html(html_text):
    """Парсит список картинок из страницы результатов поиска"""
    tree = HTMLParser(html_text)
    pictures = []
    
    items = tree.css('div.list-item.content-item3')
    logger.debug(f"Найдено элементов div.list-item.content-item3: {len(items)}")
    
    for i, item in enumerate(items):
        try:
            img_elem = item.css_first('img.preview')
            if not img_elem:
                logger.debug(f"Элемент {i}: не найден img.preview")
                continue
            
            img_src = img_elem.attributes.get('src', '')
            if not img_src:
                logger.debug(f"Элемент {i}: пустой src")
                continue
            
            # Пробуем получить URL из атрибута g у ссылки gview_link (самый надежный способ)
            gview_link = item.css_first('a.gview_link')
            thumb_url = None
            photo_url = None
            
            if gview_link:
                g_attr = gview_link.attributes.get('g', '')
                if g_attr:
                    import re
                    # В атрибуте g URL разделены символом |, формат:
                    # ...|thumb_url|photo_url|...
                    # Ищем все URL изображений
                    urls = re.findall(r'https?://[^\|]+\.(?:p|f)\.\d+\.\d+\.[^\|]+', g_attr)
                    if len(urls) >= 2:
                        # Первый URL - миниатюра (600x600), второй - большое изображение (800x800)
                        thumb_url = urls[0]
                        photo_url = urls[1]
                        logger.debug(f"Элемент {i}: найдены URL из атрибута g: thumb={thumb_url[:60]}..., photo={photo_url[:60]}...")
                    elif len(urls) == 1:
                        thumb_url = urls[0]
                        photo_url = urls[0]
            
            # Если не нашли в gview_link, пробуем srcset
            srcset = img_elem.attributes.get('srcset', '')
            if srcset:
                import re
                # Извлекаем все URL из srcset
                all_urls = re.findall(r'(https?://[^\s,]+)', srcset)
                if all_urls:
                    # Берем последний URL из srcset - он обычно самый большой по размеру
                    photo_url = all_urls[-1]
                    logger.debug(f"Элемент {i}: найден последний URL из srcset (самое большое изображение): {photo_url[:80]}...")
                
                # Ищем URL с .p.161.160. или .f.161.160. в srcset (для миниатюры)
                if not thumb_url:
                    thumb_matches = re.findall(r'(https?://[^\s,]+\.(?:p|f)\.(?:161\.160|160\.160)\.[^\s,]+)', srcset)
                    if thumb_matches:
                        # Берем первый для миниатюры (обычно это правильный размер для thumbnail)
                        thumb_url = thumb_matches[0]
                        logger.debug(f"Элемент {i}: найден URL миниатюры из srcset: {thumb_url[:80]}...")
                    elif photo_url:
                        # Если нашли большое изображение, но нет 161.160, используем его и для миниатюры
                        thumb_url = photo_url
                elif not photo_url:
                    # Если есть миниатюра, но нет оригинального, заменяем размеры
                    photo_url = thumb_url.replace('.161.160.', '.600.600.').replace('.160.160.', '.600.600.')
                    logger.debug(f"Элемент {i}: сформирован URL большого изображения: {photo_url[:80]}...")
            
            # Если все еще нет, используем src
            if not thumb_url:
                thumb_url = img_src
            
            title_elem = item.css_first('b.darkblue.break-word')
            if not title_elem:
                # Пробуем другие варианты селекторов
                title_elem = item.css_first('b.break-word.darkblue')
            if not title_elem:
                title_elem = item.css_first('a.arrow_link b.darkblue')
            
            title = title_elem.text(strip=True) if title_elem else "Изображение"
            
            # Если photo_url не нашли, формируем из thumb_url
            if not photo_url:
                # Получаем data-nid и data-type для формирования URL
                data_nid = item.attributes.get('data-nid')
                data_type = item.attributes.get('data-type', '7')  # 7 = картинка (pictures), 5 = файл (files)
                
                # Формируем URL большого изображения
                if thumb_url.startswith('http'):
                    if data_type == '7':  # Картинка (pictures)
                        # Заменяем размеры на большие для photo_url (600x600, как в srcset)
                        photo_url = thumb_url.replace('.p.81.80.', '.p.600.600.')
                        photo_url = photo_url.replace('.p.161.160.', '.p.600.600.')
                        photo_url = photo_url.replace('.p.160.160.', '.p.600.600.')
                        # Если размеры не найдены, пробуем заменить любой размер
                        if '.p.600.600.' not in photo_url:
                            import re
                            # Заменяем любой размер .p.XXX.YYY. на .p.600.600.
                            photo_url = re.sub(r'\.p\.\d+\.\d+\.', '.p.600.600.', photo_url)
                    else:  # Файл (files)
                        photo_url = thumb_url.replace('.f.81.80.', '.f.600.600.')
                        photo_url = photo_url.replace('.f.161.160.', '.f.600.600.')
                        photo_url = photo_url.replace('.f.160.160.', '.f.600.600.')
                        if '.f.600.600.' not in photo_url:
                            import re
                            photo_url = re.sub(r'\.f\.\d+\.\d+\.', '.f.600.600.', photo_url)
                else:
                    # Если URL относительный
                    thumb_url = f"https://spaces.im{thumb_url}" if thumb_url.startswith('/') else f"https://{thumb_url}"
                    photo_url = thumb_url
            
            # Получаем ссылку на страницу просмотра
            view_link = item.css_first('a.arrow_link')
            view_url = None
            if view_link:
                view_href = view_link.attributes.get('href', '')
                if view_href:
                    view_url = view_href.replace('&amp;', '&')
                    if not view_url.startswith('http'):
                        view_url = f"https://spaces.im{view_url}" if view_url.startswith('/') else f"https://spaces.im/{view_url}"
            
            if title and photo_url and thumb_url:
                pictures.append({
                    'title': title,
                    'thumb_url': thumb_url,
                    'photo_url': photo_url,
                    'view_url': view_url  # Ссылка на страницу просмотра для получения оригинала
                })
                logger.debug(f"Элемент {i}: Добавлена картинка '{title}', view_url={view_url}")
            else:
                logger.warning(f"Элемент {i}: Пропущена картинка - title={bool(title)}, photo_url={bool(photo_url)}, thumb_url={bool(thumb_url)}")
        except Exception as e:
            logger.error(f"Элемент {i}: Ошибка парсинга картинки: {e}", exc_info=True)
            continue
    
    logger.info(f"Всего найдено картинок: {len(pictures)}")
    return pictures


def parse_tracks_from_html(html_text):
    """Парсит список треков из страницы категории или поиска"""
    tree = HTMLParser(html_text)
    tracks = []
    
    items = tree.css('div.list-item.__adv_list_track, div.__adv_list_track, div.light_border_bottom.t-bg3.__adv_list_track')
    
    if not items:
        items = tree.css('div.list-item, div[data-type="6"]')
    
    for i, item in enumerate(items):
        try:
            track_name = None
            download_link = None
            
            if item.css_first('div.light_border_bottom'):
                artist_elem = item.css_first('div.oh.t-padd_left > div.oh')
                if artist_elem:
                    artist_text = artist_elem.text(strip=True)
                    if ':' in artist_text:
                        parts = artist_text.split(':', 1)
                        artist = parts[0].strip()
                        title_link = item.css_first('a.arrow_link')
                        if title_link:
                            span = title_link.css_first('span')
                            if span:
                                title = span.text(strip=True)
                                track_name = f"{artist}: {title}"
                        else:
                            track_name = artist_text.strip()
                    else:
                        title_link = item.css_first('a.arrow_link')
                        if title_link:
                            span = title_link.css_first('span')
                            if span:
                                track_name = span.text(strip=True)
                
                player_div = item.css_first('div.player_item')
                if player_div:
                    data_src = player_div.attributes.get('data-src', '')
                    if data_src:
                        download_link = data_src if data_src.startswith('http') else f"https://spaces.im{data_src}"
                
                if not download_link:
                    download_a = item.css_first('a.__adv_download')
                    if download_a:
                        download_link = download_a.attributes.get('href', '')
                        if download_link:
                            if not download_link.startswith('http'):
                                download_link = f"https://spaces.im{download_link}"
            else:
                title_elem = item.css_first('b.darkblue.break-word')
                if not title_elem:
                    title_elem = item.css_first('b.break-word.darkblue')
                if not title_elem:
                    title_elem = item.css_first('b.darkblue')
                
                if not title_elem:
                    continue
                
                track_name = title_elem.text(strip=True)
                
                player_div = item.css_first('div.player_item')
                if player_div:
                    data_src = player_div.attributes.get('data-src', '')
                    if data_src:
                        download_link = data_src if data_src.startswith('http') else f"https://spaces.im{data_src}"
                
                if not download_link:
                    download_a = item.css_first('a.__adv_download')
                    if download_a:
                        download_link = download_a.attributes.get('href', '')
                        if download_link:
                            if not download_link.startswith('http'):
                                download_link = f"https://spaces.im{download_link}"
            
            if track_name and download_link:
                tracks.append({
                    'name': track_name,
                    'url': download_link
                })
        except Exception as e:
            logger.error(f"Элемент {i}: Ошибка парсинга трека: {e}", exc_info=True)
            continue
    
    logger.debug(f"Всего найдено треков: {len(tracks)}")
    return tracks


def get_page_url(category_url, page_num):
    """Формирует URL для конкретной страницы"""
    if page_num == 1:
        return category_url
    
    if 'music-online/search' in category_url:
        import re
        if 'P=' in category_url:
            if category_url.startswith('?'):
                return re.sub(r'[?&]P=\d+', f'P={page_num}', category_url)
            else:
                return re.sub(r'[?&]P=\d+', f'&P={page_num}', category_url)
        else:
            if '?' in category_url:
                return f"{category_url}&P={page_num}"
            else:
                return f"{category_url}?P={page_num}"
    
    if '?' in category_url:
        base_url, query_params = category_url.split('?', 1)
        if base_url.endswith('/'):
            return f"{base_url}p{page_num}/?{query_params}"
        else:
            return f"{base_url}/p{page_num}/?{query_params}"
    else:
        if category_url.endswith('/'):
            return f"{category_url}p{page_num}/"
        else:
            return f"{category_url}/p{page_num}/"


async def get_tracks_from_category(category_url, use_random_page=True):
    """Получает список треков из категории"""
    try:
        async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
            first_page_url = category_url
            response = await client.get(first_page_url, headers=get_request_headers())
            response.raise_for_status()
            
            html_text = response.text
            
            if len(html_text) < 1000:
                logger.error(f"HTML слишком короткий: {len(html_text)} символов")
                return []
            
            max_pages = parse_pagination_info(html_text)
            
            if use_random_page and max_pages and max_pages > 1:
                random_page = random.randint(1, min(max_pages, 1000))
                if random_page > 1:
                    page_url = get_page_url(category_url, random_page)
                    logger.debug(f"Выбрана случайная страница {random_page} из {max_pages}")
                    
                    response = await client.get(page_url, headers=get_request_headers())
                    response.raise_for_status()
                    html_text = response.text
            
            tracks = parse_tracks_from_html(html_text)
            logger.info(f"Найдено треков: {len(tracks)}")
            return tracks
    except Exception as e:
        logger.error(f"Ошибка получения треков из {category_url}: {e}", exc_info=True)
        return []


async def get_final_download_url(url):
    """Получает финальный URL после всех редиректов"""
    try:
        async with httpx.AsyncClient(cookies=SPACES_COOKIES, follow_redirects=True, timeout=30.0) as client:
            response = await client.get(url, headers=get_request_headers())
            response.raise_for_status()
            final_url = str(response.url)
            return final_url
    except Exception as e:
        logger.error(f"Ошибка получения финального URL: {e}")
        return url


async def download_video_to_file(video_url, max_size_mb=50):
    """Загружает видео локально во временный файл"""
    try:
        # Создаем папку для временных файлов в текущей директории
        temp_dir = "temp_videos"
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir, mode=0o755)
        
        async with httpx.AsyncClient(cookies=SPACES_COOKIES, follow_redirects=True, timeout=60.0) as client:
            async with client.stream('GET', video_url, headers=get_request_headers()) as response:
                response.raise_for_status()
                
                total_size = 0
                max_size_bytes = max_size_mb * 1024 * 1024
                
                # Создаем временный файл в нашей папке
                import uuid
                tmp_filename = f"{uuid.uuid4().hex}.mp4"
                tmp_path = os.path.join(temp_dir, tmp_filename)
                
                with open(tmp_path, 'wb') as tmp_file:
                    async for chunk in response.aiter_bytes():
                        total_size += len(chunk)
                        
                        if total_size > max_size_bytes:
                            os.unlink(tmp_path)
                            logger.warning(f"Видео слишком большое: {total_size / 1024 / 1024:.2f} МБ")
                            return None
                        
                        tmp_file.write(chunk)
                
                # Устанавливаем права на чтение для всех
                os.chmod(tmp_path, 0o644)
                
                logger.info(f"Видео загружено: {total_size / 1024 / 1024:.2f} МБ, путь: {tmp_path}")
                return tmp_path
    except Exception as e:
        logger.error(f"Ошибка загрузки видео: {e}", exc_info=True)
        return None


def parse_search_form_params(html_text):
    """Парсит параметры формы поиска из HTML"""
    tree = HTMLParser(html_text)
    
    form = tree.css_first('form[action*="files/search"]')
    if not form:
        return None
    
    params = {}
    
    sid_input = form.css_first('input[name="sid"]')
    if sid_input:
        params['sid'] = sid_input.attributes.get('value', '')
    
    link_id_input = form.css_first('input[name="Link_id"]')
    if link_id_input:
        params['Link_id'] = link_id_input.attributes.get('value', '')
    
    stt_input = form.css_first('input[name="stt"]')
    if stt_input:
        params['stt'] = stt_input.attributes.get('value', '')
    
    slist_input = form.css_first('input[name="Slist"]')
    if slist_input:
        params['Slist'] = slist_input.attributes.get('value', '')
    
    rli_input = form.css_first('input[name="Rli"]')
    if rli_input:
        params['Rli'] = rli_input.attributes.get('value', '')
    
    return params if params else None


async def search_pictures(query, page_num=1):
    """Ищет картинки по запросу"""
    try:
        global picture_search_cache
        cache_key = f"pic_search_{query}"
        
        # Получаем базовый URL поиска и max_pages из кеша или делаем POST запрос
        base_photo_search_url = None
        cached_max_pages = None
        
        if cache_key in picture_search_cache:
            cache_data = picture_search_cache[cache_key]
            if isinstance(cache_data, dict):
                base_photo_search_url = cache_data.get('base_url')
                cached_max_pages = cache_data.get('max_pages')
            else:
                # Старый формат кеша (только URL)
                base_photo_search_url = cache_data
            
            if base_photo_search_url:
                logger.debug(f"Использован кешированный URL поиска фото для '{query}'")
        
        if not base_photo_search_url:
            # Сначала делаем POST запрос на страницу поиска
            search_form_url = "https://spaces.im/files/search/"
            
            async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
                # Получаем страницу с формой поиска
                form_response = await client.get(search_form_url, headers=get_request_headers())
                form_response.raise_for_status()
                form_html = form_response.text
                
                # Парсим параметры формы
                form_params = parse_search_form_params(form_html)
                if not form_params:
                    # Значения по умолчанию
                    form_params = {
                        'sid': '',
                        'Link_id': '497973',
                        'Rli': '',
                        'stt': 'bfM5ACPv_pw'
                    }
                
                # Делаем POST запрос с поисковым запросом
                search_response = await client.post(search_form_url, data={'word': query, **form_params}, headers=get_request_headers())
                search_response.raise_for_status()
                search_html = search_response.text
                
                if len(search_html) < 1000:
                    logger.error(f"HTML слишком короткий: {len(search_html)} символов")
                    return [], None, None
                
                # Парсим ссылку "Фото и картинки" с Slist=1690
                base_photo_search_url = parse_files_search_link(search_html)
                if not base_photo_search_url:
                    logger.error("Не найдена ссылка на фото и картинки")
                    return [], None, None
                
                # Получаем первую страницу результатов для парсинга пагинации
                first_page_response = await client.get(base_photo_search_url, headers=get_request_headers())
                first_page_response.raise_for_status()
                first_page_html = first_page_response.text
                cached_max_pages = parse_pagination_info(first_page_html)
                
                # Кешируем базовый URL и max_pages
                picture_search_cache[cache_key] = {
                    'base_url': base_photo_search_url,
                    'max_pages': cached_max_pages
                }
                logger.debug(f"Найдена ссылка на фото и закэширована: {base_photo_search_url}, страниц: {cached_max_pages}")
        
        # Формируем URL с параметром пагинации
        photo_search_url = base_photo_search_url
        if page_num > 1:
            if '?' in photo_search_url:
                photo_search_url = f"{photo_search_url}&P={page_num}"
            else:
                photo_search_url = f"{photo_search_url}?P={page_num}"
        
        # Получаем страницу с результатами поиска картинок
        async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
            results_response = await client.get(photo_search_url, headers=get_request_headers())
            results_response.raise_for_status()
            html_text = results_response.text
            
            pictures = parse_pictures_from_html(html_text)
            
            # Парсим пагинацию, если не была закэширована
            max_pages = parse_pagination_info(html_text) if not cached_max_pages else cached_max_pages
            if not max_pages and cached_max_pages:
                max_pages = cached_max_pages
            elif max_pages and max_pages != cached_max_pages:
                # Обновляем кеш, если количество страниц изменилось
                if cache_key in picture_search_cache:
                    picture_search_cache[cache_key]['max_pages'] = max_pages
            
            current_page = page_num
            
            logger.info(f"Найдено картинок (стр. {current_page}/{max_pages or '?'}): {len(pictures)}")
            return pictures, max_pages, current_page
    except Exception as e:
        logger.error(f"Ошибка поиска картинок: {e}", exc_info=True)
        return [], None, None


async def search_video_files(query, page_num=1):
    """Ищет видео по запросу через files/search (раздел видео)"""
    try:
        global video_files_search_cache
        cache_key = f"video_files_search_{query}"
        
        base_video_search_url = None
        cached_max_pages = None
        
        if cache_key in video_files_search_cache:
            cache_data = video_files_search_cache[cache_key]
            if isinstance(cache_data, dict):
                base_video_search_url = cache_data.get('base_url')
                cached_max_pages = cache_data.get('max_pages')
            else:
                base_video_search_url = cache_data
            
            if base_video_search_url:
                logger.debug(f"Использован кешированный URL поиска видео для '{query}'")
        
        if not base_video_search_url:
            search_form_url = "https://spaces.im/files/search/"
            
            async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
                form_response = await client.get(search_form_url, headers=get_request_headers())
                form_response.raise_for_status()
                form_html = form_response.text
                
                form_params = parse_search_form_params(form_html)
                if not form_params:
                    form_params = {
                        'sid': '',
                        'Link_id': '497973',
                        'Rli': '',
                        'stt': 'bfM5ACPv_pw'
                    }
                
                search_response = await client.post(search_form_url, data={'word': query, **form_params}, headers=get_request_headers())
                search_response.raise_for_status()
                search_html = search_response.text
                
                if len(search_html) < 1000:
                    logger.error(f"HTML слишком короткий: {len(search_html)} символов")
                    return [], None, None
                
                base_video_search_url = parse_video_search_link(search_html)
                if not base_video_search_url:
                    logger.error("Не найдена ссылка на видео")
                    return [], None, None
                
                first_page_response = await client.get(base_video_search_url, headers=get_request_headers())
                first_page_response.raise_for_status()
                first_page_html = first_page_response.text
                cached_max_pages = parse_pagination_info(first_page_html)
                
                video_files_search_cache[cache_key] = {
                    'base_url': base_video_search_url,
                    'max_pages': cached_max_pages
                }
                logger.debug(f"Найдена ссылка на видео и закэширована: {base_video_search_url}, страниц: {cached_max_pages}")
        
        video_search_url = base_video_search_url
        if page_num > 1:
            if '?' in video_search_url:
                video_search_url = f"{video_search_url}&P={page_num}"
            else:
                video_search_url = f"{video_search_url}?P={page_num}"
        
        async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
            results_response = await client.get(video_search_url, headers=get_request_headers())
            results_response.raise_for_status()
            html_text = results_response.text
            
            videos = parse_videos_from_search(html_text)
            
            max_pages = parse_pagination_info(html_text) if not cached_max_pages else cached_max_pages
            if not max_pages and cached_max_pages:
                max_pages = cached_max_pages
            elif max_pages and max_pages != cached_max_pages:
                if cache_key in video_files_search_cache:
                    video_files_search_cache[cache_key]['max_pages'] = max_pages
            
            current_page = page_num
            
            logger.info(f"Найдено видео из поиска файлов (стр. {current_page}/{max_pages or '?'}): {len(videos)}")
            return videos, max_pages, current_page
    except Exception as e:
        logger.error(f"Ошибка поиска видео через files: {e}", exc_info=True)
        return [], None, None


def get_video_download_url_from_html(html_text):
    """Парсит URL скачивания видео и информацию о видео из HTML страницы просмотра"""
    try:
        tree = HTMLParser(html_text)
        
        download_url = None
        
        # Ищем ссылку на скачивание mp4
        download_links = tree.css('a.list-link.list-link-blue')
        for link in download_links:
            link_text = link.text(strip=True)
            href = link.attributes.get('href', '')
            
            # Ищем ссылку со словом "Скачать" и "mp4"
            if 'Скачать' in link_text and 'mp4' in link_text.lower():
                if href.startswith('http'):
                    download_url = href
                else:
                    download_url = f"https://spaces.im{href}" if href.startswith('/') else f"https://spaces.im/{href}"
                break
        
        # Fallback: ищем любую ссылку с video/download
        if not download_url:
            all_download_links = tree.css('a[href*="video/download"]')
            for link in all_download_links:
                href = link.attributes.get('href', '')
                if href and '.mp4' in href:
                    if href.startswith('http'):
                        download_url = href
                    else:
                        download_url = f"https://spaces.im{href}" if href.startswith('/') else f"https://spaces.im/{href}"
                    break
        
        # Парсим описание и информацию об авторе
        video_info = parse_video_info_from_view_page(html_text)
        
        return {
            'download_url': download_url,
            'description': video_info.get('description'),
            'author_name': video_info.get('author_name'),
            'author_date': video_info.get('author_date')
        }
    except Exception as e:
        logger.error(f"Ошибка парсинга URL скачивания видео из HTML: {e}")
        return {'download_url': None, 'description': None, 'author_name': None, 'author_date': None}


async def search_music_files(query, page_num=1):
    """Ищет музыку по запросу через files/search (раздел музыки)"""
    try:
        global music_files_search_cache
        cache_key = f"music_files_search_{query}"
        
        base_music_search_url = None
        cached_max_pages = None
        
        if cache_key in music_files_search_cache:
            cache_data = music_files_search_cache[cache_key]
            if isinstance(cache_data, dict):
                base_music_search_url = cache_data.get('base_url')
                cached_max_pages = cache_data.get('max_pages')
            else:
                base_music_search_url = cache_data
            
            if base_music_search_url:
                logger.debug(f"Использован кешированный URL поиска музыки для '{query}'")
        
        if not base_music_search_url:
            search_form_url = "https://spaces.im/files/search/"
            
            async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
                form_response = await client.get(search_form_url, headers=get_request_headers())
                form_response.raise_for_status()
                form_html = form_response.text
                
                form_params = parse_search_form_params(form_html)
                if not form_params:
                    form_params = {
                        'sid': '',
                        'Link_id': '497973',
                        'Rli': '',
                        'stt': 'bfM5ACPv_pw'
                    }
                
                search_response = await client.post(search_form_url, data={'word': query, **form_params}, headers=get_request_headers())
                search_response.raise_for_status()
                search_html = search_response.text
                
                if len(search_html) < 1000:
                    logger.error(f"HTML слишком короткий: {len(search_html)} символов")
                    return [], None, None
                
                base_music_search_url = parse_music_search_link(search_html)
                if not base_music_search_url:
                    logger.error("Не найдена ссылка на музыку")
                    return [], None, None
                
                first_page_response = await client.get(base_music_search_url, headers=get_request_headers())
                first_page_response.raise_for_status()
                first_page_html = first_page_response.text
                cached_max_pages = parse_pagination_info(first_page_html)
                
                music_files_search_cache[cache_key] = {
                    'base_url': base_music_search_url,
                    'max_pages': cached_max_pages
                }
                logger.debug(f"Найдена ссылка на музыку и закэширована: {base_music_search_url}, страниц: {cached_max_pages}")
        
        music_search_url = base_music_search_url
        if page_num > 1:
            if '?' in music_search_url:
                music_search_url = f"{music_search_url}&P={page_num}"
            else:
                music_search_url = f"{music_search_url}?P={page_num}"
        
        async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
            results_response = await client.get(music_search_url, headers=get_request_headers())
            results_response.raise_for_status()
            html_text = results_response.text
            
            tracks = parse_music_tracks_from_search(html_text)
            
            max_pages = parse_pagination_info(html_text) if not cached_max_pages else cached_max_pages
            if not max_pages and cached_max_pages:
                max_pages = cached_max_pages
            elif max_pages and max_pages != cached_max_pages:
                if cache_key in music_files_search_cache:
                    music_files_search_cache[cache_key]['max_pages'] = max_pages
            
            current_page = page_num
            
            logger.info(f"Найдено треков из поиска файлов (стр. {current_page}/{max_pages or '?'}): {len(tracks)}")
            return tracks, max_pages, current_page
    except Exception as e:
        logger.error(f"Ошибка поиска музыки через files: {e}", exc_info=True)
        return [], None, None


async def search_music(query, page_num=1, cache_key=None):
    """Ищет музыку по запросу и возвращает список треков с указанной страницы"""
    try:
        import urllib.parse
        encoded_query = urllib.parse.quote(query)
        
        if cache_key and cache_key in search_cache:
            cache_data = search_cache[cache_key]
            link_id = cache_data['link_id']
            max_pages = cache_data['max_pages']
            encoded_query = cache_data['encoded_query']
        else:
            search_url = f"{SEARCH_BASE_URL}?T=0&sq={encoded_query}&CK=1"
            
            async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
                response = await client.get(search_url, headers=get_request_headers())
                response.raise_for_status()
                
                html_text = response.text
                
                if len(html_text) < 1000:
                    logger.error(f"HTML слишком короткий: {len(html_text)} символов")
                    return [], None, None
                
                link_id = parse_search_link_id(html_text)
                if not link_id:
                    logger.warning("Не найден Link_id на странице поиска")
                    return [], None, None
                
                # Парсим пагинацию с первой страницы результатов, а не со страницы поиска
                first_results_url = f"{SEARCH_BASE_URL}?Link_id={link_id}&T=28&sq={encoded_query}"
                first_results_response = await client.get(first_results_url, headers=get_request_headers())
                first_results_response.raise_for_status()
                first_results_html = first_results_response.text
                
                max_pages = parse_pagination_info(first_results_html)
                logger.debug(f"Найдено страниц для поиска '{query}': {max_pages}")
                
                if cache_key:
                    search_cache[cache_key] = {
                        'link_id': link_id,
                        'max_pages': max_pages,
                        'encoded_query': encoded_query
                    }
        
        # Формируем URL с правильным порядком параметров: Link_id, P (если нужно), T, sq
        if page_num > 1 and max_pages and page_num <= max_pages:
            results_url = f"{SEARCH_BASE_URL}?Link_id={link_id}&P={page_num}&T=28&sq={encoded_query}"
            logger.debug(f"Страница {page_num} из {max_pages}")
        else:
            results_url = f"{SEARCH_BASE_URL}?Link_id={link_id}&T=28&sq={encoded_query}"
        
        async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
            response = await client.get(results_url, headers=get_request_headers())
            response.raise_for_status()
            html_text = response.text
        
        # Если max_pages еще не определен или нужно обновить
        if not max_pages:
            pagination_from_results = parse_pagination_info(html_text)
            if pagination_from_results:
                max_pages = pagination_from_results
                logger.debug(f"Пагинация определена со страницы результатов: {max_pages}")
                if cache_key and cache_key in search_cache:
                    search_cache[cache_key]['max_pages'] = max_pages
        
        tracks = parse_tracks_from_html(html_text)
        
        for track in tracks:
            track['category'] = f"Поиск: {query}"
        
        current_page = page_num
        logger.info(f"Найдено треков из поиска (стр. {current_page}/{max_pages or '?'}): {len(tracks)}")
        return tracks, max_pages, current_page
    except Exception as e:
        logger.error(f"Ошибка поиска музыки: {e}", exc_info=True)
        return [], None, None


async def get_random_tracks():
    """Получает список треков из случайной категории или поиска"""
    if random.random() < 0.5:
        search_queries = [
            "демо", "pop", "rock", "jazz", "electronic", "классика",
            "russian", "джаз", "рок", "электронная", "хит", "remix"
        ]
        query = random.choice(search_queries)
        tracks = await search_music(query)
        if tracks:
            return tracks
    
    categories = await get_categories()
    
    if not categories:
        logger.error("Нет категорий!")
        return []
    
    max_attempts = 10
    for attempt in range(max_attempts):
        category = random.choice(categories)
        
        tracks = await get_tracks_from_category(category['url'])
        
        if tracks:
            for track in tracks:
                track['category'] = category['name']
            logger.info(f"Найдено треков: {len(tracks)} из категории {category['name']}")
            return tracks
    
    logger.error("Не удалось найти треки после всех попыток")
    return []




@dp.inline_query()
async def inline_query_handler(inline_query: InlineQuery):
    """Обработчик inline запросов"""
    global cookies_loaded
    
    if not cookies_loaded:
        await load_and_save_cookies()
    
    try:
        query = inline_query.query.strip() if inline_query.query else ""
        offset = inline_query.offset
        page_num = 1
        if offset:
            try:
                page_num = int(offset)
            except ValueError:
                page_num = 1
        
        is_picture_search = query.startswith('-к1') or query.startswith('-к1 ')
        if is_picture_search:
            query = query.replace('-к1', '').strip()
        
        is_music_files_search = query.startswith('-м1') or query.startswith('-м1 ')
        if is_music_files_search:
            query = query.replace('-м1', '').strip()
        
        is_video_files_search = query.startswith('-в1') or query.startswith('-в1 ')
        if is_video_files_search:
            query = query.replace('-в1', '').strip()
        
        # Для поиска видео через files/search
        if is_video_files_search and query and len(query) >= 1:
            logger.info(f"Поиск видео (files) по запросу: '{query}' (страница {page_num})")
            videos, max_pages, current_page = await search_video_files(query, page_num)
            
            if not isinstance(videos, list):
                videos = []
            
            videos = [v for v in videos if isinstance(v, dict) and 'name' in v and 'view_url' in v]
            
            if not videos and page_num == 1:
                result = InlineQueryResultArticle(
                    id="not_found_video_files",
                    title="❌ Видео не найдены",
                    description=f"По запросу '{query}' ничего не найдено",
                    input_message_content=InputTextMessageContent(
                        message_text=f"❌ По запросу <b>{query}</b> видео не найдены.\n\nПопробуйте другой запрос.",
                        parse_mode="HTML"
                    )
                )
                await inline_query.answer(
                    results=[result],
                    cache_time=1
                )
                return
            elif not videos:
                await inline_query.answer(
                    results=[],
                    cache_time=1,
                    next_offset=""
                )
                return
            
            results = []
            for i, video in enumerate(videos[:50]):
                result_id = f"vid_{page_num}_{i}_{random.randint(1000, 9999)}"
                video['search_query'] = query
                video_info_cache[result_id] = video
                logger.debug(f"Видео '{video.get('name')}' сохранено в кэш с result_id: {result_id}")
                
                keyboard_buttons = []
                
                # Кнопка "Найти еще"
                keyboard_buttons.append([InlineKeyboardButton(
                    text="🔍 Найти еще",
                    switch_inline_query_current_chat=f"-в1 {query}"
                )])
                
                # Кнопка со ссылкой на страницу видео
                view_url = video.get('view_url')
                if view_url:
                    keyboard_buttons.append([InlineKeyboardButton(
                        text="📹 Страница видео",
                        url=view_url
                    )])
                
                # Кнопка "Перейти в бота"
                keyboard_buttons.append([InlineKeyboardButton(
                    text="Перейти в бота",
                    url="https://t.me/archigame_bot"
                )])
                
                keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                
                video_title = video['name'][:64] if len(video['name']) > 64 else video['name']
                preview_url = video.get('preview_url', '')
                view_url = video.get('view_url', '')
                
                # Логируем preview_url для отладки
                print(f"\n{'='*60}")
                print(f"ВИДЕО #{i+1}: {video_title}")
                print(f"preview_url: {preview_url}")
                print(f"view_url: {view_url}")
                print(f"{'='*60}\n")
                logger.debug(f"Видео {i+1}: title={video_title}, preview_url={preview_url[:80] if preview_url else 'None'}..., view_url={view_url[:80] if view_url else 'None'}...")
                
                # Если нет preview_url, пропускаем видео (нужен thumbnail)
                if not preview_url or not preview_url.startswith('http'):
                    logger.warning(f"Пропускаем видео '{video_title}' - нет валидного preview_url: {preview_url}")
                    continue
                
                if not view_url or not view_url.startswith('http'):
                    logger.warning(f"Пропускаем видео '{video_title}' - нет валидного view_url: {view_url}")
                    continue
                
                description_text = f"📹 ВИДЕО: {video_title}\n🔍 Поиск: {query}"
                description = description_text[:128] if len(description_text) > 128 else description_text
                
                # В title тоже добавляем пометку что это видео
                video_title_display = f"📹 {video_title}"
                
                # Используем InlineQueryResultArticle с превью изображением
                # При выборе обновим на реальное видео через chosen_inline_result_handler
                if preview_url and preview_url.startswith('http'):
                    result = InlineQueryResultArticle(
                        id=result_id,
                        title=video_title_display,
                        description=description,
                        thumbnail_url=preview_url,  # Превью изображение видео из сайта
                        input_message_content=InputTextMessageContent(
                            message_text=f"📹 <b>{video_title}</b>\n🔍 Поиск: {query}",
                            parse_mode="HTML"
                        ),
                        reply_markup=keyboard
                    )
                    logger.debug(f"Создан InlineQueryResultArticle для видео: id={result_id}, preview={preview_url[:60]}...")
                    print(f"✅ Создан результат (Article) для видео: {video_title_display}, preview_url={preview_url[:80]}...")
                else:
                    logger.warning(f"Пропускаем видео '{video_title}' - preview_url не валидный: {preview_url}")
                    print(f"❌ Пропущено видео '{video_title}' - preview_url: {preview_url}")
                    continue
                results.append(result)
            
            next_offset = ""
            if max_pages and current_page and current_page < max_pages:
                next_offset = str(current_page + 1)
            
            await inline_query.answer(
                results=results,
                cache_time=0,
                next_offset=next_offset if next_offset else None
            )
            return
        
        # Для поиска музыки через files/search
        if is_music_files_search and query and len(query) >= 1:
            logger.info(f"Поиск музыки (files) по запросу: '{query}' (страница {page_num})")
            tracks, max_pages, current_page = await search_music_files(query, page_num)
            
            if not isinstance(tracks, list):
                tracks = []
            
            tracks = [t for t in tracks if isinstance(t, dict) and 'name' in t and 'url' in t]
            
            if not tracks and page_num == 1:
                result = InlineQueryResultArticle(
                    id="not_found_music_files",
                    title="❌ Треки не найдены",
                    description=f"По запросу '{query}' ничего не найдено",
                    input_message_content=InputTextMessageContent(
                        message_text=f"❌ По запросу <b>{query}</b> треки не найдены.\n\nПопробуйте другой запрос.",
                        parse_mode="HTML"
                    )
                )
                await inline_query.answer(
                    results=[result],
                    cache_time=1
                )
                return
            elif not tracks:
                await inline_query.answer(
                    results=[],
                    cache_time=1,
                    next_offset=""
                )
                return
            
            results = []
            for track in tracks[:50]:
                result_id = str(random.randint(1000000, 9999999))
                track_info_cache[result_id] = track
                
                keyboard_buttons = []
                
                # Кнопка "Найти еще"
                keyboard_buttons.append([InlineKeyboardButton(
                    text="🔍 Найти еще",
                    switch_inline_query_current_chat=f"-м1 {query}"
                )])
                
                # Кнопка "Перейти в бота"
                keyboard_buttons.append([InlineKeyboardButton(
                    text="Перейти в бота",
                    url="https://t.me/archigame_bot"
                )])
                
                keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                
                caption = f"🎵 {track['name']}\n📁 Поиск: {query}"
                
                result = InlineQueryResultAudio(
                    id=result_id,
                    audio_url=track['url'],
                    title=track['name'],
                    caption=caption,
                    reply_markup=keyboard
                )
                results.append(result)
            
            next_offset = ""
            if max_pages and current_page and current_page < max_pages:
                next_offset = str(current_page + 1)
            
            await inline_query.answer(
                results=results,
                cache_time=0,
                next_offset=next_offset if next_offset else None
            )
            return
        
        # Для поиска картинок разрешаем запросы от 1 символа
        if is_picture_search and query and len(query) >= 1:
            logger.info(f"Поиск картинок по запросу: '{query}' (страница {page_num})")
            pictures, max_pages, current_page = await search_pictures(query, page_num)
            
            if not isinstance(pictures, list):
                pictures = []
            
            logger.info(f"До фильтрации картинок: {len(pictures)}")
            
            # Фильтруем только валидные картинки
            valid_pictures = []
            for p in pictures:
                if isinstance(p, dict) and 'title' in p and 'photo_url' in p and 'thumb_url' in p:
                    # Проверяем, что URL валидные
                    if p['photo_url'].startswith('http') and p['thumb_url'].startswith('http'):
                        valid_pictures.append(p)
                    else:
                        logger.warning(f"Картинка с невалидным URL: photo={p.get('photo_url')}, thumb={p.get('thumb_url')}")
                else:
                    logger.warning(f"Картинка не прошла валидацию: {p}")
            
            pictures = valid_pictures
            logger.info(f"После фильтрации картинок: {len(pictures)}")
            
            if not pictures and page_num == 1:
                result = InlineQueryResultArticle(
                    id="not_found_pics",
                    title="❌ Картинки не найдены",
                    description=f"По запросу '{query}' ничего не найдено",
                    input_message_content=InputTextMessageContent(
                        message_text=f"❌ По запросу <b>{query}</b> картинки не найдены.\n\nПопробуйте другой запрос.",
                        parse_mode="HTML"
                    )
                )
                await inline_query.answer(
                    results=[result],
                    cache_time=1
                )
                return
            elif not pictures:
                await inline_query.answer(
                    results=[],
                    cache_time=1,
                    next_offset=""
                )
                return
            
            results = []
            for i, picture in enumerate(pictures[:50]):
                try:
                    result_id = f"pic_{page_num}_{i}_{random.randint(1000, 9999)}"
                    
                    # Сохраняем информацию о картинке в кэш вместе с запросом поиска
                    picture_info_cache[result_id] = {
                        **picture,
                        'search_query': query
                    }
                    logger.debug(f"Картинка сохранена в кэш: result_id={result_id}, title={picture.get('title', 'Unknown')}, view_url={picture.get('view_url', 'None')}")
                    
                    # Формируем клавиатуру с кнопками
                    keyboard_buttons = []
                    
                    # Кнопка "Найти еще"
                    keyboard_buttons.append([InlineKeyboardButton(
                        text="🔍 Найти еще",
                        switch_inline_query_current_chat=f"-к1 {query}"
                    )])
                    
                    # Кнопка со ссылкой на страницу фото
                    view_url = picture.get('view_url')
                    if view_url:
                        keyboard_buttons.append([InlineKeyboardButton(
                            text="📷 Страница фото",
                            url=view_url
                        )])
                    
                    # Кнопка "Перейти в бота"
                    keyboard_buttons.append([InlineKeyboardButton(
                        text="Перейти в бота",
                        url="https://t.me/archigame_bot"
                    )])
                    
                    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                    
                    photo_title = picture['title'][:64] if len(picture['title']) > 64 else picture['title']
                    photo_url = picture['photo_url']
                    thumb_url = picture['thumb_url']
                    
                    # Логируем полные URL для отладки
                    logger.info(f"Картинка {i+1}: '{photo_title}'")
                    logger.info(f"  photo_url: {photo_url}")
                    logger.info(f"  thumb_url: {thumb_url}")
                    
                    # Проверяем, что URL валидные
                    if not photo_url.startswith('http'):
                        logger.error(f"  ОШИБКА: photo_url не начинается с http: {photo_url}")
                        continue
                    if not thumb_url.startswith('http'):
                        logger.error(f"  ОШИБКА: thumb_url не начинается с http: {thumb_url}")
                        continue
                    
                    # Формируем описание с информацией о поиске
                    description_text = f"🔍 Поиск: {query}\n📷 {photo_title}"
                    description = description_text[:128] if len(description_text) > 128 else description_text
                    
                    result = InlineQueryResultPhoto(
                        id=result_id,
                        photo_url=photo_url,
                        thumbnail_url=thumb_url,
                        photo_width=600,
                        photo_height=600,
                        title=photo_title,
                        description=description,
                        reply_markup=keyboard
                    )
                    results.append(result)
                    logger.debug(f"  Результат {i+1} успешно добавлен")
                except Exception as e:
                    logger.error(f"Ошибка создания результата картинки {i+1}: {e}", exc_info=True)
                    logger.error(f"Данные картинки: {picture}")
                    continue
            
            logger.info(f"Подготовлено результатов картинок: {len(results)} из {len(pictures)} найденных")
            
            if not results:
                await inline_query.answer(
                    results=[],
                    cache_time=1
                )
                return
            
            next_offset = ""
            if max_pages and current_page and current_page < max_pages:
                next_offset = str(current_page + 1)
            
            logger.info(f"Отправка {len(results)} результатов картинок, next_offset={next_offset or 'None'}")
            
            # Проверяем, что у нас есть результаты
            if not results:
                logger.warning("Нет результатов для отправки!")
                await inline_query.answer(results=[], cache_time=1)
                return
            
            try:
                # Ограничиваем количество результатов до 50 (максимум для Telegram)
                results_to_send = results[:50]
                logger.info(f"Отправка {len(results_to_send)} результатов в Telegram")
                
                # Для поиска картинок не используем кеш, чтобы результаты обновлялись сразу
                await inline_query.answer(
                    results=results_to_send,
                    cache_time=0,  # Без кеша для поиска картинок
                    next_offset=next_offset if next_offset else None
                )
                logger.info("✅ Результаты картинок успешно отправлены в Telegram (cache_time=0)")
            except Exception as e:
                logger.error(f"❌ Ошибка отправки результатов картинок в Telegram: {e}", exc_info=True)
                logger.error(f"Тип ошибки: {type(e).__name__}")
                # Пробуем отправить хотя бы один результат для проверки
                if results:
                    try:
                        logger.info("Пробуем отправить один результат для проверки...")
                        await inline_query.answer(
                            results=[results[0]],
                            cache_time=1
                        )
                        logger.info("Один результат отправлен успешно")
                    except Exception as e2:
                        logger.error(f"Ошибка даже при отправке одного результата: {e2}")
                else:
                    await inline_query.answer(results=[], cache_time=1)
            return
        
        # Поиск музыки (если не поиск картинок)
        if query and len(query) >= 1:
            logger.info(f"Поиск музыки по запросу: '{query}' (страница {page_num})")
            cache_key = f"search_{query}"
            tracks, max_pages, current_page = await search_music(query, page_num, cache_key)
            
            if not isinstance(tracks, list):
                tracks = []
            
            tracks = [t for t in tracks if isinstance(t, dict) and 'name' in t and 'url' in t]
            
            if not tracks and page_num == 1:
                result = InlineQueryResultArticle(
                    id="not_found",
                    title="❌ Треки не найдены",
                    description=f"По запросу '{query}' ничего не найдено",
                    input_message_content=InputTextMessageContent(
                        message_text=f"❌ По запросу <b>{query}</b> треки не найдены.\n\nПопробуйте другой запрос.",
                        parse_mode="HTML"
                    )
                )
                await inline_query.answer(
                    results=[result],
                    cache_time=1
                )
                return
            elif not tracks:
                await inline_query.answer(
                    results=[],
                    cache_time=1,
                    next_offset=""
                )
                return
        else:
            # Пустой запрос - случайные треки
            tracks = await get_random_tracks()
            max_pages = None
            current_page = None
            
            if not isinstance(tracks, list):
                tracks = []
            
            tracks = [t for t in tracks if isinstance(t, dict) and 'name' in t and 'url' in t]
        
        if not tracks:
            await inline_query.answer(
                results=[],
                cache_time=1
            )
            return
        
        results = []
        for track in tracks[:50]:
            result_id = str(random.randint(1000000, 9999999))
            track_info_cache[result_id] = track
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(
                    text="Перейти в бота",
                    url="https://t.me/archigame_bot"
                )]
            ])
            
            caption = f"🎵 {track['name']}"
            if track.get('category'):
                caption += f"\n📁 {track['category']}"
            
            result = InlineQueryResultAudio(
                id=result_id,
                audio_url=track['url'],
                title=track['name'],
                caption=caption,
                reply_markup=keyboard
            )
            results.append(result)
        
        next_offset = ""
        if max_pages and current_page and current_page < max_pages:
            next_offset = str(current_page + 1)
        
        await inline_query.answer(
            results=results,
            cache_time=1,
            next_offset=next_offset if next_offset else None
        )
        
    except Exception as e:
        logger.error(f"Ошибка в inline_query_handler: {e}", exc_info=True)
        await inline_query.answer(results=[], cache_time=1)


@dp.chosen_inline_result()
async def chosen_inline_result_handler(chosen_result: ChosenInlineResult):
    """Обработчик выбора результата inline запроса"""
    global cookies_loaded
    
    result_id = chosen_result.result_id
    logger.info("=== CHOSEN INLINE RESULT ===")
    logger.info(f"result_id: {result_id}")
    logger.info(f"query: {chosen_result.query}")
    logger.info(f"from_user: {chosen_result.from_user.id if chosen_result.from_user else 'None'}")
    print(f"\n{'='*60}")
    print(f"CHOSEN INLINE RESULT: result_id={result_id}")
    print(f"query: {chosen_result.query}")
    print(f"result_id.startswith('vid_'): {result_id.startswith('vid_')}")
    print(f"result_id.startswith('pic_'): {result_id.startswith('pic_')}")
    print(f"Все ключи в video_info_cache ({len(video_info_cache)}): {list(video_info_cache.keys())[:10]}")
    print(f"{'='*60}\n")
    
    if not cookies_loaded:
        await load_and_save_cookies()
    
    try:
        # Проверяем, это трек, картинка или видео
        if result_id.startswith('pic_'):
            # Это картинка - получаем оригинальное изображение со страницы просмотра
            logger.info(f"Обработка выбранной картинки с result_id: {result_id}")
            logger.debug(f"Текущие ключи в picture_info_cache: {list(picture_info_cache.keys())[:10]}")
            
            picture = picture_info_cache.get(result_id)
            if picture:
                logger.info(f"Картинка найдена в кэше: {picture.get('title', 'Unknown')}")
                view_url = picture.get('view_url')
                if view_url:
                    logger.info(f"Выбрана картинка: {picture.get('title')}, получение оригинала со страницы: {view_url}")
                    
                    try:
                        # Загружаем страницу просмотра
                        async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
                            response = await client.get(view_url, headers=get_request_headers())
                            response.raise_for_status()
                            html_text = response.text
                            logger.debug(f"Загружена страница просмотра, размер HTML: {len(html_text)} символов")
                            
                            # Парсим оригинальное изображение со страницы просмотра
                            tree = HTMLParser(html_text)
                            original_url = None
                            
                            # Парсим описание и информацию об авторе
                            photo_info = parse_photo_info_from_view_page(html_text)
                            
                            # Сначала ищем gview_link с атрибутом g - там прямые URL изображений (публичные)
                            gview_link = tree.css_first('a.gview_link')
                            if gview_link:
                                # Проверяем атрибут g для URL большого размера (800x800 или 600x600)
                                g_attr = gview_link.attributes.get('g', '')
                                if g_attr:
                                    import re
                                    # В атрибуте g ищем URL с размером 800x800 (обычно последний большой размер)
                                    urls = re.findall(r'https?://[^\|]+\.(?:p|f)\.800\.800\.[^\|]+', g_attr)
                                    if not urls:
                                        # Если нет 800x800, ищем 600x600
                                        urls = re.findall(r'https?://[^\|]+\.(?:p|f)\.600\.600\.[^\|]+', g_attr)
                                    if urls:
                                        original_url = urls[-1]  # Берем последний (самый большой)
                                        logger.info(f"Найдено оригинальное изображение из gview_link.g (атрибут): {original_url}")
                            
                            # Если не нашли в g атрибуте, пробуем img.preview с большими размерами (публичные URL)
                            if not original_url:
                                img_elem = tree.css_first('img.preview.s800_800')
                                if not img_elem:
                                    img_elem = tree.css_first('img.preview[class*="s800"]')
                                if not img_elem:
                                    img_elem = tree.css_first('img.preview.s600_600')
                                if not img_elem:
                                    img_elem = tree.css_first('img.preview[class*="s600"]')
                                if not img_elem:
                                    img_elem = tree.css_first('img.preview')
                                
                                if img_elem:
                                    img_src = img_elem.attributes.get('src', '')
                                    if img_src:
                                        # Пробуем получить URL большего размера из srcset
                                        img_srcset = img_elem.attributes.get('srcset', '')
                                        if img_srcset:
                                            import re
                                            all_urls = re.findall(r'(https?://[^\s,]+)', img_srcset)
                                            if all_urls:
                                                original_url = all_urls[-1]  # Берем последний (самый большой)
                                                logger.info(f"Найдено оригинальное изображение из img.preview.srcset: {original_url}")
                                            else:
                                                original_url = img_src
                                                logger.info(f"Найдено оригинальное изображение из img.preview.src: {original_url}")
                                        else:
                                            original_url = img_src
                                            logger.info(f"Найдено оригинальное изображение из img.preview.src: {original_url}")
                                        
                                        # Если URL относительный, добавляем префикс
                                        if original_url and not original_url.startswith('http'):
                                            original_url = f"https://spaces.im{original_url}" if original_url.startswith('/') else f"https://spaces.im/{original_url}"
                            
                            # Если не нашли публичный URL изображения, НЕ используем URL скачивания
                            # так как Telegram не может получить содержимое по таким URL (требуются cookies)
                            if not original_url:
                                logger.warning("Не удалось найти оригинальное изображение на странице просмотра (публичный URL)")
                                logger.info("Пробуем использовать photo_url из кэша как fallback")
                                # Используем photo_url из кэша как последний вариант
                                cached_photo_url = picture.get('photo_url')
                                if cached_photo_url and cached_photo_url.startswith('http'):
                                    original_url = cached_photo_url
                                    logger.info(f"Используется photo_url из кэша: {original_url}")
                            
                            if original_url and original_url.startswith('http'):
                                # Если в InlineQueryResultPhoto нужно обновить photo_url, делаем это через chosen_inline_result
                                # Но Telegram уже отправил сообщение, так что нужно отредактировать его
                                try:
                                    if chosen_result.inline_message_id:
                                        # Формируем caption с запросом поиска, названием, описанием и автором
                                        search_query = picture.get('search_query', '')
                                        photo_title = picture.get('title', '')
                                        
                                        caption_parts = []
                                        
                                        if search_query:
                                            caption_parts.append(f"🔍 Поиск: {search_query}")
                                        
                                        if photo_title:
                                            caption_parts.append(f"📷 {photo_title}")
                                        
                                        # Сначала формируем блок автора для расчета длины
                                        author_text = ""
                                        if photo_info.get('author_name') or photo_info.get('author_date'):
                                            if photo_info.get('author_name'):
                                                author_text += f"👤 {photo_info['author_name']}"
                                            if photo_info.get('author_date'):
                                                if author_text:
                                                    author_text += f" ({photo_info['author_date']})"
                                                else:
                                                    author_text = f"📅 {photo_info['author_date']}"
                                        
                                        # Рассчитываем длину всех частей кроме описания
                                        base_length = sum([len(part) for part in caption_parts])
                                        if author_text:
                                            base_length += len(author_text) + 1  # +1 за \n
                                        base_length += len(caption_parts) - 1  # длина всех \n между частями
                                        
                                        # Максимальная длина описания с учетом всех остальных частей
                                        max_desc_length = 1024 - base_length - 4  # -4 для "\n" и "..."
                                        
                                        if photo_info.get('description'):
                                            description = photo_info['description']
                                            
                                            if max_desc_length > 0 and len(description) > max_desc_length:
                                                # Обрезаем описание, стараясь не резать по середине слова
                                                description = description[:max_desc_length - 3].rsplit(' ', 1)[0] + "..."
                                                logger.debug(f"Описание обрезано до {len(description)} символов (было {len(photo_info['description'])})")
                                            
                                            caption_parts.append(f"\n{description}")
                                        
                                        if author_text:
                                            # Форматируем автора жирным текстом через HTML
                                            author_text_formatted = f"<b>{author_text}</b>"
                                            caption_parts.append(author_text_formatted)
                                        
                                        caption = "\n".join(caption_parts) if caption_parts else photo_title or "Изображение"
                                        
                                        # Финальная проверка и обрезка до 1024 символов (лимит Telegram)
                                        if len(caption) > 1024:
                                            # Если все еще превышает, обрезаем жестко
                                            caption = caption[:1021] + "..."
                                            logger.debug("Caption финально обрезан до 1024 символов")
                                        
                                        # Создаем клавиатуру с кнопками
                                        keyboard_buttons = []
                                        
                                        # Кнопка "Найти еще"
                                        keyboard_buttons.append([InlineKeyboardButton(
                                            text="🔍 Найти еще",
                                            switch_inline_query_current_chat=f"-к1 {search_query}" if search_query else "-к1"
                                        )])
                                        
                                        # Кнопка со ссылкой на страницу фото
                                        view_url = picture.get('view_url')
                                        if view_url:
                                            keyboard_buttons.append([InlineKeyboardButton(
                                                text="📷 Страница фото",
                                                url=view_url
                                            )])
                                        
                                        # Кнопка "Перейти в бота"
                                        keyboard_buttons.append([InlineKeyboardButton(
                                            text="Перейти в бота",
                                            url="https://t.me/archigame_bot"
                                        )])
                                        
                                        keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                                        
                                        # Если это inline сообщение, обновляем его
                                        await bot.edit_message_media(
                                            inline_message_id=chosen_result.inline_message_id,
                                            media=InputMediaPhoto(
                                                media=original_url,
                                                caption=caption,
                                                parse_mode="HTML"
                                            ),
                                            reply_markup=keyboard
                                        )
                                        logger.info("Обновлено inline сообщение с оригинальным изображением и запросом поиска")
                                except Exception as edit_e:
                                    logger.error(f"Ошибка обновления inline сообщения: {edit_e}")
                            else:
                                logger.warning("Не найден валидный URL оригинального изображения")
                    except Exception as e:
                        logger.error(f"Ошибка получения оригинала картинки: {e}", exc_info=True)
                else:
                    if not view_url:
                        logger.warning(f"Картинка найдена в кэше, но отсутствует view_url для result_id: {result_id}")
                
                # НЕ удаляем картинку из кэша сразу - она может понадобиться снова
                # Кэш будет очищаться автоматически при перезапуске или при заполнении
                logger.debug(f"Обработка картинки завершена, но оставляем в кэше: {result_id}")
            else:
                logger.warning(f"Картинка не найдена в кэше для result_id: {result_id}")
                logger.debug(f"Доступные ключи в кэше: {list(picture_info_cache.keys())[:20]}")
        elif result_id.startswith('vid_'):
            # Это видео - проверяем что это действительно видео, а не фото
            logger.info("=== ОБРАБОТКА ВИДЕО ===")
            logger.info(f"result_id: {result_id}")
            logger.info(f"Доступные ключи в video_info_cache ({len(video_info_cache)}): {list(video_info_cache.keys())[:10]}")
            
            # Проверяем что это видео из кэша, а не фото по ошибке
            if result_id in picture_info_cache:
                logger.warning(f"⚠️ result_id {result_id} найден в picture_info_cache! Это должно быть видео!")
            
            video = video_info_cache.get(result_id)
            if video:
                video_name = video.get('name', 'Unknown')
                logger.info(f"Видео найдено в кэше: {video_name}")
                view_url = video.get('view_url')
                logger.info("=== ОБРАБОТКА ВЫБРАННОГО ВИДЕО ===")
                logger.info(f"Название: {video_name}")
                logger.info(f"Ссылка на страницу видео (view_url): {view_url}")
                if view_url:
                    
                    try:
                        # Загружаем страницу просмотра (как для фото)
                        async with httpx.AsyncClient(cookies=SPACES_COOKIES, timeout=30.0, follow_redirects=True) as client:
                            response = await client.get(view_url, headers=get_request_headers())
                            response.raise_for_status()
                            html_text = response.text
                            logger.debug(f"Загружена страница просмотра видео, размер HTML: {len(html_text)} символов")
                            
                            # Парсим URL скачивания и информацию о видео из уже загруженной страницы
                            video_info_result = get_video_download_url_from_html(html_text)
                            if video_info_result and video_info_result.get('download_url'):
                                raw_download_url = video_info_result['download_url']
                                logger.info(f"URL скачивания найден на странице: {raw_download_url}")
                                
                                # Получаем финальный URL после редиректов (как для музыки)
                                logger.info(f"Исходный URL скачивания (с сайта): {raw_download_url}")
                                logger.info("Обрабатываю редиректы...")
                                
                                # Проверяем, что URL валидный и содержит .mp4 или /video/
                                if raw_download_url and ('.mp4' in raw_download_url.lower() or '/video/' in raw_download_url.lower()):
                                    download_url = await get_final_download_url(raw_download_url)
                                    logger.info("=== ФИНАЛЬНЫЕ ССЫЛКИ ===")
                                    logger.info(f"Ссылка на страницу видео (view_url): {view_url}")
                                    logger.info(f"Прямая ссылка на видео файл (download_url): {download_url}")
                                    logger.info("=========================")
                                    
                                    # Проверяем что финальный URL тоже валидный
                                    if not download_url or download_url == raw_download_url:
                                        logger.warning(f"URL не изменился после редиректов, возможно уже прямой: {download_url}")
                                        if not download_url:
                                            download_url = raw_download_url
                                else:
                                    logger.warning(f"Некорректный URL скачивания: {raw_download_url}")
                                    download_url = None
                                
                                # Выводим ссылки в консоль для отладки
                                print(f"\n{'='*60}")
                                print(f"ВЫБРАНО ВИДЕО: {video_name}")
                                print(f"{'='*60}")
                                print(f"Ссылка на страницу видео: {view_url}")
                                print(f"Прямая ссылка на видео файл: {download_url}")
                                print(f"{'='*60}\n")
                                
                                # Обновляем информацию в кэше
                                video['download_url'] = download_url
                                if video_info_result.get('description'):
                                    video['description'] = video_info_result['description']
                                if video_info_result.get('author_name'):
                                    video['author_name'] = video_info_result['author_name']
                                if video_info_result.get('author_date'):
                                    video['author_date'] = video_info_result['author_date']
                                
                                # Если это inline сообщение, обновляем его
                                if chosen_result.inline_message_id:
                                    try:
                                        search_query = video.get('search_query', '')
                                        video_title = video.get('name', '')
                                        
                                        caption_parts = []
                                        
                                        if search_query:
                                            caption_parts.append(f"🔍 Поиск: {search_query}")
                                        
                                        if video_title:
                                            caption_parts.append(f"📹 {video_title}")
                                        
                                        description = video.get('description')
                                        if description:
                                            caption_parts.append(f"\n{description}")
                                        
                                        # Формируем блок автора
                                        author_text = ""
                                        if video.get('author_name'):
                                            author_text += f"👤 {video['author_name']}"
                                        if video.get('author_date'):
                                            if author_text:
                                                author_text += f" ({video['author_date']})"
                                            else:
                                                author_text = f"📅 {video['author_date']}"
                                        
                                        if author_text:
                                            author_text_formatted = f"<b>{author_text}</b>"
                                            caption_parts.append(author_text_formatted)
                                        
                                        caption = "\n".join(caption_parts) if caption_parts else video_title or "Видео"
                                        
                                        # Умная обрезка с учетом лимита 1024 символа
                                        if len(caption) > 1024:
                                            # Сначала пытаемся обрезать описание
                                            if description:
                                                # Считаем базовую длину без описания
                                                other_parts = [p for p in caption_parts if not (p.startswith('\n') and p.endswith(description))]
                                                base_caption = "\n".join(other_parts)
                                                base_len = len(base_caption)
                                                
                                                # Сколько места осталось для описания
                                                max_desc_len = 1024 - base_len - 5  # -5 для "\n" и "..."
                                                if max_desc_len > 50:
                                                    description = description[:max_desc_len - 3].rsplit(' ', 1)[0] + "..."
                                                    # Обновляем описание в caption_parts
                                                    for idx, part in enumerate(caption_parts):
                                                        if part.startswith('\n') and description in part:
                                                            caption_parts[idx] = f"\n{description}"
                                                            break
                                                    caption = "\n".join(caption_parts)
                                            
                                            # Финальная проверка
                                            if len(caption) > 1024:
                                                caption = caption[:1021] + "..."
                                            logger.debug("Caption обрезан до 1024 символов")
                                        
                                        keyboard_buttons = []
                                        
                                        # Кнопка "Найти еще"
                                        keyboard_buttons.append([InlineKeyboardButton(
                                            text="🔍 Найти еще",
                                            switch_inline_query_current_chat=f"-в1 {search_query}" if search_query else "-в1"
                                        )])
                                        
                                        # Кнопка со ссылкой на страницу видео
                                        if view_url:
                                            keyboard_buttons.append([InlineKeyboardButton(
                                                text="📹 Страница видео",
                                                url=view_url
                                            )])
                                        
                                        # Кнопка "Перейти в бота"
                                        keyboard_buttons.append([InlineKeyboardButton(
                                            text="Перейти в бота",
                                            url="https://t.me/archigame_bot"
                                        )])
                                        
                                        keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                                        
                                        logger.info(f"Обновляю inline сообщение видео: download_url={download_url[:100] if download_url else 'None'}...")
                                        
                                        if download_url and download_url.startswith('http'):
                                            # Сначала пробуем отправить по URL (быстро, если работает)
                                            try:
                                                await bot.edit_message_media(
                                                    inline_message_id=chosen_result.inline_message_id,
                                                    media=InputMediaVideo(
                                                        media=download_url,
                                                        caption=caption,
                                                        parse_mode="HTML"
                                                    ),
                                                    reply_markup=keyboard
                                                )
                                                logger.info(f"✅ Обновлено inline сообщение с прямым URL видео: {download_url[:80]}...")
                                            except Exception as edit_error:
                                                # Не получилось по URL - скачиваем, отправляем в чат, получаем file_id
                                                logger.warning(f"❌ Не удалось отправить видео по URL: {edit_error}")
                                                logger.info("Скачиваю видео для отправки в чат и получения file_id...")
                                                
                                                # Скачиваем видео локально
                                                video_path = await download_video_to_file(download_url, max_size_mb=50)
                                                
                                                if video_path:
                                                    try:
                                                        abs_video_path = os.path.abspath(video_path)
                                                        if not os.path.exists(abs_video_path):
                                                            raise FileNotFoundError(f"Файл не найден: {abs_video_path}")
                                                        
                                                        # Отправляем видео в чат для получения file_id
                                                        logger.info(f"Отправляю видео в чат -4925334563...")
                                                        video_file = FSInputFile(abs_video_path, filename=f"{video_title[:50]}.mp4")
                                                        sent_message = await bot.send_video(
                                                            chat_id=-4925334563,
                                                            video=video_file,
                                                            caption=caption,
                                                            parse_mode="HTML"
                                                        )
                                                        
                                                        # Получаем file_id из отправленного сообщения
                                                        video_file_id = sent_message.video.file_id
                                                        logger.info(f"✅ Видео отправлено в чат, получен file_id: {video_file_id[:20]}...")
                                                        
                                                        # Используем file_id для редактирования inline сообщения
                                                        await bot.edit_message_media(
                                                            inline_message_id=chosen_result.inline_message_id,
                                                            media=InputMediaVideo(
                                                                media=video_file_id,
                                                                caption=caption,
                                                                parse_mode="HTML"
                                                            ),
                                                            reply_markup=keyboard
                                                        )
                                                        logger.info("✅ Обновлено inline сообщение с видео через file_id")
                                                        
                                                        # Удаляем временный файл
                                                        try:
                                                            os.unlink(abs_video_path)
                                                            logger.debug(f"Временный файл удален: {abs_video_path}")
                                                        except Exception as del_error:
                                                            logger.warning(f"Не удалось удалить временный файл {abs_video_path}: {del_error}")
                                                        
                                                    except Exception as file_error:
                                                        logger.error(f"❌ Ошибка отправки видео в чат или редактирования: {file_error}", exc_info=True)
                                                        # Удаляем файл при ошибке
                                                        try:
                                                            abs_video_path = os.path.abspath(video_path) if video_path else None
                                                            if abs_video_path and os.path.exists(abs_video_path):
                                                                os.unlink(abs_video_path)
                                                                logger.debug(f"Временный файл удален после ошибки: {abs_video_path}")
                                                        except Exception as del_error:
                                                            logger.warning(f"Не удалось удалить временный файл: {del_error}")
                                                        
                                                        # Fallback - обновляем текст
                                                        try:
                                                            message_text = f"{caption}\n\n📹 <a href='{view_url}'>Смотреть видео</a>"
                                                            await bot.edit_message_text(
                                                                inline_message_id=chosen_result.inline_message_id,
                                                                text=message_text,
                                                                parse_mode="HTML",
                                                                reply_markup=keyboard
                                                            )
                                                            logger.info("Обновлено сообщение Article с текстом и кнопкой (fallback)")
                                                        except Exception as text_error:
                                                            logger.error(f"❌ Ошибка обновления текста Article: {text_error}")
                                                else:
                                                    logger.warning("Не удалось скачать видео для отправки в чат")
                                                    # Fallback - обновляем текст
                                                    try:
                                                        message_text = f"{caption}\n\n📹 <a href='{view_url}'>Смотреть видео</a>"
                                                        await bot.edit_message_text(
                                                            inline_message_id=chosen_result.inline_message_id,
                                                            text=message_text,
                                                            parse_mode="HTML",
                                                            reply_markup=keyboard
                                                        )
                                                        logger.info("Обновлено сообщение Article с текстом и кнопкой (fallback)")
                                                    except Exception as text_error:
                                                        logger.error(f"❌ Ошибка обновления текста Article: {text_error}")
                                        else:
                                            logger.warning("⚠️ Не удалось получить валидный download_url для обновления видео")
                                            logger.warning(f"download_url: {download_url}")
                                    except Exception as edit_e:
                                        logger.error(f"Ошибка обновления inline сообщения видео: {edit_e}")
                            else:
                                logger.warning("Не удалось получить URL скачивания для видео")
                    except Exception as e:
                        logger.error(f"Ошибка получения URL скачивания видео: {e}", exc_info=True)
                else:
                    logger.warning(f"Видео найдено в кэше, но отсутствует view_url для result_id: {result_id}")
            else:
                logger.warning(f"Видео не найдено в кэше для result_id: {result_id}")
            
            # Удаляем из кэша после обработки
            if result_id in video_info_cache:
                del video_info_cache[result_id]
        else:
            # Это трек - получаем финальный URL для скачивания и обновляем сообщение
            track = track_info_cache.get(result_id)
            
            if track and track.get('url'):
                track_url = track['url']
                track_name = track.get('name', 'Unknown')
                track_category = track.get('category', '')
                logger.info(f"Выбран трек: {track_name}, URL: {track_url[:80]}...")
                
                # Получаем финальный URL после редиректов
                try:
                    final_url = await get_final_download_url(track_url)
                    if final_url != track_url:
                        logger.info(f"Финальный URL получен: {final_url[:80]}...")
                        track['url'] = final_url
                    
                    # Обновляем сообщение с финальным URL, если это inline сообщение
                    if chosen_result.inline_message_id and final_url:
                        try:
                            # Формируем caption
                            caption = f"🎵 {track_name}"
                            if track_category:
                                caption += f"\n📁 {track_category}"
                            
                            # Формируем клавиатуру
                            keyboard_buttons = []
                            query = chosen_result.query or ""
                            if query.startswith('-м1') or query.startswith('-м1 '):
                                search_query = query.replace('-м1', '').strip()
                                if search_query:
                                    keyboard_buttons.append([InlineKeyboardButton(
                                        text="🔍 Найти еще",
                                        switch_inline_query_current_chat=f"-м1 {search_query}"
                                    )])
                            else:
                                if track_category:
                                    keyboard_buttons.append([InlineKeyboardButton(
                                        text="🔍 Найти еще",
                                        switch_inline_query_current_chat=query if query else ""
                                    )])
                            
                            keyboard_buttons.append([InlineKeyboardButton(
                                text="Перейти в бота",
                                url="https://t.me/archigame_bot"
                            )])
                            
                            keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
                            
                            # Обновляем сообщение с финальным URL
                            await bot.edit_message_media(
                                inline_message_id=chosen_result.inline_message_id,
                                media=InputMediaAudio(
                                    media=final_url,
                                    title=track_name,
                                    caption=caption
                                ),
                                reply_markup=keyboard
                            )
                            logger.info(f"✅ Обновлено inline сообщение трека с финальным URL: {final_url[:80]}...")
                        except Exception as edit_e:
                            logger.error(f"Ошибка обновления inline сообщения трека: {edit_e}", exc_info=True)
                except Exception as e:
                    logger.warning(f"Ошибка получения финального URL: {e}")
            
            if result_id in track_info_cache:
                del track_info_cache[result_id]
        
    except Exception as e:
        logger.error(f"Ошибка в chosen_inline_result_handler: {e}", exc_info=True)




async def main():
    """Запуск бота"""
    logger.info("Запуск бота для случайной музыки...")
    load_categories_from_json()
    logger.info("Бот готов к работе")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

