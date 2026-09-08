import fs from 'fs';
import puppeteer, { Browser } from 'puppeteer-core';
import prisma from '@/lib/db';

export interface AdLibraryAd {
  id: string;
  adLibraryId: string;
  pageId?: string;
  pageName: string;
  pageProfileUrl?: string;
  primaryText: string;
  linkTitle?: string;
  linkCaption?: string;
  linkDescription?: string;
  startDate?: string;
  formattedStartDate?: string;
  daysActive?: number;
  daysActiveLabel?: string;
  status: 'ACTIVE' | 'INACTIVE';
  ctaText?: string;
  ctaType?: 'MESSENGER' | 'WHATSAPP' | 'PURCHASE' | 'LEADS' | 'WEBSITE' | 'CALL' | 'APP' | 'NO_BUTTON';
  ctaLabel?: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'TEXT';
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  snapshotUrl: string;
  publisherPlatforms: string[];
  country: string;
  query: string;
}

export interface AdLibrarySearchOptions {
  query: string;
  country?: string;
  activeStatus?: 'ACTIVE' | 'ALL' | 'INACTIVE';
  mediaType?: 'ALL' | 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  publisherPlatforms?: string[];
  searchType?: 'KEYWORD_UNORDERED' | 'KEYWORD_EXACT_PHRASE';
  limit?: number;
  useQueryVariants?: boolean;
}

export function cleanAndDeduplicateAdText(rawLines: string[]): string {
  const cleanLines: string[] = [];
  const seenLines = new Set<string>();
  let hasLink = false;

  const skipKeywords = [
    '0:00 / 0:00', '0:00', 'See Less', 'See More', 'عرض المزيد', 'عرض أقل',
    'Shop now', 'Order Now', 'Learn more', 'Sign up', 'Apply now', 'Book now',
    'تسوق الآن', 'اطلب الآن', 'تعرف على المزيد', 'سجل الآن', 'احجز الآن',
    'إرسال رسالة', 'Send message', 'Send WhatsApp', 'إرسال رسالة على WhatsApp',
    'Open Drop-down', 'Sponsored', 'مُموَّل',
  ];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line || line.length < 2) continue;
    if (line.startsWith('0:')) continue;
    if (skipKeywords.includes(line)) continue;

    // Handle URLs: Allow only 1 unique URL in the body text
    if (line.toLowerCase().startsWith('http://') || line.toLowerCase().startsWith('https://')) {
      if (hasLink) continue;
      hasLink = true;
      cleanLines.push(line);
      continue;
    }

    // Deduplicate repeated sentences/paragraphs across carousel slides
    const normalized = line.toLowerCase().replace(/\s+/g, ' ');
    if (seenLines.has(normalized)) {
      continue;
    }
    seenLines.add(normalized);
    cleanLines.push(line);
  }

  return cleanLines.join('\n');
}

export function parseAdStartDateAndDuration(dateText?: string): { formattedDate: string; daysCount: number; label: string } {
  if (!dateText || dateText === 'نشط حالياً' || dateText.includes('نشط')) {
    return { formattedDate: 'نشط حالياً', daysCount: 1, label: 'شغال حالياً 🔥' };
  }

  // Convert Eastern Arabic numerals (٠-٩) to English numerals (0-9)
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const clean = String(dateText).trim().replace(/[٠-٩]/g, (w) => String(arabicDigits.indexOf(w)));

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    يناير: 0, فبراير: 1, مارس: 2, أبريل: 3, ابريل: 3, مايو: 4, يونيو: 5, يوليو: 6, أغسطس: 7, اغسطس: 7, سبتمبر: 8, أكتوبر: 9, اكتوبر: 9, نوفمبر: 10, ديسمبر: 11
  };

  const match = clean.match(/(\d{1,2})\s+([A-Za-z\u0621-\u064A]+)\s+(\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase().slice(0, 3);
    const year = parseInt(match[3], 10);

    let monthIdx = monthMap[monthStr];
    if (monthIdx === undefined) {
      for (const [k, v] of Object.entries(monthMap)) {
        if (match[2].toLowerCase().includes(k)) {
          monthIdx = v;
          break;
        }
      }
    }
    if (monthIdx === undefined) monthIdx = 0;

    const adDate = new Date(year, monthIdx, day);
    const today = new Date();
    const formattedDate = `${String(day).padStart(2, '0')}/${String(monthIdx + 1).padStart(2, '0')}/${year}`;

    const diffTime = today.getTime() - adDate.getTime();
    let daysCount = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (daysCount < 0) {
      daysCount = Math.abs(daysCount % 365) || 1;
    }

    let label = '';
    if (daysCount === 0) label = 'شغال من النهاردة 🔥';
    else if (daysCount === 1) label = 'شغال من يوم واحد';
    else if (daysCount === 2) label = 'شغال من يومين';
    else if (daysCount >= 3 && daysCount <= 10) label = `شغال بقاله ${daysCount} أيام`;
    else label = `شغال بقاله ${daysCount} يوم`;

    return { formattedDate, daysCount, label };
  }

  // Fallback pattern matching for DD-MM-YYYY or YYYY-MM-DD
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const month = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    const year = dmyMatch[3];
    return { formattedDate: `${day}/${month}/${year}`, daysCount: 1, label: 'نشط حالياً' };
  }

  return { formattedDate: clean || 'نشط حالياً', daysCount: 1, label: 'نشط حالياً' };
}

export function detectCtaType(text: string = '', buttons: string[] = [], links: string[] = []): {
  type: 'MESSENGER' | 'WHATSAPP' | 'PURCHASE' | 'LEADS' | 'WEBSITE' | 'CALL' | 'APP' | 'NO_BUTTON';
  label: string;
} {
  const allContent = (text + ' ' + buttons.join(' ') + ' ' + links.join(' ')).toLowerCase();

  if (
    allContent.includes('whatsapp') ||
    allContent.includes('واتساب') ||
    allContent.includes('واتس اب') ||
    allContent.includes('wa.me') ||
    allContent.includes('send whatsapp') ||
    allContent.includes('إرسال رسالة على whatsapp')
  ) {
    return { type: 'WHATSAPP', label: 'رسائل واتساب' };
  }

  if (
    allContent.includes('send message') ||
    allContent.includes('إرسال رسالة') ||
    allContent.includes('رسائل') ||
    allContent.includes('messenger') ||
    allContent.includes('m.me')
  ) {
    return { type: 'MESSENGER', label: 'رسائل ماسنجر' };
  }

  if (
    allContent.includes('shop now') ||
    allContent.includes('تسوق الآن') ||
    allContent.includes('order now') ||
    allContent.includes('اطلب الآن') ||
    allContent.includes('buy now') ||
    allContent.includes('اشتري الآن') ||
    allContent.includes('myeasyorders') ||
    allContent.includes('shopify') ||
    allContent.includes('cart')
  ) {
    return { type: 'PURCHASE', label: 'طلب شراء / متجر' };
  }

  if (
    allContent.includes('sign up') ||
    allContent.includes('تسجيل') ||
    allContent.includes('apply now') ||
    allContent.includes('قدم الآن') ||
    allContent.includes('book now') ||
    allContent.includes('احجز الآن')
  ) {
    return { type: 'LEADS', label: 'تسجيل بيانات (Leads)' };
  }

  if (
    allContent.includes('call now') ||
    allContent.includes('اتصل الآن') ||
    allContent.includes('كلمنا على') ||
    allContent.includes('15477') ||
    /01[0125]\d{8}/.test(allContent)
  ) {
    return { type: 'CALL', label: 'اتصال هاتفي' };
  }

  if (
    allContent.includes('download') ||
    allContent.includes('install') ||
    allContent.includes('تحميل') ||
    allContent.includes('play.google.com') ||
    allContent.includes('apps.apple.com')
  ) {
    return { type: 'APP', label: 'تنزيل تطبيق' };
  }

  if (
    allContent.includes('learn more') ||
    allContent.includes('تعرف على المزيد') ||
    allContent.includes('زيارة') ||
    allContent.includes('http')
  ) {
    return { type: 'WEBSITE', label: 'زيارة الموقع' };
  }

  return { type: 'NO_BUTTON', label: 'بدون زر تفاعلي' };
}

export function generateQueryVariants(query: string): string[] {
  const clean = query.trim();
  if (!clean) return [];

  const variants = new Set<string>();
  variants.add(clean);

  if (/iphone\s*17/i.test(clean)) {
    variants.add('iPhone 17');
    variants.add('ايفون 17');
    variants.add('آيفون 17');
  } else if (/iphone\s*16/i.test(clean)) {
    variants.add('iPhone 16');
    variants.add('ايفون 16');
    variants.add('آيفون 16');
  } else if (/iphone\s*15/i.test(clean)) {
    variants.add('iPhone 15');
    variants.add('ايفون 15');
    variants.add('آيفون 15');
  } else if (/تسويق/i.test(clean) || /marketing/i.test(clean)) {
    variants.add('تسويق');
    variants.add('اعلانات ممولة');
    variants.add('شركة تسويق');
  } else if (/عقارات/i.test(clean) || /real\s*estate/i.test(clean)) {
    variants.add('عقارات');
    variants.add('شقق للبيع');
    variants.add('كمبوند');
  } else if (/ملابس/i.test(clean) || /fashion/i.test(clean)) {
    variants.add('ملابس');
    variants.add('ازياء');
    variants.add('فساتين');
  } else if (/عيادة/i.test(clean) || /اسنان/i.test(clean) || /dental/i.test(clean)) {
    variants.add('عيادة');
    variants.add('اسنان');
    variants.add('تجميل');
  }

  return Array.from(variants).slice(0, 4);
}

export function parseCompetitorPageInput(input: string): { isPageUrl: boolean; pageQuery: string } {
  const trimmed = input.trim();
  if (trimmed.includes('facebook.com') || trimmed.includes('fb.com') || trimmed.startsWith('http')) {
    try {
      const urlObj = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed);
      const idParam = urlObj.searchParams.get('id');
      if (idParam && /^\d+$/.test(idParam)) {
        return { isPageUrl: true, pageQuery: idParam };
      }
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        if (!['profile.php', 'pages', 'p', 'watch', 'groups'].includes(lastPart)) {
          return { isPageUrl: true, pageQuery: lastPart.replace(/[-_.]/g, ' ') };
        }
      }
    } catch (e) {}
  }
  return { isPageUrl: false, pageQuery: trimmed };
}

export function resolveChromeExecutable(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : '',
      process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` : '',
      process.env['PROGRAMFILES(X86)'] ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe` : '',
    ].filter(Boolean);

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (process.platform === 'linux') {
    const linuxCandidates = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ];
    for (const c of linuxCandidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (process.platform === 'darwin') {
    const macCandidate = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(macCandidate)) return macCandidate;
  }

  return undefined;
}

export class MetaAdLibraryEngine {
  private async launchBrowser(): Promise<Browser> {
    const executablePath = resolveChromeExecutable();
    return puppeteer.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1400,900',
      ],
    });
  }

  async searchAds(options: AdLibrarySearchOptions): Promise<{ ads: AdLibraryAd[]; metaEstimatedTotal?: string }> {
    const {
      query,
      country = 'EG',
      activeStatus = 'ACTIVE',
      mediaType = 'ALL',
      limit = 50,
    } = options;

    if (!query || query.trim().length < 2) {
      return { ads: [] };
    }

    const { pageQuery } = parseCompetitorPageInput(query);
    const searchTerm = pageQuery || query;

    console.log(`[MetaAdLibraryEngine] Searching Live Ad Library for "${searchTerm}" (${country}, Status: ${activeStatus}, TargetLimit: ${limit})...`);
    const { ads: liveAds, metaEstimatedTotal } = await this.scrapeLiveAdLibrary({
      searchTerm,
      country,
      activeStatus,
      mediaType,
      limit,
    });

    if (liveAds.length > 0) {
      console.log(`[MetaAdLibraryEngine] Successfully extracted ${liveAds.length} real live ads from Ad Library (Meta Total: ${metaEstimatedTotal || 'غير محدد'})`);
      await this.persistAdsToDatabase(searchTerm, country, liveAds);
      return { ads: liveAds, metaEstimatedTotal };
    }

    return { ads: [], metaEstimatedTotal };
  }

  private async scrapeLiveAdLibrary(params: {
    searchTerm: string;
    country: string;
    activeStatus: string;
    mediaType: string;
    limit: number;
  }): Promise<{ ads: AdLibraryAd[]; metaEstimatedTotal?: string }> {
    let browser: Browser | null = null;
    try {
      browser = await this.launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1400, height: 900 });

      const activeStatusParam = params.activeStatus === 'ACTIVE' ? 'active' : 'all';
      const targetUrl = 'https://www.facebook.com/ads/library/?active_status=' + activeStatusParam + '&ad_type=all&country=' + params.country + '&is_targeted_country=false&media_type=' + params.mediaType.toLowerCase() + '&q=' + encodeURIComponent(params.searchTerm) + '&search_type=keyword_unordered';

      console.log('[MetaAdLibraryEngine] Navigating to: ' + targetUrl);
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });

      // Initial wait for first batch of cards to render
      await new Promise((r) => setTimeout(r, 3500));

      // Extract Meta's approximate total results badge (e.g. "19,000 نتيجة تقريباً" or "~19,000 results")
      let metaEstimatedTotal = '';
      try {
        metaEstimatedTotal = await page.evaluate(() => {
          const allEls = Array.from(document.querySelectorAll('div, span, p, h1, h2, h3, h4'));
          for (const el of allEls) {
            if (el.children.length <= 1) {
              const txt = ((el as HTMLElement).innerText || el.textContent || '').trim();
              if (
                (txt.includes('نتيجة تقريباً') || txt.includes('نتائج تقريباً') || txt.includes('results') || txt.includes('result')) &&
                /\d+/.test(txt) &&
                txt.length < 150
              ) {
                const firstLine = txt.split('\n')[0].trim();
                return firstLine;
              }
            }
          }
          return '';
        });
      } catch (e) {}

      // ── Deep Adaptive Multi-Scroll (Loads 50 to 150+ ads on demand) ──
      const targetLimit = Math.max(params.limit || 50, 40);
      const maxScrolls = Math.min(Math.max(Math.ceil(targetLimit / 5), 8), 30);
      let previousCardCount = 0;
      let noProgressCount = 0;

      for (let scrollStep = 1; scrollStep <= maxScrolls; scrollStep++) {
        // Scroll down to the bottom of the document
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });

        // Wait for Meta GraphQL batch to load
        await new Promise((r) => setTimeout(r, 1800));

        // Count current loaded cards in DOM
        const currentCount = await page.evaluate(() => {
          const allEls = Array.from(document.querySelectorAll('*'));
          return allEls.filter((el) => {
            const t = (el as HTMLElement).innerText || el.textContent || '';
            return el.children.length === 0 && (t.includes('Library ID:') || t.includes('معرّف المكتبة:'));
          }).length;
        });

        console.log(`[MetaAdLibraryEngine] Deep Scroll #${scrollStep}/${maxScrolls}: ${currentCount} cards loaded (target: ${targetLimit})`);

        if (currentCount >= targetLimit) {
          break;
        }

        if (currentCount === previousCardCount) {
          noProgressCount++;
          // Trigger lazy load with a small jump up and back down
          if (noProgressCount >= 2) {
            await page.evaluate(() => {
              window.scrollBy(0, -600);
            });
            await new Promise((r) => setTimeout(r, 800));
            await page.evaluate(() => {
              window.scrollTo(0, document.body.scrollHeight);
            });
            await new Promise((r) => setTimeout(r, 2200));
          }
          if (noProgressCount >= 4) {
            console.log(`[MetaAdLibraryEngine] Reached end of available DOM feed at ${currentCount} cards`);
            break;
          }
        } else {
          noProgressCount = 0;
        }

        previousCardCount = currentCount;
      }

      // Expand all "See more" / "عرض المزيد" in the DOM before reading text
      await page.evaluate(() => {
        const clickables = Array.from(document.querySelectorAll('div[role="button"], span, a, button'));
        for (const el of clickables) {
          const txt = ((el as HTMLElement).innerText || el.textContent || '').trim();
          if (txt === 'See more' || txt === 'عرض المزيد' || txt === 'See More' || txt === 'عرض المزيد...') {
            try {
              (el as HTMLElement).click();
            } catch (e) {}
          }
        }
      });
      await new Promise((r) => setTimeout(r, 1000));

      const extractedCards = await page.evaluate((searchTerm: string, country: string, activeStatusParam: string) => {
        const adsList: any[] = [];
        const seenIds = new Set<string>();

        // Find all leaf elements that contain "Library ID:" or "معرّف المكتبة:"
        const allElements = Array.from(document.querySelectorAll('*'));
        const idElements = allElements.filter(el => {
          const t = (el as HTMLElement).innerText || el.textContent || '';
          return el.children.length === 0 && (t.includes('Library ID:') || t.includes('معرّف المكتبة:'));
        });

        for (const idEl of idElements) {
          const match = ((idEl as HTMLElement).innerText || idEl.textContent || '').match(/(?:Library ID|معرّف المكتبة):\s*(\d{10,20})/i);
          if (!match) continue;
          const adId = match[1];
          if (seenIds.has(adId)) continue;

          // Ascend to the individual card container
          let container: HTMLElement | null = idEl.parentElement;
          for (let i = 0; i < 10; i++) {
            if (!container) break;
            const text = container.innerText || '';
            const idMatches = text.match(/(?:Library ID|معرّف المكتبة):\s*(\d{10,20})/gi) || [];
            if ((text.includes('Sponsored') || text.includes('مُموَّل')) && idMatches.length === 1) {
              break;
            }
            if (idMatches.length > 1) {
              container = (container.children[0] as HTMLElement) || container;
              break;
            }
            container = container.parentElement;
          }

          if (!container) continue;

          const cardText = container.innerText || '';

          // Filter inactive if active is requested
          const isInactive = cardText.includes('Inactive') || cardText.includes('غير نشط');
          if (activeStatusParam === 'active' && isInactive) {
            continue;
          }

          seenIds.add(adId);

          const dateMatch = cardText.match(/(?:Started running on|بدأ التشغيل في)\s*([^\n\r]+)/i) || cardText.match(/(\d{1,2}\s+[A-Za-z\u0621-\u064A]+\s+\d{4})/);
          const startDate = dateMatch ? dateMatch[1].trim() : 'نشط حالياً';

          // Extract Page Name (line right before Sponsored / مُموَّل)
          const lines = cardText.split('\n').map((l: string) => l.trim()).filter(Boolean);
          let pageName = searchTerm;
          let rawBodyLines: string[] = [];

          const sponsoredIdx = lines.findIndex((l: string) => l === 'Sponsored' || l === 'مُموَّل' || l.includes('Sponsored') || l.includes('مُموَّل'));
          if (sponsoredIdx > 0) {
            pageName = lines[sponsoredIdx - 1];
            rawBodyLines = lines.slice(sponsoredIdx + 1);
          } else {
            const skipWords = ['Library ID', 'معرّف المكتبة', 'Platforms', 'المنصات', 'Open Drop-down', 'Active', 'نشط', 'Inactive', 'غير نشط'];
            const filtered = lines.filter((l: string) => !skipWords.some(sw => l.includes(sw)));
            pageName = filtered[0] || searchTerm;
            rawBodyLines = filtered.slice(1);
          }

          // Direct Page Profile Link from Anchors
          let pageProfileUrl = '';
          const pageLink = container.querySelector('a[href*="facebook.com/"], a[href*="fb.com/"]');
          if (pageLink) {
            const href = (pageLink as HTMLAnchorElement).href;
            if (!href.includes('/ads/library') && !href.includes('/about/')) {
              pageProfileUrl = href;
            }
          }

          // Extract All Images inside this card container
          const allImgs = Array.from(container.querySelectorAll('img')).map(img => ({
            src: (img as HTMLImageElement).src,
            alt: (img as HTMLImageElement).alt,
            width: (img as HTMLImageElement).naturalWidth || (img as HTMLImageElement).width || (img as HTMLElement).clientWidth,
            height: (img as HTMLImageElement).naturalHeight || (img as HTMLImageElement).height || (img as HTMLElement).clientHeight,
          }));

          // Strict filter: exclude 30x30 / 50x50 page avatars
          const creativeImgs = allImgs.filter(img => {
            if (!img.src || !img.src.includes('fbcdn.net')) return false;
            if (img.width > 0 && img.width <= 50 && img.height > 0 && img.height <= 50) return false;
            if (pageName && img.alt === pageName && img.width <= 60) return false;
            return true;
          });

          // Video tag check
          const videoEl = container.querySelector('video');
          let videoSrc = '';
          let videoPoster = '';
          if (videoEl) {
            videoSrc = (videoEl as HTMLVideoElement).src || (videoEl as HTMLVideoElement).getAttribute('src') || '';
            videoPoster = (videoEl as HTMLVideoElement).poster || '';
          }

          // Determine final main creative image and carousel images
          let mainImage = '';
          const creativeUrls: string[] = [];

          if (creativeImgs.length > 0) {
            creativeImgs.forEach(ci => {
              if (ci.src && !creativeUrls.includes(ci.src)) {
                creativeUrls.push(ci.src);
              }
            });
            mainImage = creativeUrls[0] || '';
          } else if (videoPoster) {
            mainImage = videoPoster;
          }

          // Buttons and Links for CTA detection
          const buttonsList = Array.from(container.querySelectorAll('div[role="button"], button, a[role="button"]')).map(b => ((b as HTMLElement).innerText || b.textContent || '').trim()).filter(Boolean);
          const linksList = Array.from(container.querySelectorAll('a')).map(a => (a as HTMLAnchorElement).href + ' ' + ((a as HTMLElement).innerText || a.textContent || ''));

          adsList.push({
            adLibraryId: adId,
            pageName: pageName || searchTerm,
            pageProfileUrl: pageProfileUrl || ('https://www.facebook.com/search/pages/?q=' + encodeURIComponent(pageName || searchTerm)),
            rawBodyLines,
            startDate,
            status: isInactive ? 'INACTIVE' : 'ACTIVE',
            mediaType: videoEl ? 'VIDEO' : (creativeUrls.length > 1 ? 'CAROUSEL' : 'IMAGE'),
            imageUrl: mainImage || undefined,
            images: creativeUrls.length > 0 ? creativeUrls : (mainImage ? [mainImage] : []),
            videoUrl: videoSrc || undefined,
            snapshotUrl: 'https://www.facebook.com/ads/library/?id=' + adId,
            publisherPlatforms: ['Facebook', 'Instagram'],
            buttonsList,
            linksList,
            country,
            query: searchTerm,
          });
        }

        return adsList;
      }, params.searchTerm, params.country, activeStatusParam);

      const mappedAds = extractedCards.slice(0, params.limit).map((ad: any, idx: number) => {
        const { formattedDate, daysCount, label: daysActiveLabel } = parseAdStartDateAndDuration(ad.startDate);
        const cleanText = cleanAndDeduplicateAdText(ad.rawBodyLines);
        const { type: ctaType, label: ctaLabel } = detectCtaType(cleanText, ad.buttonsList, ad.linksList);

        return {
          id: 'live_' + ad.adLibraryId + '_' + idx,
          adLibraryId: ad.adLibraryId,
          pageName: ad.pageName,
          pageProfileUrl: ad.pageProfileUrl,
          primaryText: cleanText.slice(0, 4000),
          startDate: ad.startDate,
          formattedStartDate: formattedDate,
          daysActive: daysCount,
          daysActiveLabel,
          status: ad.status,
          ctaType,
          ctaLabel,
          mediaType: ad.mediaType,
          imageUrl: ad.imageUrl,
          images: ad.images || (ad.imageUrl ? [ad.imageUrl] : []),
          videoUrl: ad.videoUrl,
          snapshotUrl: ad.snapshotUrl,
          publisherPlatforms: ad.publisherPlatforms,
          country: ad.country,
          query: ad.query,
        };
      });

      return {
        ads: mappedAds,
        metaEstimatedTotal: metaEstimatedTotal || (mappedAds.length > 0 ? `~${mappedAds.length}+ إعلان` : undefined),
      };
    } catch (err) {
      console.error('[MetaAdLibraryEngine] Live scraping error:', err);
      return { ads: [] };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async persistAdsToDatabase(searchTerm: string, country: string, ads: AdLibraryAd[]) {
    try {
      let workspace = await prisma.workspace.findFirst();
      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: {
            name: 'مساحة العمل الرئيسية',
            slug: 'default-workspace',
          },
        });
      }

      const searchRun = await prisma.adSearchRun.create({
        data: {
          workspaceId: workspace.id,
          searchTerms: searchTerm,
          countries: country,
          status: 'COMPLETED',
          resultCount: ads.length,
          executionMs: 1200,
        },
      });

      for (const ad of ads) {
        const savedAd = await prisma.ad.upsert({
          where: { adLibraryId: ad.adLibraryId },
          update: {
            pageName: ad.pageName,
            status: ad.status,
            country: ad.country,
            lastSeen: new Date(),
          },
          create: {
            adLibraryId: ad.adLibraryId,
            pageId: ad.pageId || ad.adLibraryId,
            pageName: ad.pageName,
            status: ad.status,
            country: ad.country,
            publisherPlatforms: JSON.stringify(ad.publisherPlatforms),
            firstSeen: new Date(),
            lastSeen: new Date(),
          },
        });

        // ✅ Fix: For VIDEO ads, always save the video URL as the primary media.
        //    Images (thumbnails/posters) are secondary and shouldn't override the actual video URL.
        const allMedia = ad.videoUrl
          ? ad.videoUrl
          : (ad.images && ad.images.length > 0 ? ad.images.join(',') : (ad.imageUrl || null));

        await prisma.adSnapshot.create({
          data: {
            adId: savedAd.id,
            searchRunId: searchRun.id,
            primaryText: ad.primaryText,
            linkTitle: ad.linkTitle || null,
            linkCaption: ad.linkCaption || null,
            linkDescription: ad.linkDescription || null,
            snapshotUrl: ad.snapshotUrl,
            mediaType: ad.mediaType,
            mediaUrls: allMedia,
            rawJson: JSON.stringify(ad),
            observedAt: new Date(),
          },
        });
      }
      console.log(`[MetaAdLibraryEngine] Saved ${ads.length} ads to DB under SearchRun ID: ${searchRun.id}`);
    } catch (dbErr) {
      console.warn('[MetaAdLibraryEngine] DB persistence error:', dbErr);
    }
  }
}

export const metaAdLibraryEngine = new MetaAdLibraryEngine();
export default metaAdLibraryEngine;
