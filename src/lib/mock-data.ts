export interface SampleAd {
  id: string;
  adLibraryId: string;
  pageId: string;
  pageName: string;
  firstSeen: string;
  lastSeen: string;
  status: 'ACTIVE' | 'INACTIVE';
  publisherPlatforms: string[];
  country: string;
  primaryText: string;
  linkTitle: string;
  linkCaption: string;
  ctaText: string;
  snapshotUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  impressionsRange: string;
  spendRange: string;
  creativeStrengthScore: number;
}

export const INITIAL_COMPETITOR_ADS: SampleAd[] = [
  {
    id: 'ad_bird_01',
    adLibraryId: '109283746192831',
    pageId: '150660748126365',
    pageName: 'Bird Technology - حلول البرمجة والتسويق',
    firstSeen: '2026-08-10',
    lastSeen: '2026-08-22',
    status: 'ACTIVE',
    publisherPlatforms: ['facebook', 'instagram', 'messenger'],
    country: 'EG',
    primaryText: '🚀 عاوز تضاعف مبيعاتك وتسيطر على مجالك أونلاين؟ في Bird Technology بنقدملك حلول تسويقية متكاملة وإدارة حملات إعلانية احترافية بأعلى عائد على الإنفاق (ROAS). تواصل معنا الآن واحصل على استشارة تسويقية وخطة عمل مجانية!',
    linkTitle: 'استشارة تسويقية مجانية - Bird Technology',
    linkCaption: 'bird-technology.com',
    ctaText: 'إرسال رسالة واتساب',
    snapshotUrl: 'https://www.facebook.com/ads/library/?id=109283746192831',
    mediaType: 'IMAGE',
    impressionsRange: '10K - 50K (تقديري معلن)',
    spendRange: '< $100 (تقديري معلن)',
    creativeStrengthScore: 8.8,
  },
  {
    id: 'ad_comp_02',
    adLibraryId: '827364519203948',
    pageId: '992837162541029',
    pageName: 'Growth Hackers Egypt',
    firstSeen: '2026-08-01',
    lastSeen: '2026-08-20',
    status: 'ACTIVE',
    publisherPlatforms: ['facebook', 'instagram'],
    country: 'EG',
    primaryText: 'ليه تدفع آلاف الجنيهات في إعلانات ممولة من غير ما تشوف مبيعات حقيقية؟ مع باقات إدارة السوشيال ميديا وحملات الأداء لدينا، بنضمنلك استهداف دقيق لعملائك المحتملين وتقارير أسبوعية شفافة.',
    linkTitle: 'عرض خاص: خصم 40% على أول شهر إدارة إعلانات',
    linkCaption: 'growthhackers-eg.com/offers',
    ctaText: 'احجز مكانك الآن',
    snapshotUrl: 'https://www.facebook.com/ads/library/?id=827364519203948',
    mediaType: 'VIDEO',
    impressionsRange: '50K - 100K (تقديري معلن)',
    spendRange: '$100 - $500 (تقديري معلن)',
    creativeStrengthScore: 7.9,
  },
  {
    id: 'ad_comp_03',
    adLibraryId: '473829105829102',
    pageId: '771239845102938',
    pageName: 'Digital Scale Media',
    firstSeen: '2026-07-25',
    lastSeen: '2026-08-21',
    status: 'ACTIVE',
    publisherPlatforms: ['facebook', 'instagram', 'audience_network'],
    country: 'EG',
    primaryText: 'تصميم مواقع إلكترونية سريعة ومتوافقة مع محركات البحث + حملات إعلانية مستهدفة على جوجل وفيسبوك. اطلب عرض السعر الآن واستلم موقعك خلال 7 أيام عمل فقط.',
    linkTitle: 'باقات تصميم وتطوير المواقع 2026',
    linkCaption: 'digitalscale.agency',
    ctaText: 'عرض الأسعار',
    snapshotUrl: 'https://www.facebook.com/ads/library/?id=473829105829102',
    mediaType: 'CAROUSEL',
    impressionsRange: '5K - 10K (تقديري معلن)',
    spendRange: '< $100 (تقديري معلن)',
    creativeStrengthScore: 8.2,
  },
];
