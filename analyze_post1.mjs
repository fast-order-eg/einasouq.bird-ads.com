const post1Text = `لو أنت تاجر ملابس وبتموت في التفاصيل
لو أنت تاجر ملابس وزهقت من "الرد ع الخاص" وضياع المقاسات.. البوست ده ليك! 👗🚫
اعمل إعلانك الممول معانا وخد "متجرك الإلكتروني" هدية مجانية بالكامل! 🎁
✨ متجر احترافي بيعرض قطع الهدوم، المقاسات، والأسعار بوضوح يطمن العميل.
✨ سيستم ذكي بيجمع لك بيانات العميل (الاسم، الرقم، العنوان) في كشف واحد.
✨ وفر وقتك في الرد، وركز بس في تجهيز الأوردرات وتكبير شغلك.
اخلص من العشوائية وابدأ بيع زي البراندات الكبيرة! 🚀
📞 للتواصل : +20 10 12027705
📍 موقعنا: 3 برج العاصمة من شارع محمد حسن المريوطية بجوار مستشفي تبارك فيصل الدور الثاني`;

async function analyzePost1() {
  const res = await fetch('http://localhost:3000/api/ads/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adText: post1Text,
      pageName: 'Bird Technology (إعلان متجر تجار الملابس المجاني مع الإعلان الممول)'
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

analyzePost1().catch(console.error);
