/**
 * Utility to generate and download/print an elegant, high-quality Arabic PDF report
 * for Paid Campaign Post Analysis.
 */

export function exportPostAnalysisPdf(post: any, analysis: any) {
  if (!analysis) return;

  const formattedDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const isVideo =
    post?.mediaType === 'VIDEO' ||
    (post?.permalinkUrl && (post.permalinkUrl.includes('/reel/') || post.permalinkUrl.includes('/videos/') || post.permalinkUrl.includes('/watch')));

  const pageName = post?.pageName || 'صفحة العميل';
  const postUrl = post?.permalinkUrl || '';

  const observedScore = analysis.observed_score || 8.5;
  const copyScore = analysis.copy_score || Math.min(10, Math.round((observedScore * 0.95) * 10) / 10);
  const visualScore = analysis.visual_score || Math.min(10, Math.round((observedScore * 1.02) * 10) / 10);

  const creativeTitle = isVideo ? 'تحليل الفيديو ومسار الصوت والإيقاع (Video & Audio Analysis)' : 'تحليل الصور والتصميم البصري (Visuals & Design Analysis)';

  const strengthsList = (analysis.creative_analysis?.strengths || [])
    .map((s: string) => `<li>✔️ ${s}</li>`)
    .join('');

  const weaknessesList = (analysis.creative_analysis?.weaknesses || [])
    .map((w: string) => `<li>⚠️ ${w}</li>`)
    .join('');

  const actionList = (analysis.creative_analysis?.actionable_recommendations || [])
    .map((a: string) => `<li>🛠️ ${a}</li>`)
    .join('');

  const copyVariations = (analysis.copy_analysis?.ready_to_use_variations || [])
    .map(
      (v: string, i: number) => `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; font-size: 12.5px; line-height: 1.6; color: #166534;">
        <strong>صيغة بديلة #${i + 1}:</strong><br/>
        <span style="font-style: italic; white-space: pre-wrap;">${v}</span>
      </div>
    `
    )
    .join('');

  const interestsBadges = (analysis.targeting_suggestions?.detailed_interests || [])
    .map(
      (int: string) => `
      <span style="display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 3px 8px; border-radius: 6px; font-size: 11px; margin: 2px 4px 2px 0; font-weight: 600;">
        🎯 ${int}
      </span>
    `
    )
    .join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير تحليل إعلاني - ${pageName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 12mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background: #ffffff !important;
      color: #0f172a !important;
      margin: 0;
      padding: 0;
      direction: rtl;
      text-align: right;
      line-height: 1.6;
      font-size: 13px;
    }
    .header {
      border-bottom: 2.5px solid #4f46e5;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .title {
      font-size: 18px;
      font-weight: 800;
      color: #1e1b4b;
      margin: 0 0 4px 0;
    }
    .meta {
      font-size: 11.5px;
      color: #475569;
      margin: 0;
    }
    .badge-top {
      display: inline-block;
      background: #eef2ff;
      color: #4338ca;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid #c7d2fe;
    }
    .score-container {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .score-card {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
    }
    .score-card.highlight {
      background: #eef2ff;
      border-color: #c7d2fe;
    }
    .score-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      display: block;
      margin-bottom: 4px;
    }
    .score-val {
      font-size: 18px;
      font-weight: 800;
      color: #1e1b4b;
    }
    .verdict-box {
      background: #fffbeb;
      border: 1.5px solid #fde68a;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .verdict-title {
      font-size: 12.5px;
      font-weight: 800;
      color: #92400e;
      margin-bottom: 4px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 800;
      color: #312e81;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 14px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .grid-2 {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }
    .grid-2 > div {
      flex: 1;
    }
    ul {
      margin: 6px 0;
      padding-right: 20px;
    }
    li {
      margin-bottom: 4px;
      color: #334155;
    }
    .footer {
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">📊 تقرير التحليل الاستراتيجي للمنشور (إعلانات ممولة)</h1>
      <p class="meta">الصفحة: <strong>${pageName}</strong> &bull; تاريخ الفحص: ${formattedDate} &bull; نوع المحتوى: <strong>${isVideo ? '🎬 فيديو ريلز (Reel)' : '🖼️ تصميم / صور'}</strong></p>
      ${postUrl ? `<p class="meta" style="direction: ltr; text-align: right; font-size: 10.5px; color: #6366f1;">${postUrl}</p>` : ''}
    </div>
    <div class="badge-top">عين السوق &bull; Gemini 2.5 Pro</div>
  </div>

  <!-- Scores -->
  <div class="score-container">
    <div class="score-card highlight">
      <span class="score-label">التقييم الإجمالي العام</span>
      <span class="score-val" style="color: #4338ca;">⭐ ${observedScore} / 10</span>
    </div>
    <div class="score-card">
      <span class="score-label">تقييم الكوبي والمحتوى</span>
      <span class="score-val" style="color: #059669;">✍️ ${copyScore} / 10</span>
    </div>
    <div class="score-card">
      <span class="score-label">${isVideo ? 'تقييم الفيديو والإيقاع' : 'تقييم التصميم البصري'}</span>
      <span class="score-val" style="color: #7c3aed;">${isVideo ? '🎬' : '🖼️'} ${visualScore} / 10</span>
    </div>
  </div>

  <!-- Verdict Summary -->
  <div class="verdict-box">
    <div class="verdict-title">🔥 حكم الميديا باير وجدوى صرف الميزانية: (${analysis.verdict?.status_label || 'جاهز'})</div>
    <div style="font-size: 12px; color: #78350f; line-height: 1.6;">${analysis.verdict?.summary || ''}</div>
  </div>

  <!-- Two Columns: Creative vs Copywriting -->
  <div class="grid-2">
    <!-- Creative Column -->
    <div class="card">
      <div class="section-title" style="margin-top: 0; color: #4338ca;">${creativeTitle}</div>
      ${analysis.creative_analysis?.visual_hooks ? `
        <div style="margin-bottom: 8px;">
          <strong style="color: #475569; font-size: 11.5px;">الهوك البصري (أول 3 ثوانٍ):</strong>
          <p style="margin: 3px 0; font-size: 12px; color: #1e293b;">${analysis.creative_analysis.visual_hooks}</p>
        </div>
      ` : ''}

      ${strengthsList ? `
        <div style="margin-bottom: 8px;">
          <strong style="color: #059669; font-size: 11.5px;">نقاط القوة:</strong>
          <ul style="font-size: 12px;">${strengthsList}</ul>
        </div>
      ` : ''}

      ${weaknessesList ? `
        <div style="margin-bottom: 8px;">
          <strong style="color: #d97706; font-size: 11.5px;">نواقص تحتاج تحسين:</strong>
          <ul style="font-size: 12px;">${weaknessesList}</ul>
        </div>
      ` : ''}

      ${actionList ? `
        <div style="background: #f1f5f9; padding: 8px; border-radius: 6px;">
          <strong style="color: #1e293b; font-size: 11.5px;">المطلوب تنفيذه فوراً:</strong>
          <ul style="font-size: 12px; margin: 4px 0 0 0;">${actionList}</ul>
        </div>
      ` : ''}
    </div>

    <!-- Copywriting Column -->
    <div class="card">
      <div class="section-title" style="margin-top: 0; color: #7c3aed;">تحليل المحتوى الكتابي (Copywriting)</div>
      <div style="margin-bottom: 8px; font-size: 12px;">
        <strong style="color: #e11d48; font-size: 11.5px;">هوك النص:</strong>
        <p style="margin: 2px 0; color: #334155;">${analysis.copy_analysis?.hook_evaluation || '-'}</p>
      </div>
      <div style="margin-bottom: 8px; font-size: 12px;">
        <strong style="color: #059669; font-size: 11.5px;">العرض المالي والقيمة:</strong>
        <p style="margin: 2px 0; color: #334155;">${analysis.copy_analysis?.offer_evaluation || '-'}</p>
      </div>
      <div style="margin-bottom: 10px; font-size: 12px;">
        <strong style="color: #2563eb; font-size: 11.5px;">الدعوة للإجراء (CTA):</strong>
        <p style="margin: 2px 0; color: #334155;">${analysis.copy_analysis?.cta_evaluation || '-'}</p>
      </div>

      ${copyVariations ? `
        <div>
          <strong style="color: #059669; font-size: 11.5px; display: block; margin-bottom: 6px;">صيغ إعلانية بديلة مقترحة جاهزة للاستخدام:</strong>
          ${copyVariations}
        </div>
      ` : ''}
    </div>
  </div>

  <!-- Targeting & Audience -->
  <div class="card">
    <div class="section-title" style="margin-top: 0; color: #2563eb;">🎯 الاستهداف المقترح في مدير الإعلانات (Targeting Strategy)</div>
    <div style="display: flex; gap: 14px; margin-bottom: 8px; font-size: 12px;">
      <div><strong>الفئة العمرية:</strong> ${analysis.targeting_suggestions?.age_range || '22 - 50 سنة'}</div>
      <div><strong>الجنس:</strong> ${analysis.targeting_suggestions?.gender || 'الكل'}</div>
      <div><strong>المواضع:</strong> ${analysis.targeting_suggestions?.behaviors_and_placements?.join(' • ') || 'Feeds & Reels'}</div>
    </div>
    ${interestsBadges ? `
      <div style="margin-top: 6px;">
        <strong style="font-size: 11.5px; color: #475569; display: block; margin-bottom: 4px;">الاهتمامات للبحث عنها في فيسبوك (${analysis.targeting_suggestions?.detailed_interests?.length || 0} اهتمام):</strong>
        ${interestsBadges}
        <div style="margin-top: 6px; padding: 6px 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 11px; color: #1e40af; line-height: 1.5;">
          💡 <strong>نصيحة الميديا باير:</strong> لا تضع كل الاهتمامات معاً في Ad Set واحدة لتفادي تشتيت الميزانية. الأفضل تقسيمها (2 إلى 4 اهتمامات لكل Ad Set) أو اختبار جمهور Broad بدون اهتمامات.
        </div>
      </div>
    ` : ''}
  </div>

  <!-- Strategy & Scaling -->
  <div class="card">
    <div class="section-title" style="margin-top: 0; color: #d97706;">⚙️ استراتيجية الحملة واختبارات الـ A/B Testing</div>
    ${analysis.campaign_strategy?.recommended_objective ? `
      <div style="margin-bottom: 10px; padding: 8px 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 12px; color: #065f46;">
        🎯 <strong>الهدف الإعلاني المقترح للحملة:</strong> ${analysis.campaign_strategy.recommended_objective}
      </div>
    ` : ''}
    <div style="font-size: 12px; margin-bottom: 8px;">
      <strong>1. هيكل المجموعات الإعلانية:</strong>
      <p style="margin: 2px 0; color: #334155;">${analysis.campaign_strategy?.ad_set_structure || '-'}</p>
    </div>
    <div style="font-size: 12px; margin-bottom: 8px;">
      <strong>2. بوست إبداعي بديل مقترح لضمه في نفس الـ Ad Set (A/B Test):</strong>
      <p style="margin: 2px 0; color: #334155;">${analysis.campaign_strategy?.pair_another_post_recommendation?.recommendation_reason || '-'}</p>
      ${analysis.campaign_strategy?.pair_another_post_recommendation?.paired_concept_idea ? `
        <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 6px 10px; margin-top: 4px; color: #5b21b6;">
          💡 <strong>الفكرة المقترحة:</strong> ${analysis.campaign_strategy.pair_another_post_recommendation.paired_concept_idea}
        </div>
      ` : ''}
    </div>
    <div style="font-size: 12px; margin-bottom: 8px;">
      <strong>3. نصيحة الميديا باير الذهبية لتوفير التكلفة:</strong>
      <p style="margin: 2px 0; color: #334155;">${analysis.campaign_strategy?.media_buyer_golden_tip || 'اختبر بأقل ميزانية أولاً وتأكد من ثبات سعر النتيجة.'}</p>
    </div>
    ${analysis.campaign_strategy?.scaling_and_testing_plan ? `
      <div style="font-size: 12px; margin-top: 10px; padding: 8px 12px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px;">
        <strong style="color: #3730a3; display: block; margin-bottom: 4px;">📈 خطة التكبير وزيادة الميزانية بأمان (Scaling Plan):</strong>
        <div style="color: #334155; line-height: 1.6;">
          ${analysis.campaign_strategy.scaling_and_testing_plan
            .split(/(?=(?:^|\s)\d+[\.\-\)]\s*)/g)
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
            .map((step: string) => `<div style="margin-bottom: 4px;">&bull; ${step}</div>`)
            .join('') || analysis.campaign_strategy.scaling_and_testing_plan}
        </div>
      </div>
    ` : ''}
  </div>

  <div class="footer">
    تم إنشاء هذا التقرير آلياً عبر منصة عين السوق &bull; الذكاء الاصطناعي الاستشاري لنمو التجارة الإلكترونية والإعلانات الممولة.
  </div>
</body>
</html>`;

  // Create isolated iframe to invoke print dialog cleanly
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc || !iframe.contentWindow) {
    window.print();
    return;
  }

  frameDoc.open();
  frameDoc.write(htmlContent);
  frameDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('Iframe print error fallback:', e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  }, 400);
}
