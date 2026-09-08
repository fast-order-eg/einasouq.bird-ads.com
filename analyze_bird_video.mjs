const videoAd1 = `🚨 اللي الناس بتصدقه دلوقتي… مش الكلام التسويقي، لكن الفيديوهات الواقعية اللي تحسسك بالصدق!

منتجك أو خدمتك ممكن تكون ممتازة، بس طريقة عرضه هي اللي تخليه يلمع.

في Bird Technology بنحوّل فكرتك لمحتوى يخطف النظر:
✅ تصوير احترافي عندك أو عندنا
✅ سكريبت جذاب وواضح
✅ موديل يشرح المنتج بطريقة طبيعية وصادقة
✅ مونتاج يخلي كل لقطة واقعية وجذابة

📲 عايز الناس تحس بالمنتج وتثق فيه؟ كلّمنا على واتساب: 01070366534

#BirdTechnology #UGC #ContentMarketing #SocialMedia #TrustMarketing`;

const videoAd2 = `🚨 سر اللي محدش بيقولك عليه في الإعلانات؟

كتير من أصحاب المشاريع بيصرفوا فلوس على إعلانات… ومفيش نتيجة.
السر؟ مش كل إعلان يجيب عملاء حقيقيين!

في Bird Technology، لما نشتغل على إعلانك، النتيجة بتكون واضحة:
🎯 عميل جديد بيبعتلك على واتساب بعد ساعات من تشغيل الإعلان
📈 المبيعات بتزيد يوم ورا يوم، مش مجرد أرقام على ورقة
💸 كل جنيه مصروف يرجعلك عائد حقيقي تشوفه بنفسك

يعني مش كلام… دي نتائج حقيقية بتحصل لمشاريع زي مشروعك.

📲 عايز إعلان يجيب عملاء حقيقيين ويكبر مشروعك؟ كلّمنا على واتساب: 01070366534

#BirdTechnology #إعلانات_ممولة #تسويق_رقمي #UGC #ContentMarketing`;

async function run() {
  const res = await fetch('http://localhost:3000/api/ads/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adText: videoAd1,
      pageName: 'Bird Technology (حملة فيديو صناعة محتوى الـ UGC وموديلز الثقة)'
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
