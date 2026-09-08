import puppeteer, { Browser } from 'puppeteer-core';

export interface ScrapedAd {
  id: string;
  adLibraryId: string;
  pageName: string;
  primaryText: string;
  startDate?: string;
  status: 'ACTIVE' | 'INACTIVE';
  ctaText?: string;
  linkUrl?: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  imageUrl?: string;
  snapshotUrl: string;
  publisherPlatforms: string[];
}

/**
 * Extract clean brand query while avoiding generic stop words (profile, pages, etc.)
 */
function extractBrandQuery(input: string): { cleanQuery: string; isGeneric: boolean; directUrl: string } {
  let cleaned = input.trim();
  let directUrl = cleaned.startsWith('http') ? cleaned : `https://www.facebook.com/${cleaned}`;
  let isGeneric = false;

  if (cleaned.includes('facebook.com') || cleaned.includes('fb.com') || cleaned.startsWith('http')) {
    try {
      const urlObj = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
      
      // Check query param for profile.php?id=12345
      const idParam = urlObj.searchParams.get('id');
      if (idParam && /^\d+$/.test(idParam)) {
        return { cleanQuery: idParam, isGeneric: true, directUrl };
      }

      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('profile.php') || lastPart === 'pages' || lastPart === 'p') {
          isGeneric = true;
        } else {
          cleaned = lastPart;
        }
      }
    } catch (e) {}
  }

  cleaned = cleaned
    .replace(/^www\./i, '')
    .replace(/\.(shop|eg|com|net|org|store|co|app|io|me|ly|link|info|biz|php)(\.|$)/gi, ' ')
    .replace(/[/\\?#&@=]/g, ' ')
    .trim()
    .split(/\s+/)[0]
    .trim();

  const stopWords = ['profile', 'pages', 'facebook', 'home', 'watch', 'groups', 'reel', 'story', 'post', 'posts'];
  if (!cleaned || stopWords.includes(cleaned.toLowerCase())) {
    isGeneric = true;
  }

  return { cleanQuery: cleaned || input, isGeneric, directUrl };
}

import { resolveChromeExecutable } from '@/lib/meta-ad-library';

export class FacebookAdScraper {
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
        '--window-size=1366,900',
      ],
    });
  }

  /**
   * Scrape Facebook Ad Library for active ads
   */
  async scrapeAdLibrary(query: string, country: string = 'EG'): Promise<ScrapedAd[]> {
    if (!query || query.length < 2) return [];

    let browser: Browser | null = null;
    try {
      browser = await this.launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1366, height: 900 });

      const targetUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodeURIComponent(query)}&search_type=keyword_unordered&media_type=all`;
      console.log(`[Scraper] Searching Ad Library: ${targetUrl}`);

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await new Promise((r) => setTimeout(r, 5500));

      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise((r) => setTimeout(r, 2000));

      const rawAds = await page.evaluate((brandName: string) => {
        const fullText = document.body.innerText;
        const blocks = fullText.split('Library ID:');
        const adsList: any[] = [];

        for (let i = 1; i < blocks.length; i++) {
          const block = blocks[i];
          const lines = block.split('\n').map((l: string) => l.trim()).filter(Boolean);

          const idLine = lines[0] || '';
          const idMatch = idLine.match(/^\d+/);
          const adId = idMatch ? idMatch[0] : `ad_${i}_${Date.now()}`;

          const dateLine = lines.find((l: string) =>
            l.includes('Started running on') ||
            l.includes('Started running') ||
            l.includes('بدأ التشغيل') ||
            Boolean(l.match(/^\w+ \d+, \d{4}$/))
          );

          const skipPatterns = [
            'Library ID', 'Started running', 'Platforms',
            'Open Drop-down', 'See ad details', 'Sponsored',
            'About ads', 'Privacy', 'Terms', 'Cookies',
            'people like', 'Active Status', 'Log in', '0:00 /',
            'See Less', 'See More', 'All reactions',
            'No longer', 'No data',
          ];

          const contentLines = lines.filter((l: string) => {
            if (l.length < 5) return false;
            return !skipPatterns.some((p) => l.includes(p));
          });

          const pageNameGuess =
            contentLines.find((l: string) => l.length > 2 && l.length < 60) || brandName;

          const bodyText = contentLines.slice(1, 12).join('\n');

          if (adId && bodyText.length > 10) {
            adsList.push({
              adLibraryId: adId,
              pageName: pageNameGuess,
              primaryText: bodyText,
              startDate: dateLine || 'نشط حالياً',
            });
          }
        }

        return adsList;
      }, query);

      return rawAds.map((ad: any, idx: number) => ({
        id: `scraped_${ad.adLibraryId}_${idx}`,
        adLibraryId: ad.adLibraryId,
        pageName: ad.pageName,
        primaryText: ad.primaryText,
        startDate: ad.startDate,
        status: 'ACTIVE' as const,
        mediaType: (ad.primaryText.includes('0:00') || ad.primaryText.includes('فيديو') || ad.primaryText.includes('video')
          ? 'VIDEO'
          : 'IMAGE') as 'IMAGE' | 'VIDEO' | 'CAROUSEL',
        snapshotUrl: `https://www.facebook.com/ads/library/?id=${ad.adLibraryId}`,
        publisherPlatforms: ['Facebook', 'Instagram'],
      }));
    } catch (err) {
      console.error('[Scraper] Error in scrapeAdLibrary:', err);
      return [];
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Scrape direct page posts and ads with accurate page title detection
   */
  async scrapeCompetitorPagePosts(pageUrlOrName: string): Promise<any[]> {
    const { cleanQuery, isGeneric, directUrl } = extractBrandQuery(pageUrlOrName);
    console.log(`[Scraper] Processing competitor: "${pageUrlOrName}" -> isGeneric: ${isGeneric}, cleanQuery: "${cleanQuery}"`);

    let detectedPageTitle = cleanQuery;
    const allPosts: any[] = [];

    // Step 1: Direct Facebook Page Scrape to get exact Page Title & latest timeline posts
    let browser: Browser | null = null;
    try {
      browser = await this.launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1366, height: 900 });

      console.log(`[Scraper] Visiting direct page URL: ${directUrl}`);
      await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await new Promise((r) => setTimeout(r, 4500));

      const rawTitle = await page.title();
      if (rawTitle && !rawTitle.toLowerCase().includes('log in') && !rawTitle.toLowerCase().includes('facebook')) {
        detectedPageTitle = rawTitle.replace(/\s*\|\s*Facebook.*$/i, '').trim();
      } else if (rawTitle && rawTitle.includes('|')) {
        detectedPageTitle = rawTitle.split('|')[0].trim();
      }

      console.log(`[Scraper] Real detected Page Title: "${detectedPageTitle}"`);

      // Extract direct posts from timeline
      const directPosts = await page.evaluate((brandTitle: string) => {
        const fullText = document.body.innerText;
        const lines = fullText.split('\n').map((l: string) => l.trim()).filter(Boolean);
        const postsList: string[] = [];
        const dateRegex = /^(\d+\s+(May|April|March|June|July|August|September|October|November|December|يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)|\d+\s*(h|m|d|w|س|د|ي|أ|h ·|d ·))/i;

        for (let i = 0; i < lines.length; i++) {
          if (dateRegex.test(lines[i]) || (lines[i] === '·' && dateRegex.test(lines[i - 1]))) {
            const body: string[] = [];
            for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
              const bl = lines[j];
              if (
                bl.includes('Like') ||
                bl.includes('Comment') ||
                bl.includes('Share') ||
                bl.includes('إعجاب') ||
                bl.includes('تعليق') ||
                bl.includes('مشاركة') ||
                bl.includes('See more from') ||
                bl.includes('Log in') ||
                bl.includes('All reactions') ||
                bl.includes('Email address')
              ) {
                break;
              }
              if (bl.length > 8 && !bl.startsWith('+') && !bl.includes('Privacy') && !bl.includes('Terms') && !bl.includes('Cookies')) {
                body.push(bl);
              }
            }
            const text = body.join('\n').trim();
            if (text.length > 10 && !postsList.includes(text)) {
              postsList.push(text);
            }
          }
        }
        return postsList;
      }, detectedPageTitle);

      directPosts.forEach((text, idx) => {
        allPosts.push({
          id: `direct_post_${Date.now()}_${idx}`,
          message: text,
          created_time: new Date().toISOString(),
          pageTitle: detectedPageTitle,
          permalink_url: directUrl,
          mediaType: text.includes('فيديو') || text.includes('video') ? 'VIDEO' : 'IMAGE',
        });
      });

      console.log(`[Scraper] Found ${directPosts.length} direct timeline posts.`);
    } catch (directErr) {
      console.warn('[Scraper] Direct page scrape error:', directErr);
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    // Step 2: Query Ad Library using the REAL detected title or brand query (NOT "profile")
    const searchCandidate = (!isGeneric ? cleanQuery : '') || detectedPageTitle;
    if (searchCandidate && searchCandidate.length > 1 && searchCandidate !== 'profile') {
      console.log(`[Scraper] Searching Ad Library with real brand title: "${searchCandidate}"`);
      
      let ads = await this.scrapeAdLibrary(searchCandidate, 'EG');
      if (ads.length === 0) {
        ads = await this.scrapeAdLibrary(searchCandidate, 'ALL');
      }

      ads.forEach((a, idx) => {
        allPosts.push({
          id: `ad_${a.adLibraryId}_${idx}`,
          message: a.primaryText,
          created_time: new Date().toISOString(),
          pageTitle: detectedPageTitle || a.pageName,
          permalink_url: a.snapshotUrl,
          mediaType: a.mediaType,
        });
      });
      console.log(`[Scraper] Added ${ads.length} ads from Ad Library.`);
    }

    return allPosts;
  }
}

export const adScraper = new FacebookAdScraper();
