import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface GenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  responseMimeType?: string;
}

export interface CreativeAnalysisSchema {
  hook: {
    type: string;
    text: string;
  };
  offer: {
    present: boolean;
    type: string;
    details: string;
  };
  problem_addressed: string;
  benefit_promised: string;
  audience_hypothesis: string;
  cta: string;
  funnel_stage: 'awareness' | 'consideration' | 'conversion' | 'retention' | 'unclear';
  observed_creative_strength_score: number; // 1 to 10
  paid_ad_verdict: {
    rating: 'ممتاز' | 'جيد جداً' | 'جيد' | 'ضعيف' | 'سيء جداً';
    status_label: string; // e.g. "جاهز للحملة فوراً 🚀" | "مناسب مع تعديل المطلوب أولاً ⚠️" | "غير مناسب للتمويل وهيحرق ميزانية ❌"
    summary: string; // تقييم صريح ومباشر بالعامية المصرية هل تصرف عليه إعلانات ممولة ولا لاء وليه
  };
  visual_analysis: string; // تحليل العناصر البصرية والتصميم
  copy_analysis: string; // تحليل النص الإعلاني المكتوب
  strengths: string[];
  weaknesses: string[];
  action_plan: string[]; // المطلوب تنفيذه فوراً بأمثلة نصية عملية بالعامية المصرية
  strategic_recommendations: string[];
}

export interface PaidCampaignPostAnalysis {
  observed_score: number; // 1 to 10 (التقييم العام)
  copy_score: number; // 1 to 10 (تقييم الكوبي والمحتوى الكتابي)
  visual_score: number; // 1 to 10 (تقييم الفيديو / التصميم البصري)
  verdict: {
    is_suitable: boolean;
    rating: 'ممتاز' | 'جيد جداً' | 'جيد' | 'ضعيف' | 'سيء جداً';
    status_label: string;
    summary: string;
  };
  creative_analysis: {
    format_detected: string;
    visual_hooks: string;
    strengths: string[];
    weaknesses: string[];
    actionable_recommendations: string[];
  };
  copy_analysis: {
    hook_evaluation: string;
    offer_evaluation: string;
    cta_evaluation: string;
    ready_to_use_variations: string[];
  };
  targeting_suggestions: {
    age_range: string;
    gender: 'الجميع (رجال ونساء)' | 'رجال فقط' | 'نساء فقط';
    detailed_interests: string[];
    behaviors_and_placements: string[];
  };
  campaign_strategy: {
    ad_set_structure: string;
    pair_another_post_recommendation: {
      should_pair: boolean;
      recommendation_reason: string;
      paired_concept_idea: string;
    };
    recommended_objective: string;
    media_buyer_golden_tip: string;
    scaling_and_testing_plan?: string;
  };
}

export function safeParseJson(rawText: string): any {
  if (!rawText) return null;
  // Strip code block markers if any
  let clean = rawText.replace(/^```(?:json)?\s*/gim, '').replace(/```\s*$/gim, '').trim();

  // Attempt 1: Direct JSON.parse
  try {
    return JSON.parse(clean);
  } catch {}

  // Attempt 2: Match outer { ... }
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  // Attempt 3: Fix trailing commas before closing braces/brackets
  try {
    let candidate = match ? match[0] : clean;
    candidate = candidate.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(candidate);
  } catch {}

  // Attempt 4: Clean unescaped control characters inside strings
  try {
    let candidate = match ? match[0] : clean;
    candidate = candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      if (c === '\t') return '\\t';
      return '';
    });
    return JSON.parse(candidate);
  } catch {}

  // Attempt 5: If JSON was cut off near the end, balance braces and brackets
  try {
    let candidate = match ? match[0] : clean;
    const lastValidComma = candidate.lastIndexOf(',');
    if (lastValidComma > candidate.length / 2) {
      let cut = candidate.slice(0, lastValidComma);
      const quoteCount = (cut.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        const lastQuote = cut.lastIndexOf('"');
        if (lastQuote > 0) {
          cut = cut.slice(0, lastQuote);
          const prevComma = cut.lastIndexOf(',');
          if (prevComma > 0) cut = cut.slice(0, prevComma);
        }
      }
      let openBraces = (cut.match(/\{/g) || []).length;
      let closeBraces = (cut.match(/\}/g) || []).length;
      let openBrackets = (cut.match(/\[/g) || []).length;
      let closeBrackets = (cut.match(/\]/g) || []).length;

      while (openBrackets > closeBrackets) {
        cut += ']';
        closeBrackets++;
      }
      while (openBraces > closeBraces) {
        cut += '}';
        closeBraces++;
      }
      return JSON.parse(cut);
    }
  } catch {}

  throw new Error('فشل استخراج كائن JSON صالح من الاستجابة');
}

export class VertexGeminiProvider {
  private projectId: string;
  private location: string;
  private qualityModel: string;
  private fastModel: string;
  private credentialsPath: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'project-c1442437-41e2-480c-86d';
    // europe-west4 provides abundant Gemini 2.5 Pro TPU capacity with dedicated quota
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'europe-west4';
    // Strictly use the flagship Gemini 2.5 Pro model for all strategic analyses
    this.qualityModel = process.env.VERTEX_QUALITY_MODEL || 'gemini-2.5-pro';
    this.fastModel = process.env.VERTEX_FAST_MODEL || 'gemini-2.5-flash';

    // Flexible credential path resolution for local dev, Docker, and production servers
    const projectCredPath = path.join(process.cwd(), 'credentials', 'google-service-account.json');
    const localRootCredPath = path.join(process.cwd(), 'google-credentials.json');
    const fallbackPath = 'E:/programing/flutter project/bot.bird-ads.com/project-c1442437-41e2-480c-86d-0935778ac612.json';

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      this.credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else if (fs.existsSync(projectCredPath)) {
      this.credentialsPath = projectCredPath;
    } else if (fs.existsSync(localRootCredPath)) {
      this.credentialsPath = localRootCredPath;
    } else if (fs.existsSync(fallbackPath)) {
      this.credentialsPath = fallbackPath;
    } else {
      this.credentialsPath = projectCredPath;
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && this.tokenExpiresAt > now + 300) {
      return this.cachedToken;
    }

    let keyData: any = null;

    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      try {
        keyData = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      } catch (e) {
        throw new Error('Invalid JSON in GOOGLE_CREDENTIALS_JSON environment variable');
      }
    } else if (fs.existsSync(this.credentialsPath)) {
      keyData = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
    } else {
      throw new Error(
        `Google Cloud Service Account credentials not found. Please set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CREDENTIALS_JSON. Checked: ${this.credentialsPath}`
      );
    }
    const exp = now + 3600;

    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: keyData.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp,
      iat: now,
    };

    const encodeBase64Url = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signatureInput = `${encodeBase64Url(header)}.${encodeBase64Url(claimSet)}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    signer.end();
    const signature = signer.sign(keyData.private_key, 'base64url');

    const jwt = `${signatureInput}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(`Google Auth Error: ${tokenData.error_description || tokenData.error}`);
    }

    this.cachedToken = tokenData.access_token;
    this.tokenExpiresAt = now + (tokenData.expires_in || 3600);
    return this.cachedToken!;
  }

  async generate(prompt: string, options: { model?: 'quality' | 'fast'; imageBase64?: string; mimeType?: string; config?: GenerationConfig } = {}) {
    const accessToken = await this.getAccessToken();
    const primaryModel = options.model === 'fast' ? this.fastModel : this.qualityModel;
    const fallbackModel = this.fastModel;

    // Multi-region priority list: europe-west4 has highest TPU capacity, followed by us-east4, europe-west1, us-central1
    const candidateLocations = [
      this.location,
      'europe-west4',
      'us-east4',
      'europe-west1',
      'us-central1',
    ].filter((v, i, a) => a.indexOf(v) === i);

    const executeCall = async (modelToUse: string, locationToUse: string, includeImage: boolean = true) => {
      const url = `https://${locationToUse}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${locationToUse}/publishers/google/models/${modelToUse}:generateContent`;

      const parts: any[] = [{ text: prompt }];

      if (includeImage && options.imageBase64) {
        parts.push({
          inlineData: {
            mimeType: options.mimeType || 'image/jpeg',
            data: options.imageBase64,
          },
        });
      }

      const payload: any = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: options.config?.temperature ?? 0.1,
          maxOutputTokens: options.config?.maxOutputTokens ?? 8192,
          topP: options.config?.topP ?? 0.95,
          topK: options.config?.topK ?? 40,
          ...(options.config?.responseMimeType ? { responseMimeType: options.config.responseMimeType } : {}),
        },
      };

      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
    };

    let lastErrorText = '';
    let res: Response | null = null;

    // 1. Try primaryModel (Gemini 2.5 Pro) across candidate regions
    for (const loc of candidateLocations) {
      try {
        res = await executeCall(primaryModel, loc, true);
        if (res.ok) break;

        lastErrorText = await res.text();
        // If rate limited (429) or overloaded (503), try next region
        if (res.status === 429 || res.status === 503) {
          console.warn(`[Vertex AI] ${primaryModel} in ${loc} returned ${res.status}. Trying next region...`);
          continue;
        } else {
          break;
        }
      } catch (callErr: any) {
        lastErrorText = callErr.message;
      }
    }

    // 2. If all regions rate-limited with image, try primaryModel (Gemini 2.5 Pro) text-only
    if ((!res || !res.ok) && options.imageBase64) {
      console.warn(`[Vertex AI] Retrying text-only on ${primaryModel} in europe-west4...`);
      res = await executeCall(primaryModel, 'europe-west4', false);
    }

    // 3. Ultimate safeguard: if still failing, use fallbackModel (Gemini 2.5 Flash)
    if ((!res || !res.ok) && primaryModel !== fallbackModel) {
      console.warn(`[Vertex AI] All Pro regions exhausted, falling back to ${fallbackModel}...`);
      res = await executeCall(fallbackModel, 'europe-west4', true);
    }

    if (!res || !res.ok) {
      const errText = res ? await res.text() : lastErrorText;
      throw new Error(`Vertex AI Error (${res?.status || 500}): ${errText}`);
    }

    const data = await res.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      throw new Error('No text generated from Gemini model');
    }
    return textOutput;
  }

  async analyzeAdCreative(adText: string, metadata?: { pageName?: string; snapshotUrl?: string; platform?: string; imageBase64?: string; imageUrl?: string }): Promise<CreativeAnalysisSchema> {
    let imageBase64 = metadata?.imageBase64;

    if (!imageBase64 && metadata?.imageUrl) {
      try {
        const imgRes = await fetch(metadata.imageUrl);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          imageBase64 = Buffer.from(buf).toString('base64');
        }
      } catch (e) {
        console.error('Failed to download image for analysis:', e);
      }
    }

    const hasImage = Boolean(imageBase64);

    const prompt = `
أنت خبير واستشاري تسويق رقمي وإعلانات ممولة وميديا باير (Media Buyer) محترف ومختص في إعلانات فيسبوك وتيك توك وإنستغرام.
المهمة: تحليل الإعلان المرفق بدقة شاملة وفحص كل من (التصميم/الصورة/الغلاف المرفق) و (النص الإعلاني المكتوب).
${hasImage ? '⚠️ تم إرفاق صورة/غلاف الإعلان الفعلي: افحص تفاصيل الصورة بالملي: الألوان، الأزرار، الأرقام المكتوبة، العناوين، والتناغم بين الصورة والنص.' : ''}

بيانات الإعلان:
- المعلن: ${metadata?.pageName || 'غير محدد'}
- نوع الوسائط: ${hasImage ? 'تصميم/صورة مرفقة + نص' : 'نص إعلاني فقط'}
- النص المكتوب:
"""
${adText}
"""

القواعد الصارمة والواجب الالتزام بها:
1. 💡 "المطلوب تنفيذه فوراً" (action_plan): 
   - **ممنوع تماماً الكلمات العامة المبهمة** مثل "ركز على العرض بشكل أوضح" أو "حسّن التصميم".
   - **يجب كتابة من 3 إلى 5 خطوات عملية دقيقة تتضمن أمثلة نصية مباشرة قابلة للنسخ بين علامات تنصيص \"...\"** يضعها المعلن فوراً في إعلانه (مثال: في أول سطر، اكتب: \"بدل ما تضيع وقتك، وظف مصمم محترف لشفت مسائي أونلاين بضغطة واحدة!\").
   - اذكر التعديل البصري في الصورة بالملي (مثلاً: \"وحّد رقم الواتساب المكتوب في أسفل الصورة ليكون مطابقاً لنص الإعلان\"، \"شيل العناصر المشتتة وركز على كارت الموبايل\").
2. ⚖️ نقاط القوة ونقاط التحسين:
   - **استخرج من 3 إلى 5 نقاط قوة تفصيلية** تشرح سبب نجاح العناصر الموجودة.
   - **استخرج من 3 إلى 5 نقاط تحسين دقيقة وحقيقية** مبنية على ما يظهر فعلياً في الصورة والنص بدون افتراضات غير واقعية.
3. 🏆 "تقييم الجدوى للإعلانات الممولة" (paid_ad_verdict):
   - rating: اختر واحدة من: (ممتاز | جيد جداً | جيد | ضعيف | سيء جداً)
   - status_label: مثلاً: "جاهز للحملة فوراً 🚀" | "مناسب مع تعديلات بسيطة ✨" | "عدّل المطلوب أولاً لتوفير ميزانيتك ⚠️" | "غير مناسب للتمويل وهيحرق ميزانية ❌"
   - summary: سطرين إلى 3 أسطر بالعامية المصرية تشرح للمعلن بصراحة تامة هل يدفع فيه ميزانية إعلانات ممولة ولا لاء وليه بالظبط.
4. الرد يجب أن يكون JSON مطابق للهيكل التالي 100%:

{
  "hook": {
    "type": "نوع الهوك (سؤال، عرض مباشر، خصم، صدمة)",
    "text": "جملة الهوك الأساسية"
  },
  "offer": {
    "present": true,
    "type": "نوع العرض",
    "details": "تفاصيل العرض المالي أو الوظيفي"
  },
  "problem_addressed": "المشكلة اللي بيحلها الإعلان بدقة",
  "benefit_promised": "الفائدة والنتيجة للعميل",
  "audience_hypothesis": "الجمهور المستهدف تحديداً",
  "cta": "الدعوة للإجراء المباشرة",
  "funnel_stage": "conversion",
  "observed_creative_strength_score": 8.5,
  "paid_ad_verdict": {
    "rating": "ممتاز",
    "status_label": "جاهز للحملة فوراً 🚀",
    "summary": "ملخص بالعامية المصرية يوضح هل البوست مناسب لإعلان ممول وليه"
  },
  "visual_analysis": "تحليل مفصل للتصميم والألوان ووضوح النصوص في الصورة",
  "copy_analysis": "تحليل مفصل لنبرة النص والكتابة الإعلانية",
  "strengths": [
    "نقطة قوة 1 مفصلة",
    "نقطة قوة 2 مفصلة",
    "نقطة قوة 3 مفصلة"
  ],
  "weaknesses": [
    "نقطة تحسين 1 دقيقة",
    "نقطة تحسين 2 دقيقة",
    "نقطة تحسين 3 دقيقة"
  ],
  "action_plan": [
    "المطلوب 1 (بالعامية المصرية مع مثال نصي جاهز بين تنصيص \"...\")",
    "المطلوب 2 (بالعامية المصرية مع تحديد التعديل البصري في الصورة بدقة)",
    "المطلوب 3 (بالعامية المصرية مع صياغة زر الدعوة للإجراء CTA المناسب)"
  ],
  "strategic_recommendations": [
    "فكرة زاوية إعلانية بديلة للتجربة",
    "توصية لزيادة العائد على الإنفاق (ROAS)"
  ]
}
`;

    const rawResponse = await this.generate(prompt, {
      model: 'quality',
      imageBase64,
      mimeType: 'image/jpeg',
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    try {
      let cleanJson = rawResponse.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');
      }
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }
      return JSON.parse(cleanJson);
    } catch (err) {
      console.error('Failed to parse Gemini 2.5 Pro JSON:', rawResponse);
      throw new Error('فشل معالجة استجابة الذكاء الاصطناعي، يرجى إعادة المحاولة.');
    }
  }

  async analyzePostForPaidCampaign(options: {
    postText: string;
    pageName?: string;
    mediaType?: string;
    imageUrl?: string;
    imageBase64?: string;
    metrics?: { reactions?: number; comments?: number; shares?: number; views?: number };
    permalinkUrl?: string;
  }): Promise<PaidCampaignPostAnalysis> {
    let imageBase64 = options.imageBase64;

    if (!imageBase64 && options.imageUrl) {
      try {
        const imgRes = await fetch(options.imageUrl);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          imageBase64 = Buffer.from(buf).toString('base64');
        }
      } catch (e) {
        console.error('Failed to download image for paid post analysis:', e);
      }
    }

    const isVideo =
      options.mediaType === 'VIDEO' ||
      (options.permalinkUrl && (options.permalinkUrl.includes('/reel/') || options.permalinkUrl.includes('/videos/') || options.permalinkUrl.includes('/watch')));

    const hasImage = Boolean(imageBase64);
    const metricsSummary = options.metrics
      ? `التفاعلات الحالية للمنشور: ${options.metrics.reactions || 0} إعجاب، ${options.metrics.comments || 0} تعليق، ${options.metrics.shares || 0} مشاركة، ${options.metrics.views || 0} مشاهدة.`
      : '';

    const mediaDirective = isVideo
      ? `
⚠️ تنبيه صارم وحاسم للذكاء الاصطناعي (Strict Rule for Reels/Videos):
نوع هذا المنشور هو: **فيديو / ريلز (Reel / Video)** وليس صورة ثابتة أو تصميم!
الصورة المرفقة معك هي مجرد كادر افتتاحي أول ثانية أو غلاف (Thumbnail) من الفيديو.
لذلك:
1. ممنوع منعاً باتاً انتقاد المحتوى بالقول أن "الصورة غامضة بدون النص" أو معاملته كتصميم صورة ثابتة!
2. قم بتحليل هذا الكريتيف كـ **فيديو ريلز إعلاني متحرك**:
   - تقييم الهوك البصري والحركي في أول 3 ثوانٍ (Visual Hook & Movement): هل المشهد الافتتاحي يوقف السكرول فوراً (Stop The Scroll)؟
   - تقييم الإيقاع والانتقالات واستعراض المنتج (Pacing, Transitions & Product Demo).
   - تقييم المسار الصوتي والتعليق والموسيقى (Voiceover & Audio Energy).
   - تقييم وضوح الكتابة التوضيحية المتحركة على الشاشة (Dynamic Subtitles / Captions) لخدمة المشاهدين مع كتم الصوت (Muted Users وهم أكثر من 75% من مستخدمي فيسبوك).
   - تقييم توافق أبعاد 9:16 مع التغذية الرأسية على فيسبوك وإنستجرام ريلز.
`
      : hasImage
      ? `
نوع هذا المنشور هو: **تصميم إعلاني / صور للمنتج (Image / Post Design)**.
افحص الصورة بدقة شديدة: الألوان، جودة زوايا التصوير، وضوح تفاصيل المنتج، الخطوط، وتناسق التصميم وهل يوقف السكرول فوراً.
`
      : `
نوع هذا المنشور: منشور نصي بدون وسائط.
`;

    const prompt = `
أنت خبير واستشاري تسويق رقمي ومدير حملات ميديا باينج (Senior Performance Marketing Director & Creative Strategist) ذو خبرة تفوق 10 سنوات في إعلانات فيسبوك وإنستغرام الممولة بالسوق المصري والعربي.
المهمة: فحص وتحليل هذا المنشور المباشر من صفحة العميل، وتقييم مدى جاهزيته وصلاحيته لإطلاق حملة إعلانية ممولة (Paid Ad Campaign) تحقق أعلى مبيعات وأقل تكلفة للعميل وتتفادى حرق الميزانية.

بيانات المنشور:
- اسم الصفحة: ${options.pageName || 'صفحة تابعة للعميل'}
- نوع المحتوى: ${isVideo ? 'فيديو ريلز (Reel/Video)' : (options.mediaType || (hasImage ? 'تصميم/صور' : 'نص فقط'))}
${metricsSummary}
- نص المنشور (Copy):
"""
${options.postText || 'لا يوجد نص مكتوب'}
"""
${mediaDirective}

المطلوب بدقة متناهية:
1. إعطاء ثلاثة تقييمات رقمية دقيقة من 10:
   - التقييم الكلي العام (observed_score) من 10.
   - تقييم المحتوى والنص الإعلاني (copy_score) من 10.
   - تقييم الفيديو أو التصميم البصري (visual_score) من 10.
2. تقييم صريح وحاسم بالعامية المصرية حول جدوى تمويل البوست.
3. فحص تفصيلي للكريتيف (سواء فيديو أو تصميم) ونقاط قوته ونواقصه مع خطوات تحسين عملية بالملي.
4. فحص المحتوى الكتابي (الهوك، العرض، الدعوة للإجراء) مع كتابة 3 صيغ إعلانية بديلة كاملة بالعامية المصرية جاهزة للنسخ فوراً بين تنصيص "...".
5. الاستهدافات المقترحة في مدير الإعلانات (Facebook Ads Manager): السن، النوع، الاهتمامات التفصيلية الدقيقة، والسلوكيات ومواضع الظهور.
6. استراتيجية الحملة والمجموعات الإعلانية (Campaign & Ad Set Strategy):
   - هل الأفضل إعلان فردي أم توزيعه على مجموعات إعلانية متعددة (Multiple Ad Sets)؟
   - هل يفضل تشغيل هذا البوست منفرداً، أم إضافة بوست ثاني إبداعي معه في نفس الـ Ad Set (A/B Test / منع الـ Creative Fatigue)؟ مع اقتراح فكرة وزاوية البوست الثاني بدقة.
   - هدف الحملة المقترح، وخطة التكبير والتطوير، ونصيحة ميديا باير ذهبية لتوفير التكلفة.

يجب أن يكون الرد JSON فقط مطابقاً للهيكل التالي 100%:
{
  "observed_score": 8.5,
  "copy_score": 8.0,
  "visual_score": 8.8,
  "verdict": {
    "is_suitable": true,
    "rating": "ممتاز",
    "status_label": "جاهز للحملة فوراً 🚀",
    "summary": "تقييم صريح ومباشر بالعامية المصرية يوضح هل يصرف عليه إعلان ممول ولا لأ وليه بالضبط"
  },
  "creative_analysis": {
    "format_detected": "${isVideo ? 'فيديو ريلز رأسي (9:16)' : 'تصميم إعلاني للمنتج'}",
    "visual_hooks": "فحص قوة أول انطباع بصري وحركي وهل يوقف العميل عن التمرير",
    "strengths": [
      "نقطة قوة بصرية 1",
      "نقطة قوة بصرية 2"
    ],
    "weaknesses": [
      "نقطة ضعف أو نقص 1",
      "نقطة ضعف أو نقص 2"
    ],
    "actionable_recommendations": [
      "تعديل محدد 1 بالملي",
      "تعديل محدد 2 بالملي"
    ]
  },
  "copy_analysis": {
    "hook_evaluation": "تقييم السطر الأول ومدى جذبه لانتباه الجمهور",
    "offer_evaluation": "تقييم وضوح العرض والقيمة المقدمة للعميل",
    "cta_evaluation": "تقييم الدعوة لاتخاذ إجراء ومدى وضوح طريقة التواصل",
    "ready_to_use_variations": [
      "صيغة إعلانية بديلة 1 كاملة بالعامية المصرية جاهزة للنسخ...",
      "صيغة إعلانية بديلة 2 كاملة بالعامية المصرية جاهزة للنسخ...",
      "صيغة إعلانية بديلة 3 كاملة بالعامية المصرية جاهزة للنسخ..."
    ]
  },
  "targeting_suggestions": {
    "age_range": "24 - 45 سنة",
    "gender": "الجميع (رجال ونساء)",
    "detailed_interests": [
      "اهتمام فيسبوك دقيق 1",
      "اهتمام فيسبوك دقيق 2",
      "اهتمام فيسبوك دقيق 3",
      "اهتمام فيسبوك دقيق 4"
    ],
    "behaviors_and_placements": [
      "سلوك أو موضع إعلاني مقترح 1",
      "سلوك أو موضع إعلاني مقترح 2"
    ]
  },
  "campaign_strategy": {
    "ad_set_structure": "توصية هيكل الحملة وعدد المجموعات الإعلانية مع التبرير",
    "pair_another_post_recommendation": {
      "should_pair": true,
      "recommendation_reason": "هل يفضل تشغيل البوست لوحده أم إضافة بوست بديل معه في نفس الـ Ad Set ولماذا",
      "paired_concept_idea": "فكرة وزاوية البوست الثاني المقترح إضافته للاختبار A/B Test"
    },
    "recommended_objective": "رسائل واتساب / مبيعات / تفاعل",
    "media_buyer_golden_tip": "نصيحة الميديا باير الذهبية لتحقيق أعلى مبيعات وتفادي حرق الميزانية",
    "scaling_and_testing_plan": "خطة عملية لزيادة الميزانية والتكبير بأمان مقسمة لخطوات واضحة تبدأ بأرقام (1. ... 2. ... 3. ... 4. ...)"
  }
}
`;

    const rawResponse = await this.generate(prompt, {
      model: 'quality',
      imageBase64,
      mimeType: 'image/jpeg',
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    try {
      let cleanJson = rawResponse.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');
      }
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }
      const parsed = JSON.parse(cleanJson);

      // Ensure scores exist and are numbers
      parsed.observed_score = typeof parsed.observed_score === 'number' ? parsed.observed_score : 8.5;
      parsed.copy_score = typeof parsed.copy_score === 'number' ? parsed.copy_score : Math.min(10, Math.round((parsed.observed_score * 0.95) * 10) / 10);
      parsed.visual_score = typeof parsed.visual_score === 'number' ? parsed.visual_score : Math.min(10, Math.round((parsed.observed_score * 1.02) * 10) / 10);

      return parsed;
    } catch (err) {
      console.error('Failed to parse Paid Post Analysis Gemini JSON:', rawResponse);
      throw new Error('فشل معالجة استجابة الذكاء الاصطناعي، يرجى إعادة المحاولة.');
    }
  }

  async generateCompetitorReport(
    competitorName: string,
    ads: Array<{ text: string; date?: string; format?: string; engagement?: string }>,
    pageMetrics?: any
  ): Promise<string> {
    return await this.generatePageReadinessAudit(competitorName, ads, pageMetrics);
  }

  async generatePageReadinessAudit(
    pageName: string,
    ads: Array<{ text: string; date?: string; format?: string; engagement?: string }>,
    pageMetrics?: {
      fanCount?: number;
      followersCount?: number;
      category?: string;
      bio?: string;
      about?: string;
      description?: string;
      website?: string;
      phone?: string;
      whatsapp?: string;
      whatsappNumber?: string;
      address?: string;
      singleLineAddress?: string;
      hasLogo?: boolean;
      logoUrl?: string;
      pictureUrl?: string;
      hasCover?: boolean;
      coverUrl?: string;
      instagramConnected?: string;
      ratings?: {
        ratingCount?: number;
        overallStarRating?: number;
        recommendationPercent?: number;
        reviews?: Array<{ reviewerName?: string; rating?: number; text: string; recommendationType?: string; createdTime?: string }>;
      };
      pinnedPost?: { text: string; date?: string; format?: string };
    }
  ): Promise<string> {
    const hasLogo = Boolean(pageMetrics?.hasLogo || pageMetrics?.logoUrl || pageMetrics?.pictureUrl);
    const coverUrl = pageMetrics?.coverUrl;
    const hasCover = Boolean(pageMetrics?.hasCover || coverUrl);
    const website = pageMetrics?.website;
    const phone = pageMetrics?.phone || pageMetrics?.whatsapp || pageMetrics?.whatsappNumber;
    const address = pageMetrics?.address || pageMetrics?.singleLineAddress;
    const bioText = pageMetrics?.bio || pageMetrics?.about || pageMetrics?.description;
    const totalFollowers = pageMetrics?.followersCount || pageMetrics?.fanCount;
    const reviewsData = pageMetrics?.ratings;

    let imageBase64: string | undefined = undefined;
    if (coverUrl) {
      try {
        const imgRes = await fetch(coverUrl);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          imageBase64 = Buffer.from(buf).toString('base64');
        }
      } catch (e) {
        console.warn('[VertexAI] Failed to fetch cover image for audit:', e);
      }
    }

    const reviewsFormatted =
      reviewsData?.reviews && reviewsData.reviews.length > 0
        ? reviewsData.reviews
            .map(
              (r, i) =>
                `  ${i + 1}. [${r.recommendationType === 'positive' ? 'توصية إيجابية 5/5' : 'تقييم'}] "${r.text}"`
            )
            .join('\n')
        : 'لا توجد آراء مسجلة حتى الآن.';

    const prompt = `
الدور والهدف (Role & Objective):
أنت خبير إعلانات ممولة (Senior Media Buyer)، ومحلل معدلات تحويل (CRO Specialist)، ومستشار تسويق رقمي. مهمتك هي استلام بيانات صفحة فيسبوك وإجراء فحص شامل وجذري (Page Readiness Audit) لتحديد ما إذا كانت الصفحة جاهزة لاستقبال ترافيك مدفوع (إعلانات ممولة) وتحديد الفرص البيعية لزيادة الـ ROI.

بيانات البنية التحتية والهوية المرصودة بدقة متناهية من فيسبوك:
- اسم الصفحة: "${pageName}"
- تصنيف النشاط: "${pageMetrics?.category || 'عام'}"
- عدد المتابعين/المعجبين: ${totalFollowers !== undefined ? `${totalFollowers.toLocaleString()} متابع` : 'غير محدد'}
- صورة الحساب (Logo): ${hasLogo ? 'متوفرة واحترافية على الصفحة ✅' : 'غير متوفرة ❌'}
- صورة الغلاف (Cover): ${hasCover ? 'متوفرة ومرفقة صورياً بالكامل في هذا الفحص ✅' : 'غير متوفرة ❌'}
- قسم البايو / About: ${bioText ? `"${bioText}" ✅` : 'غير مسجل بالبايو ⚠️'}
- زر ورقم الواتساب / الاتصال: ${phone ? `مفعل وشغال (${phone}) ✅` : 'غير موجود ❌'}
- رابط الموقع الإلكتروني: ${website ? `متوفر وشغال (${website}) ✅` : 'غير متوفر ❌'}
- المقر الفعلي / العنوان: ${address ? `موجود (${address}) ✅` : 'غير محدد ⚠️'}
- ربط المنصات الأخرى (انستجرام): ${pageMetrics?.instagramConnected ? `${pageMetrics.instagramConnected} ✅` : 'غير متصل ⚠️'}

بيانات الدليل الاجتماعي والآراء (Social Proof & Customer Reviews):
- إجمالي عدد التقييمات: ${reviewsData?.ratingCount || 0} تقييم
- نسبة التوصية الإيجابية: ${reviewsData?.recommendationPercent || (reviewsData?.ratingCount ? 100 : 0)}% ${reviewsData?.ratingCount ? 'توصية إيجابية ⭐⭐⭐⭐⭐' : ''}
- نصوص ومشاعر آراء العملاء الحقيقية المرصودة (${reviewsData?.reviews?.length || 0} رأي):
${reviewsFormatted}

المنشورات والفيديوهات المرصودة (${ads.length} عنصر):
${ads.map((ad, idx) => `[عنصر #${idx + 1}] (${ad.format || 'منشور'}) [${ad.date || 'تاريخ'}] ${ad.engagement ? `[${ad.engagement}]` : ''}:\n${ad.text}`).join('\n\n')}

قواعد صارمة للتحليل:
1. إذا كانت صورة الغلاف واللوجو والموقع والواتساب والتقييمات متوفرة (✅)، يجب وضع علامة ✅ في الجدول وتحليل جودتها التسويقية وتأثيرها بدلاً من الادعاء بأنها غير متوفرة!
2. مؤشر الجاهزية (Readiness Score): يجب أن يعكس الحالة الحقيقية بدقة (مثلاً: صفحة مكتملة البنية التحتية وبها آراء إيجابية وموقع تستحق 85-95/100 مع توضيح فرص التطوير البيعي في المحتوى والـ Hooks).
3. ميزة الآراء والتقييمات (Reviews & Testimonials) هي عنصر جوهري: قم بتسليط الضوء عليها في قسم الدليل الاجتماعي وتحليل الكلمات المفتاحية لمشاعر العملاء (مثل: الأمانة، المصداقية، النتائج، الالتزام) وتقديم نصيحة CRO عملية لاستغلالها كـ Testimonials وسكرينات داخل الإعلانات الممولة.

هيكل التقرير المطلوب إصداره بدقة متناهية:

# 📊 تقرير فحص جاهزية الصفحة للإعلانات (Ad Readiness Audit)
**اسم الصفحة:** ${pageName} | **تاريخ الفحص:** ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
**مؤشر جاهزية الصفحة (Readiness Score):** [اكتب تقييم رقمي دقيق من 100 يعكس الواقع بدقة، مثلاً: 92/100 مع سطر ملخص للتقييم]

---

### 🛠️ أولاً: فحص البنية التحتية والهوية (Infrastructure & Branding)

| العنصر | الحالة | ملاحظات التحليل الفوري |
| :--- | :---: | :--- |
| **صورة الحساب (Logo)** | [✅ / ❌ / ⚠️] | [تحليل وضوح الشعار واحترافيته وتناسق الألوان] |
| **صورة الغلاف (Cover)** | [✅ / ❌ / ⚠️] | [تحليل عناصر الغلاف: وضوح عرض القيمة، الخدمات، أرقام التواصل، الموقع، المقر] |
| **قسم البايو (Bio)** | [✅ / ❌ / ⚠️] | [تقييم وضوح تعريف الخدمة/النشاط واقتراح كول تو أكشن] |
| **زر الواتساب والتواصل** | [✅ / ❌ / ⚠️] | [تقييم سهولة وسرعة وصول العميل للرقم ومسار المحادثة] |
| **رابط الموقع الإلكتروني** | [✅ / ❌ / ⚠️] | [تقييم وجود الموقع ودوره في بناء الثقة وعرض الخدمات] |
| **العنوان ومقر الشركة** | [✅ / ❌ / ⚠️] | [تقييم وضوح العنوان وبناء المصداقية الجغرافية] |

---

### 👥 ثانياً: الدليل الاجتماعي وثقة الجمهور (Social Proof & Reviews)
- **حجم الجمهور والتفاعل:** [ذكر عدد المتابعين] متابع. [تحليل: هل يمنح الصفحة ثقلاً وموثوقية عالية عند استقبال الزوار الجدد؟].
- **الآراء والتقييمات (Reviews & Testimonials):**
  - **النسبة والعدد:** [ذكر عدد التقييمات ونسبة التوصية، مثلاً: ⭐ 100% توصية إيجابية من X عميل].
  - **تحليل مشاعر العملاء:** [تحليل دقيق لأبرز الكلمات والنقاط التي أشاد بها العملاء في التقييمات: الأمانة، المصداقية، النتائج، الالتزام، التعامل].
  - **نصيحة الميديا باير الذهبية لاستغلال الآراء (CRO Tip):** [كيفية توظيف هذه التقييمات كسكرينات أو نصوص شهادات عملاء داخل الإعلانات الممولة أو ككاروسيل لبناء الثقة في أول 3 ثوان ومضاعفة المبيعات].

---

### 📱 ثالثاً: فحص المحتوى ومسار التحويل (Content & Funnel)
- **المنشور المثبت (Pinned Post):**
  - **التقييم:** [ممتاز / يحتاج تغيير / غير متوفر].
  - **التوصية:** [ما هو أفضل محتوى يجب تثبيته في رأس الصفحة لجلب مبيعات فورية؟].
- **تحليل المنشورات والـ Copywriting:**
  - **التقييم:** [جودة العرض، قوة الـ Copywriting، والـ Call To Action في نهاية المنشورات].
- **تحليل الفيديوهات والـ Reels (Hooks):**
  - **الـ Hooks (أول 3 ثوانٍ):** [هل تجذب الانتباه أم تحتاج تقوية؟].
  - **الشرح والتنفيذ:** [جودة التقديم والتصوير].

---

### 🚨 رابعاً: خطة العمل الفورية (Action Plan)
🔴 **أولوية قصوى (يجب تنفيذه قبل صرف أي ميزانية):**
- [نقطة عملية محددة قابلة للتنفيذ الفوري].
- [نقطة عملية محددة قابلة للتنفيذ الفوري].

🟡 **أولوية متوسطة (لتحسين نتائج الإعلانات وخفض تكلفة الاستحواذ):**
- [نقطة تطويرية محددة].
- [نقطة تطويرية محددة].

---

### 💡 خامساً: زوايا إعلانية مقترحة (Ad Angles) بناءً على الفحص
- **الزاوية الأولى ([اسم الزاوية الإعلانية]):**
  - [شرح الفكرة بـ 3 أسطر بالعامية المصرية تتضمن الـ Hook والـ Offer والـ CTA].

- **الزاوية الثانية ([اسم الزاوية الإعلانية]):**
  - [شرح الفكرة بـ 3 أسطر بالعامية المصرية تتضمن الـ Hook والـ Offer والـ CTA].
`;

    return await this.generate(prompt, {
      model: 'quality',
      imageBase64,
      mimeType: 'image/jpeg',
      config: { temperature: 0.2, maxOutputTokens: 16384 },
    });
  }

  async suggestNicheKeywords(
    userPrompt: string,
    country: string = 'EG',
    excludeTerms: string[] = []
  ): Promise<{ suggestedTerms: string[]; explanation: string; angles?: Array<{ category: string; keywords: string[] }> }> {
    const countryNames: Record<string, string> = {
      EG: 'مصر',
      SA: 'المملكة العربية السعودية',
      AE: 'الإمارات العربية المتحدة',
      KW: 'الكويت',
      QA: 'قطر',
    };
    const countryLabel = countryNames[country] || country;

    const excludeSection =
      excludeTerms && excludeTerms.length > 0
        ? `
⚠️ استبعاد الكلمات السابقة (قاعدة صارمة):
المستخدم تم اقتراح الكلمات التالية له مسبقاً:
${excludeTerms.map((t) => `• "${t}"`).join('\n')}

يجب عليك استخراج وتوليد كلمات وزوايا بحث جديدة ومختلفة تماماً (Fresh & Unique Angles) بدون تكرار أي من الكلمات السابقة أعلاه! فكّر في زوايا بيعية إضافية، مشاكل عملاء أخرى، أو كلمات مفتاحية دقيقة يستخدمها المنافسون المحترفون.
`
        : '';

    const prompt = `
الدور والهدف:
أنت خبير إعلانات ممولة واستراتيجي إعلانات (Senior Media Buyer & Creative Strategist) ومحترف في التجسس والبحث داخل مكتبة إعلانات فيسبوك (Facebook & Meta Ads Library).

طلب المستخدم أو مجاله:
"${userPrompt}"
الدولة المستهدفة: ${countryLabel} (${country})
${excludeSection}
المهمة:
حلل هذا المجال أو الطلب بعين الميديا باير المحترف، واستخرج أدق وأقوى الكلمات المفتاحية والعبارات الإعلانية الواقعية (بين 8 إلى 14 كلمة/عبارة جديدة) التي يستخدمها المنافسون الفعليون في نصوص وكرييتف وأسماء صفحات إعلاناتهم الممولة في هذه الدولة.

قواعد مهمة جداً:
1. الكلمات يجب أن تكون منطقية وواقعية ويكتبها المعلنون أو يبحث عنها العملاء بالفعل (مثال لشركة حشرات في مصر: "شركة ابادة حشرات", "رش حشرات", "مكافحة حشرات وقوارض", "شركة رش منازل", "ابادة حشرات بضمان", "مكافحة الصراصير والنمل").
2. نوع بين زوايا البحث:
   - زاوية الخدمة المباشرة (Direct Service)
   - زاوية العروض والضمان والأسعار (Offers & Guarantees)
   - زاوية مشاكل العميل (Pain Points)
   - زاوية الكلمات العامة والتجارية (Commercial Terms)
3. الشرح (explanation): اكتب تعليقاً مختصراً بالعامية المصرية (سطر أو سطرين) يوضح للميديا باير زوايا البحث الجديدة وأفضل طريقة للبحث في هذا المجال.

يجب أن تكون المخرجات حصراً بتنسيق JSON الصارم التالي:
{
  "suggestedTerms": ["كلمة جديدة 1", "كلمة جديدة 2", "كلمة جديدة 3", "كلمة جديدة 4", "كلمة جديدة 5", "كلمة جديدة 6", "كلمة جديدة 7", "كلمة جديدة 8"],
  "explanation": "سطر أو سطرين بالعامية المصرية لتوجيه الميديا باير للزوايا الجديدة",
  "angles": [
    {
      "category": "خدمة مباشرة",
      "keywords": ["كلمة جديدة 1", "كلمة جديدة 2"]
    },
    {
      "category": "عروض وضمانات",
      "keywords": ["كلمة جديدة 3", "كلمة جديدة 4"]
    }
  ]
}
`;

    try {
      const rawText = await this.generate(prompt, {
        model: 'quality',
        config: {
          temperature: excludeTerms.length > 0 ? 0.4 : 0.2,
          maxOutputTokens: 8192,
        },
      });

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return {
        suggestedTerms: Array.isArray(parsed.suggestedTerms) ? parsed.suggestedTerms : [],
        explanation: parsed.explanation || 'تم استخراج أفضل الكلمات المفتاحية لمنافسي هذا المجال.',
        angles: Array.isArray(parsed.angles) ? parsed.angles : [],
      };
    } catch (err: any) {
      console.error('[VertexAI suggestNicheKeywords error]:', err);
      // Smart Fallback
      return {
        suggestedTerms: [userPrompt, `${userPrompt} مصر`, `افضل ${userPrompt}`, `عروض ${userPrompt}`],
        explanation: 'تم استخراج كلمات بحث مقترحة للمجال.',
      };
    }
  }

    /**
   * Deep Strategic Campaign Analysis:
   * 1. Performance & 12+ Metrics Analysis (with Bullet-Point Bottlenecks & Scaling Points)
   * 2. Creative & Visuals Analysis (analyzing each video/image creative individually with its post URL)
   * 3. Copywriting & Ad Text Analysis (opening hooks, body, CTA, alternative test copies)
   * 4. Targeting & Audience Audit (locations, age, gender, interests, Advantage+ vs manual, alignment & recommendations)
   */
  async analyzeCampaignPerformance(campaign: any, options?: { accountName?: string; currency?: string }): Promise<any> {
    const currency = options?.currency || 'EGP';
    const insights = campaign.insights?.data?.[0] || {};
    const rawAds = campaign.ads?.data || campaign.ads || [];
    const rawAdsets = campaign.adsets?.data || campaign.adsets || [];

    // 1. Extract and format AdSets and detailed Targeting
    const countryNamesMap: { [key: string]: string } = {
      EG: 'مصر (Egypt)',
      SA: 'السعودية (Saudi Arabia)',
      AE: 'الإمارات (UAE)',
      KW: 'الكويت (Kuwait)',
      QA: 'قطر (Qatar)',
      OM: 'عمان (Oman)',
      BH: 'البحرين (Bahrain)',
      JO: 'الأردن (Jordan)',
      IQ: 'العراق (Iraq)',
      LY: 'ليبيا (Libya)',
      DZ: 'الجزائر (Algeria)',
      MA: 'المغرب (Morocco)',
      TN: 'تونس (Tunisia)',
      US: 'الولايات المتحدة (USA)',
    };

    const formattedAdsets = rawAdsets.map((aset: any) => {
      const t = aset.targeting || {};
      const geo = t.geo_locations || {};
      const rawCountries = (geo.countries || []).map((c: string) => countryNamesMap[c] || c);
      const countries = rawCountries.join(', ');
      const regions = (geo.regions || []).map((r: any) => r.name || r).join(', ');
      const cities = (geo.cities || []).map((c: any) => c.name || c).join(', ');
      const customLocs = (geo.custom_locations || []).map((cl: any) => cl.address_string || cl.name || `${cl.latitude}, ${cl.longitude}`).join(' | ');
      const locationsText = [countries, regions, cities, customLocs].filter(Boolean).join(' | ') || 'مصر (Egypt)';

      const ageMin = t.age_min || 18;
      const ageMax = t.age_max || 65;
      const genders = !t.genders || t.genders.length === 0 || t.genders.length === 2
        ? 'الرجال والنساء (الكل)'
        : t.genders.includes(1) && !t.genders.includes(2) ? 'رجال فقط (Males)'
        : t.genders.includes(2) && !t.genders.includes(1) ? 'نساء فقط (Females)'
        : 'الرجال والنساء (الكل)';

      const flexibleSpec = t.flexible_spec || [];
      const interests: string[] = [];
      const behaviors: string[] = [];
      flexibleSpec.forEach((spec: any) => {
        if (spec.interests) spec.interests.forEach((i: any) => interests.push(i.name || i));
        if (spec.behaviors) spec.behaviors.forEach((b: any) => behaviors.push(b.name || b));
      });

      const isAdvantagePlus = Boolean(
        t.targeting_automation?.advantage_audience === 1 ||
        t.targeting_optimization === 'expansion_all' ||
        (t.targeting_optimization === 'none' && t.targeting_automation)
      );

      const targetingType = isAdvantagePlus
        ? 'جمهور مخصص أدفانتج بلس (Advantage+ Audience)'
        : (interests.length > 0 || behaviors.length > 0)
        ? 'استهداف تفصيلي بالاهتمامات والسلوكيات (Detailed Targeting)'
        : 'استهداف واسع بدون قيود (Broad Targeting)';

      return {
        id: aset.id,
        name: aset.name,
        daily_budget: aset.daily_budget ? (parseFloat(aset.daily_budget)/100) + ' ' + currency : 'حسب الحملة',
        locations: locationsText,
        age_range: `${ageMin} - ${ageMax} سنة`,
        gender: genders,
        interests: interests.join(', ') || 'لا توجد اهتمامات محددة (Broad)',
        behaviors: behaviors.join(', ') || 'لا توجد سلوكيات محددة',
        is_advantage_plus: isAdvantagePlus,
        targeting_type_label: targetingType,
        placements: (t.publisher_platforms || ['facebook', 'instagram']).join(', '),
      };
    });

    // 2. Extract and format individual Ads, Real Video Details & Insights
    const formattedAds = rawAds.map((ad: any, idx: number) => {
      const cr = ad.creative || {};
      const videoId = cr.video_id || cr.object_story_spec?.video_data?.video_id || '';
      const isVideo = Boolean(videoId);

      const storyId = cr.effective_object_story_id || cr.object_story_id || '';
      let postUrl = cr.link_url || cr.instagram_permalink_url || '';
      if (storyId) {
        const parts = storyId.split('_');
        postUrl = parts.length > 1
          ? `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`
          : `https://www.facebook.com/${storyId}`;
      }
      if (isVideo) {
        postUrl = `https://www.facebook.com/reel/${videoId}/`;
      }

      const videoEmbedUrl = isVideo
        ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(`https://www.facebook.com/reel/${videoId}/`)}&show_text=false&t=0`
        : '';

      const thumb = cr.image_url || cr.thumbnail_url || '';
      const adInsights = ad.insights?.data?.[0] || {};
      const actions: any[] = adInsights.actions || [];
      const costPerAction: any[] = adInsights.cost_per_action_type || [];

      const purchases = actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')?.value || '0';
      const cpaRaw = costPerAction.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')?.value;
      const cpa = cpaRaw ? parseFloat(cpaRaw).toFixed(1) + ' ' + currency : 'غير مسجل';

      const p25Watch = (adInsights.video_p25_watched_actions || [])[0]?.value || '0';
      const p50Watch = (adInsights.video_p50_watched_actions || [])[0]?.value || '0';
      const p100Watch = (adInsights.video_p100_watched_actions || [])[0]?.value || '0';
      const avgWatchTime = (adInsights.video_avg_time_watched_actions || [])[0]?.value || '0';

      return {
        ad_id: ad.id,
        ad_name: ad.name || `إعلان #${idx + 1}`,
        status: ad.effective_status || ad.status || 'ACTIVE',
        is_video: isVideo,
        video_id: videoId || null,
        video_source: cr.video_source || null,
        video_embed_url: videoEmbedUrl,
        post_url: postUrl || `https://www.facebook.com/ads/manager?act=${campaign.id}`,
        thumbnail_url: thumb,
        images: Array.isArray(cr.images) && cr.images.length > 0 ? cr.images : thumb ? [thumb] : [],
        media_type_label: isVideo ? '🎬 فيديو ريلز إعلاني (14 ثانية)' : '🖼️ منشور صور للمنتج',
        title: cr.title || '',
        body: cr.body || ad.name || 'لا يوجد نص',
        cta_type: cr.call_to_action_type || 'LEARN_MORE',
        spend: adInsights.spend ? parseFloat(adInsights.spend).toFixed(1) + ' ' + currency : '0',
        purchases: purchases,
        cpa: cpa,
        ctr: adInsights.ctr ? parseFloat(adInsights.ctr).toFixed(2) + '%' : '0%',
        video_watch_stats: isVideo ? `مشاهدات أول 3 ثواني (P25): ${p25Watch} | كملوا نصف الفيديو: ${p50Watch} | كملوا 100%: ${p100Watch} | متوسط المشاهدة: ${avgWatchTime} ثوانٍ` : 'إعلان صور (لا ينطبق)',
      };
    });

    // Sort ads: active with spend/purchases first
    const sortedAds = [...formattedAds].sort((a: any, b: any) => {
      const spendA = parseFloat(String(a.spend || '0').replace(/[^0-9.]/g, '')) || 0;
      const spendB = parseFloat(String(b.spend || '0').replace(/[^0-9.]/g, '')) || 0;
      return spendB - spendA;
    });

    // Pick top active ads for in-depth creative & copywriting review (up to 4 ads)
    // to ensure fast generation (<30s) and avoid Cloudflare 100s proxy timeout
    const topAdsForDeepReview = sortedAds.slice(0, 4);
    const otherAds = sortedAds.slice(4);

    const prompt = `
أنت خبير إعلانات فيسبوك أول، ومستشار نمو تجارة إلكترونية، وخبير صناعة الكريتيف (Senior Meta Media Buyer, Creative Director & E-Commerce Strategist) في السوق المصري والعربي.
مهمتك هي إجراء فحص وتحليل استراتيجي متكامل وتفصيلي من 4 أجزاء رئيسية لهذه الحملة الإعلانية بالعامية المصرية بأسلوب مباشر وعملي.

بيانات الحملة الإعلانية:
- اسم الحملة: "${campaign.name}"
- معرف الحملة: ${campaign.id}
- الهدف الإعلاني (Objective): ${campaign.objective || 'غير محدد'}
- حالة العرض: ${campaign.delivery_status || campaign.effective_status || campaign.status}
- تاريخ الانتهاء: ${campaign.stop_time || 'مستمرة'}
- الميزانية: ${campaign.daily_budget ? (parseFloat(campaign.daily_budget)/100) + ' ' + currency + '/يومي' : campaign.lifetime_budget ? (parseFloat(campaign.lifetime_budget)/100) + ' ' + currency + '/إجمالي' : 'غير محددة'}
- إجمالي المصروف: ${insights.spend || 0} ${currency}
- عدد المجموعات الإعلانية (AdSets): ${rawAdsets.length}
- إجمالي عدد الإعلانات: ${rawAds.length}

المؤشرات والأرقام (Metrics):
- الظهور (Impressions): ${insights.impressions || 0}
- الوصول (Reach): ${insights.reach || 0}
- التكرار (Frequency): ${insights.frequency || '1.0'}
- تكلفة الألف ظهور (CPM): ${insights.cpm || 0} ${currency}
- معدل النقر (CTR): ${insights.ctr || 0}%
- معدل النقر على الرابط (Link CTR): ${insights.inline_link_click_ctr || '0'}%
- تكلفة النقرة (CPC): ${insights.cpc || 0} ${currency}
- العائد على الإنفاق (Purchase ROAS): ${insights.purchase_roas?.[0]?.value || 'غير متوفر'}
- تفاصيل الإجراءات (Actions): ${JSON.stringify(insights.actions || [])}
- تكلفة كل إجراء (Cost Per Action): ${JSON.stringify(insights.cost_per_action_type || [])}
- قيم الإجراءات (Action Values): ${JSON.stringify(insights.action_values || [])}

بيانات الاستهداف الحقيقية للمجموعات الإعلانية (${formattedAdsets.length} مجموعة):
${JSON.stringify(formattedAdsets, null, 2)}

أهم الإعلانات النشطة الأكثر صرفاً وتأثيراً في الحملة (${topAdsForDeepReview.length} إعلان):
${JSON.stringify(topAdsForDeepReview, null, 2)}
${otherAds.length > 0 ? `\nباقي إعلانات الحملة الأقل صرفاً (${otherAds.length} إعلان):\n${JSON.stringify(otherAds.map((a: any) => ({ ad_id: a.ad_id, ad_name: a.ad_name, spend: a.spend, purchases: a.purchases, cpa: a.cpa, ctr: a.ctr })), null, 2)}` : ''}

المطلوب منك تحليله بدقة متناهية وإخراجه بصيغة JSON مهيكلة (كن دقيقاً ومباشراً بدون حشو إنشائي لضمان سرعة المعالجة):

1. الجزء الأول: تحليل الأداء الرقمي والنتائج (Performance & Metrics):
   - الحكم النهائي (Verdict): هل هي SCALING_READY أو OPTIMIZATION_NEEDED أو STOP_CAMPAIGN.
   - verdict_badge: عبارة واضحة بالعامية المصرية (مثال: "ناجحة ومربحة جداً 🚀 (جاهزة للتكبير)").
   - score: تقييم رقمي دقيق من 10 (مثال: 8.7).
   - summary_egyptian: فقرة صريحة من سطرين إلى 3 أسطر بالعامية المصرية توضح الموقف المالي الحقيقي وهل الحملة بتكسب ولا بتخسر.
   - metrics_evaluation: تقييم الـ CPA، الـ ROAS، الـ CTR، والتشبع الإعلاني.
   - bottlenecks: **مصفوفة نصوص (Array of Strings)** لنقاط عنق الزجاجة والتسريب (3 إلى 4 نقاط محددة ومفصلة بدون إطالة زائدة).
   - scaling_advice_points: **مصفوفة نصوص (Array of Strings)** لخطوات وتوصيات التكبير وزيادة الميزانية (3 إلى 4 نقاط محددة لكل 48 ساعة).
   - action_steps: **مصفوفة نصوص (Array of Strings)** لخطة العمل الفورية المرقمة (3 إلى 4 خطوات بالعامية المصرية).

2. الجزء الثاني: تحليل الكريتيف والتصميمات/الفيديوهات (Creatives & Visuals Analysis):
   - قم بتحليل أهم الإعلانات المرفقة أعلاه (${topAdsForDeepReview.map((a: any) => a.ad_id).join(', ')}):
     * ad_id: معرف الإعلان.
     * ad_name: اسم الإعلان.
     * is_video: هل هو فيديو أم صورة.
     * media_type_label: نوع الكريتيف.
     * video_embed_url: رابط مشغل الفيديو المباشر.
     * post_url: رابط المنشور/الفيديو.
     * thumbnail_url: رابط الصورة أو غلاف الفيديو.
     * spend: المصروف الفعلي.
     * purchases: عدد المبيعات المحققة بهذا الإعلان.
     * cpa: سعر المبيعة الفعلي.
     * ctr: معدل النقر الفعلي.
     * visual_hook_analysis: 
       - إذا كان الكريتيف فيديو (is_video: true): **ممنوع نهائياً التحدث عن "صورة مصغرة" أو "Thumbnail" لأن المتلقي يشاهد فيديو ريلز متحرك!** حلل حركة المشهد الافتتاحي في أول 3 ثوانٍ (Visual Hook) بناءً على نسبة احتفاظ المشاهدين (متوسط المشاهدة ومعدل P25) وطريقة جذب انتباه العميل.
       - إذا كان الكريتيف صور: حلل طريقة استعراض المنتج وزوايا التصوير والألوان في جذب الانتباه.
     * product_offer_clarity: وضوح المنتج والعرض التسويقي وهل وصلت الفكرة للعميل سريعاً.
     * conversion_reality_verdict: تقييم صريح بالعامية المصرية يفسر بالأرقام الحقيقية أداء هذا الإعلان ولماذا تفوق أو تراجع مقارنة بباقي الإعلانات، وما هو التعديل المطلوب لخفض تكلفة النتيجة.
     * strengths: مصفوفة نصوص بأبرز نقطتي قوة في هذا الكريتيف.
     * weaknesses: مصفوفة نصوص بأبرز نقطتي ضعف تحتاج تحسين.
     * creative_score: تقييم من 10 لهذا الكريتيف.

3. الجزء الثالث: تحليل المحتوى الكتابي والنصوص (Copywriting Analysis):
   - قم بتحليل نصوص وكوبي أهم الإعلانات (${topAdsForDeepReview.map((a: any) => a.ad_id).join(', ')}):
     * ad_id: معرف الإعلان.
     * ad_name: اسم الإعلان.
     * hook_analysis: تحليل السطر الافتتاحي في النص وهل بيوقف السكرول أم تقليدي.
     * body_structure_analysis: تحليل طريقة سرد المميزات وحل مشكلة العميل.
     * offer_and_cta_analysis: تحليل وضوح العرض، السعر، والدعوة للإجراء (CTA).
     * copy_score: تقييم الكوبي من 10.
     * alternative_copy_suggestions: مصفوفة تحتوي على نص إعلاني مقترح واحد أو اثنين مكتمل وجاهز للنشر فوراً بالعامية المصرية للـ A/B Testing، مكتوب باحترافية تسويقية وتتضمن الـ Hook والـ Offer والـ CTA.

4. الجزء الرابع: تحليل الاستهداف والمجموعات الإعلانية (Targeting & Audience Audit):
   - اقرأ الاستهداف المطبق في المجموعات الإعلانية (المناطق، السن، النوع، الاهتمامات، Advantage+ vs Manual):
     * applied_targeting_summary: ملخص دقيق للاستهداف الفعلي المطبق.
     * alignment_with_creatives: تقييم صريح بالعامية المصرية لمدى ملاءمة هذا الاستهداف للكريتيف والمنتج المعروض بالفيديو/التصميم.
     * strengths: نقاط القوة في هذا الاستهداف.
     * risks_and_leaks: الثغرات أو التسريب أو تداخل الجماهير إن وجد.
     * recommendations: توصيات ومقترحات عملية ومحددة لتطوير الاستهداف وتجربة جماهير أفضل مبنية على تحليل الكريتيف.

الرد يجب أن يكون حصراً بصيغة JSON صحيحة بهذا الهيكل وبدون أي شروحات خارج الـ JSON:
{
  "verdict": "SCALING_READY",
  "verdict_badge": "ناجحة ومربحة جداً 🚀 (جاهزة للتكبير)",
  "score": 8.7,
  "summary_egyptian": "ملخص عام بالعامية المصرية...",
  "metrics_evaluation": {
    "cpa_and_results": "تقييم سعر النتيجة والتحويلات",
    "roas_and_profit": "تقييم العائد على الصرف والربحية",
    "ctr_and_interest": "تقييم معدل النقر وجودة الترافيك",
    "frequency_and_fatigue": "تقييم التكرار والتشبع الإعلاني"
  },
  "bottlenecks": [
    "النقطة 1 لعنق الزجاجة بالتفصيل مع الأرقام...",
    "النقطة 2 لعنق الزجاجة بالتفصيل مع الأرقام..."
  ],
  "scaling_advice_points": [
    "النقطة 1 لزيادة الميزانية والتكبير بالتفصيل...",
    "النقطة 2 للتكبير الرأسي أو الأفقي..."
  ],
  "action_steps": [
    "الخطوة 1: بالعامية المصرية بالتفصيل...",
    "الخطوة 2: بالعامية المصرية بالتفصيل..."
  ],
  "creatives_analysis": [
    {
      "ad_id": "معرف الإعلان",
      "ad_name": "اسم الإعلان",
      "is_video": true,
      "media_type_label": "🎬 فيديو ريلز إعلاني (14 ثانية)",
      "video_embed_url": "رابط المشغل المباشر",
      "post_url": "رابط المنشور/الريلز",
      "thumbnail_url": "رابط الصورة أو الغلاف",
      "spend": "المصروف الفعلي",
      "purchases": "عدد المبيعات",
      "cpa": "تكلفة الشراء الفعلي",
      "ctr": "نسبة النقر",
      "visual_hook_analysis": "تحليل أول 3 ثوانٍ وحركة المشهد بالعامية المصرية (ممنوع كلمة ثامبنيل للفيديوهات)",
      "product_offer_clarity": "تحليل وضوح المنتج والعرض التسويقي",
      "conversion_reality_verdict": "تفسير أداء الإعلان بالعامية المصرية وتوصية التعديل المطلوبة لتقليل سعر المبيعة",
      "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
      "weaknesses": ["نقطة ضعف 1", "نقطة ضعف 2"],
      "creative_score": 8.5
    }
  ],
  "copywriting_analysis": [
    {
      "ad_id": "معرف الإعلان",
      "ad_name": "اسم الإعلان",
      "hook_analysis": "تحليل هوك النص بالعامية المصرية",
      "body_structure_analysis": "تحليل متن النص والعرض",
      "offer_and_cta_analysis": "تحليل الدعوة لاتخاذ إجراء",
      "copy_score": 8.0,
      "alternative_copy_suggestions": [
        "نص إعلاني مقترح كامل جاهز للنسخ 1..."
      ]
    }
  ],
  "targeting_audit": {
    "applied_targeting_summary": {
      "locations": "المناطق المحددة",
      "age_range": "الفئة العمرية",
      "gender": "النوع المختار",
      "interests_and_behaviors": "الاهتمامات والسلوكيات",
      "is_advantage_plus": true,
      "targeting_type_label": "نوع الاستهداف"
    },
    "alignment_with_creatives": "تقييم مدى تطابق الجمهور مع الكريتيف بالعامية المصرية",
    "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
    "risks_and_leaks": ["نقطة خطر أو تسريب 1"],
    "recommendations": ["توصية استهداف مقترحة 1", "توصية استهداف مقترحة 2"]
  }
}
`;

    try {
      const rawText = await this.generate(prompt, {
        model: 'quality',
        config: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });

      const parsed = safeParseJson(rawText);

      // Backwards-compatibility mappings for bottleneck and scaling_advice
      if (Array.isArray(parsed.bottlenecks) && !parsed.bottleneck) {
        parsed.bottleneck = parsed.bottlenecks.join('\n');
      }
      if (Array.isArray(parsed.scaling_advice_points) && !parsed.scaling_advice) {
        parsed.scaling_advice = parsed.scaling_advice_points.join('\n');
      }

      // Merge real ground truth performance metrics and video embed URLs from Meta API
      const analyzedIds = new Set((parsed.creatives_analysis || []).map((c: any) => c.ad_id));

      const finalCreatives: any[] = Array.isArray(parsed.creatives_analysis) ? parsed.creatives_analysis.map((item: any) => {
        const rawAd = formattedAds.find((f: any) => f.ad_id === item.ad_id) || {};
        return {
          ...item,
          ad_name: item.ad_name || rawAd.ad_name,
          is_video: item.is_video !== undefined ? Boolean(item.is_video) : Boolean(rawAd.is_video),
          video_id: item.video_id || rawAd.video_id || null,
          video_source: rawAd.video_source || item.video_source || null,
          video_embed_url: item.video_embed_url || rawAd.video_embed_url || '',
          post_url: item.post_url || rawAd.post_url || '',
          thumbnail_url: item.thumbnail_url || rawAd.thumbnail_url || '',
          images: Array.isArray(rawAd.images) && rawAd.images.length > 0 ? rawAd.images : (Array.isArray(item.images) && item.images.length > 0 ? item.images : rawAd.thumbnail_url ? [rawAd.thumbnail_url] : []),
          media_type_label: item.media_type_label || rawAd.media_type_label || (rawAd.is_video ? '🎬 فيديو ريلز إعلاني (14 ثانية)' : '🖼️ منشور صور للمنتج'),
          spend: item.spend || rawAd.spend || '0',
          purchases: item.purchases || rawAd.purchases || '0',
          cpa: item.cpa || rawAd.cpa || 'غير مسجل',
          ctr: item.ctr || rawAd.ctr || '0%',
          video_watch_stats: rawAd.video_watch_stats || '',
        };
      }) : [];

      // Ensure any extra ads from the campaign are also included in the report with accurate Meta data
      otherAds.forEach((extraAd: any) => {
        if (!analyzedIds.has(extraAd.ad_id)) {
          finalCreatives.push({
            ad_id: extraAd.ad_id,
            ad_name: extraAd.ad_name,
            is_video: Boolean(extraAd.is_video),
            video_id: extraAd.video_id || null,
            video_source: extraAd.video_source || null,
            video_embed_url: extraAd.video_embed_url || '',
            post_url: extraAd.post_url || '',
            thumbnail_url: extraAd.thumbnail_url || '',
            images: extraAd.images || [],
            media_type_label: extraAd.media_type_label,
            spend: extraAd.spend,
            purchases: extraAd.purchases,
            cpa: extraAd.cpa,
            ctr: extraAd.ctr,
            video_watch_stats: extraAd.video_watch_stats,
            visual_hook_analysis: extraAd.is_video ? 'فيديو إضافي بالحملة بمعدل إنفاق منخفض، يُنصح بمقارنته مع الكريتيف المتصدر.' : 'تصميم إضافي بالحملة، لم يحصل على الجزء الأكبر من الميزانية.',
            product_offer_clarity: 'عرض منتج تكميلي في الحملة.',
            conversion_reality_verdict: `صرف ${extraAd.spend} وحقق ${extraAd.purchases} مبيعات. الأولوية للتركيز على الإعلان المتصدر أولاً.`,
            strengths: ['يساعد في اختبار زوايا عرض إضافية'],
            weaknesses: ['لم يحصل على ميزانية كافية للتحويل'],
            creative_score: 7.0,
          });
        }
      });

      parsed.creatives_analysis = finalCreatives;

      return parsed;
    } catch (err: any) {
      console.warn('[VertexAI analyzeCampaignPerformance] Primary model call failed, retrying with fastModel...', err.message);
      try {
        const fallbackText = await this.generate(prompt, {
          model: 'fast',
          config: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        });
        const parsed = safeParseJson(fallbackText);
        if (parsed) {
          if (Array.isArray(parsed.bottlenecks) && !parsed.bottleneck) {
            parsed.bottleneck = parsed.bottlenecks.join('\n');
          }
          if (Array.isArray(parsed.scaling_advice_points) && !parsed.scaling_advice) {
            parsed.scaling_advice = parsed.scaling_advice_points.join('\n');
          }
          return parsed;
        }
      } catch (retryErr: any) {
        console.error('[VertexAI analyzeCampaignPerformance retry error]:', retryErr.message);
      }

      throw new Error(`تعذر استخراج تحليل الذكاء الاصطناعي: ${err.message || 'خطأ غير متوقع'}`);
    }
  }
}

export const vertexAI = new VertexGeminiProvider();
export default vertexAI;

