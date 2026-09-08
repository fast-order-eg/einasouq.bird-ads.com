import dotenv from 'dotenv';
dotenv.config();

const token = process.env.META_USER_TOKEN;

async function getBirdAdsFullEngagement() {
  const url = 'https://graph.facebook.com/v21.0/act_918303423296497/ads?fields=id,name,status,effective_status,created_time,creative{id,name,body,title,video_id,image_url,thumbnail_url,effective_object_story_id},insights.date_preset(maximum){impressions,reach,clicks,spend,actions}&limit=15&access_token=' + token;
  const res = await fetch(url);
  const data = await res.json();
  
  console.log('=== بيانات التفاعل والروابط لآخر 10 منشورات/إعلانات لـ Bird Technology ===\n');
  const ads = data.data || [];
  
  ads.slice(0, 10).forEach((ad, idx) => {
    const c = ad.creative || {};
    const ins = (ad.insights?.data || [])[0] || {};
    const actions = ins.actions || [];
    
    const reactions = actions.find(a => a.action_type === 'post_reaction')?.value || 0;
    const comments = actions.find(a => a.action_type === 'comment')?.value || 0;
    const shares = actions.find(a => a.action_type === 'post')?.value || 0;
    const clicks = ins.clicks || actions.find(a => a.action_type === 'link_click')?.value || 0;
    const reach = ins.reach || 0;
    const impressions = ins.impressions || 0;
    const spend = ins.spend || 0;
    
    const storyId = c.effective_object_story_id;
    let postLink = 'https://www.facebook.com/Bird.Technology20';
    if (storyId) {
      const parts = storyId.split('_');
      postLink = `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`;
    }

    console.log('--------------------------------------------------------------------------------');
    console.log(`[${idx + 1}] إعلان / منشور: ${ad.name}`);
    console.log(`📅 تاريخ الإنشاء: ${ad.created_time?.split('T')[0]}`);
    console.log(`🔗 رابط المنشور: ${postLink}`);
    console.log(`👁️ الوصول (Reach): ${reach} | 👀 مرات الظهور (Impressions): ${impressions} | 💰 الإنفاق: ${spend} EGP`);
    console.log(`❤️ التفاعلات: ${reactions} | 💬 التعليقات: ${comments} | 🔄 المشاركات: ${shares} | 🖱️ النقرات: ${clicks}`);
    console.log(`📝 النص:\n${(c.body || 'بدون نص').trim().substring(0, 160)}...\n`);
  });
}

getBirdAdsFullEngagement().catch(console.error);
