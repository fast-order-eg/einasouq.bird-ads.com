import dotenv from 'dotenv';
dotenv.config();

const token = process.env.META_USER_TOKEN;

async function getPage10Posts() {
  console.log('--- جلب آخر 10 منشورات مع التفاعلات والروابط لصفحة Bird Technology ---');
  
  // 1. Get managed pages
  const accRes = await fetch('https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=100&access_token=' + token);
  const accData = await accRes.json();
  
  // Look for Bird page (ID 102310589566320 or Bird Ads 234951263043347)
  const candidatePages = accData.data?.filter(p => p.id === '102310589566320' || p.name.includes('Bird') || p.name.includes('بيرد') || p.name.includes('تكنولوجي')) || [];
  console.log('الصفحات المتاحة:', candidatePages.map(p => ({ id: p.id, name: p.name })));

  // Try page 102310589566320 directly or Bird Ads
  const targets = ['102310589566320', '234951263043347'];
  
  for (const pageId of targets) {
    const pageObj = accData.data?.find(p => p.id === pageId);
    const pageToken = pageObj?.access_token || token;
    
    console.log(`\n======================================================`);
    console.log(`فحص صفحة ID: ${pageId} (${pageObj?.name || 'صفحة عامة'})`);
    
    const fields = 'id,message,story,created_time,permalink_url,shares,comments.summary(true),reactions.summary(true)';
    const url = `https://graph.facebook.com/v21.0/${pageId}/posts?fields=${fields}&limit=10&access_token=${pageToken}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.data && data.data.length > 0) {
      console.log(`تم العثور على ${data.data.length} منشور:`);
      data.data.forEach((p, idx) => {
        const reactions = p.reactions?.summary?.total_count || 0;
        const comments = p.comments?.summary?.total_count || 0;
        const shares = p.shares?.count || 0;
        const link = p.permalink_url || `https://www.facebook.com/${p.id}`;
        const text = p.message || p.story || 'بدون نص';
        console.log(`\n[${idx + 1}] منشور ID: ${p.id}`);
        console.log(`📅 تاريخ النشر: ${p.created_time}`);
        console.log(`🔗 الرابط المباشر: ${link}`);
        console.log(`❤️ التفاعلات: ${reactions} | 💬 التعليقات: ${comments} | 🔄 المشاركات: ${shares}`);
        console.log(`📝 مقتطف النص: ${text.substring(0, 150)}...`);
      });
    } else {
      console.log('لم يتم العثور على منشورات عبر /posts، جاري فحص /feed...');
      const feedUrl = `https://graph.facebook.com/v21.0/${pageId}/feed?fields=${fields}&limit=10&access_token=${pageToken}`;
      const feedRes = await fetch(feedUrl);
      const feedData = await feedRes.json();
      if (feedData.data && feedData.data.length > 0) {
        feedData.data.forEach((p, idx) => {
          const reactions = p.reactions?.summary?.total_count || 0;
          const comments = p.comments?.summary?.total_count || 0;
          const shares = p.shares?.count || 0;
          const link = p.permalink_url || `https://www.facebook.com/${p.id}`;
          const text = p.message || p.story || 'بدون نص';
          console.log(`\n[${idx + 1}] منشور ID: ${p.id}`);
          console.log(`📅 تاريخ النشر: ${p.created_time}`);
          console.log(`🔗 الرابط المباشر: ${link}`);
          console.log(`❤️ التفاعلات: ${reactions} | 💬 التعليقات: ${comments} | 🔄 المشاركات: ${shares}`);
          console.log(`📝 مقتطف النص: ${text.substring(0, 150)}...`);
        });
      } else {
        console.log('بيانات Feed:', feedData.error || 'فارغة');
      }
    }
  }
}

getPage10Posts().catch(console.error);
