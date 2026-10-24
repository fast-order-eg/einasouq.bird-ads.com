import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import metaTargetingDict from './meta-targeting-dictionary.json';

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

export interface DetailedInterestItem {
  interest: string;
  reason: string;
}

export interface AlternativeTargetingPlan {
  angle_name: string; // اسم الزاوية البديلة
  angle_rationale: string; // سبب وفكرة هذه الزاوية
  age_range: string;
  age_rationale?: string; // سبب ومبرر تحديد هذا السن بناء على القوة الشرائية وطبيعة المنتج
  gender: string;
  detailed_interests: Array<DetailedInterestItem | string>;
  behaviors: string;
  placements: string;
}

export interface PaidCampaignPostAnalysis {
  observed_score: number; // 1 to 10 (التقييم العام)
  copy_score: number; // 1 to 10 (تقييم المحتوى الإعلاني)
  visual_score: number; // 1 to 10 (تقييم الفيديو / التصميم)
  visual_score_label?: string; // "الفيديو" أو "التصميم"
  verdict: {
    is_suitable: boolean;
    rating?: 'ممتاز' | 'جيد جداً' | 'جيد' | 'ضعيف' | 'سيء جداً';
    decision_label?: string; // 🟢 جاهز للتمويل فوراً / 🟡 جاهز بعد تعديل بسيط / 🔴 غير مناسب لإعلان ممول
    status_label: string;
    summary: string;
  };
  creative_analysis: {
    format_detected: string;
    visual_hooks: string; // الهوك البصري أول 3 ثواني
    primary_strength?: string; // نقطة القوة الأساسية
    strengths?: string[];
    weaknesses?: string[];
    actionable_recommendations: string[]; // التعديل المطلوب فوراً (نقاط مرقمة 1، 2، 3)
  };
  copy_analysis: {
    hook_and_offer_evaluation?: string; // قوة الهوك والعرض
    hook_evaluation?: string;
    offer_evaluation?: string;
    cta_evaluation: string; // التوجيه Call To Action
    ready_to_use_variations?: string[];
  };
  targeting_suggestions: {
    age_range: string;
    age_rationale?: string; // سبب ومبرر تحديد هذا السن بناء على القوة الشرائية واحتياج المنتج
    gender: string;
    detailed_interests: Array<DetailedInterestItem | string>;
    behaviors?: string;
    placements?: string;
    behaviors_and_placements?: string[];
  };
  alternative_targeting?: AlternativeTargetingPlan;
  campaign_strategy: {
    recommended_objective?: string;
    media_buyer_golden_tip: string;
    daily_test_budget?: string;
    budget_type?: string;
    ad_set_structure?: string;
    pair_another_post_recommendation?: {
      should_pair: boolean;
      recommendation_reason: string;
      paired_concept_idea: string;
    };
    scaling_and_testing_plan?: string;
  };
}

export interface CampaignTargetingEvaluationParams {
  campaignName: string;
  adsetName?: string;
  postText: string;
  imageUrl?: string;
  mediaType?: 'VIDEO' | 'IMAGE' | 'CAROUSEL' | 'TEXT';
  userDirective?: string; // توجيهات الميديا باير الخاصة عند طلب استهداف بديل بملاحظات معينة
  currentTargeting: {
    ageRange: string;
    gender: string;
    locations: string;
    targetingType: string;
    placements?: {
      isAutomatic: boolean;
      typeLabel: string;
      formattedText: string;
      hasAudienceNetwork: boolean;
    };
    interests: string[];
    behaviors: string[];
    demographics: string[];
    exclusions: string[];
    isAdvantageAudience: boolean;
  };
}

export interface CampaignTargetingEvaluationResult {
  targeting_suitability_score: number; // 1 to 10
  verdict: {
    decision_label: string; // 🟢 استهداف متطابق ومثالي / 🟡 استهداف مقبول ويحتاج تحسين / 🔴 استهداف غير مناسب ويسبب هدر ميزانية
    status_label: string;
    summary: string;
  };
  suitability_analysis: string;
  current_targeting_critique: {
    strengths: string[];
    weaknesses: string[];
    keep_items?: string[]; // ما يجب الإبقاء عليه من الاستهداف الحالي لأنه شغال صح
    remove_items?: string[]; // ما يجب حذفه فوراً لأنه يسبب هدر ميزانية مع ذكر السبب
  };
  suggested_targeting: {
    suggested_age_range: string;
    suggested_age_rationale: string;
    suggested_gender: string;
    suggested_locations?: string;
    suggested_placements?: string;
    suggested_placements_plan?: {
      keep_placements: string[]; // المواضع التي ننصح بتشغيلها
      stop_placements: string[]; // المواضع التي ننصح بإيقافها مع ذكر السبب
    };
    detailed_interests: Array<{
      interest: string;
      reason: string;
    }>;
    behaviors?: string;
    narrowing_technique?: string; // خطوات تضييق الجمهور بزر "تقييد جمهورك بشكل أكبر" (Narrow Audience)
  };
  media_buyer_golden_tip: string;
}

export function safeParseJson(rawText: string): any {
  if (!rawText) return null;
  // Strip code block markers if any
  let clean = rawText.replace(/^```(?:json)?\s*/gim, '').replace(/```\s*$/gim, '').trim();

  // Attempt 1: Direct JSON.parse
  try {
    return JSON.parse(clean);
  } catch {}

  // Attempt 2: Extract outermost { ... }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = clean.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
    } catch {}
  }

  // Attempt 3: Robust truncation recovery (backtrack to last complete object/array element)
  try {
    let lastClose = clean.lastIndexOf('}');
    while (lastClose > clean.length / 3) {
      const sub = clean.slice(0, lastClose + 1);
      let openBrackets = 0;
      let closeBrackets = 0;
      let openBraces = 0;
      let closeBraces = 0;
      let inString = false;
      let escaped = false;

      for (let i = 0; i < sub.length; i++) {
        const c = sub[i];
        if (escaped) { escaped = false; continue; }
        if (c === '\\') { escaped = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === '{') openBraces++;
        else if (c === '}') closeBraces++;
        else if (c === '[') openBrackets++;
        else if (c === ']') closeBrackets++;
      }

      if (!inString && openBraces >= closeBraces && openBrackets >= closeBrackets) {
        let candidate = sub;
        while (openBrackets > closeBrackets) {
          candidate += ']';
          closeBrackets++;
        }
        while (openBraces > closeBraces) {
          candidate += '}';
          closeBraces++;
        }
        try {
          return JSON.parse(candidate);
        } catch {}
        try {
          return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
        } catch {}
      }
      lastClose = clean.lastIndexOf('}', lastClose - 1);
    }
  } catch (repairErr: any) {
    console.warn('[safeParseJson] Truncation recovery error:', repairErr.message);
  }

  // Attempt 4: Clean control characters inside strings only
  try {
    let inStr = false;
    let esc = false;
    let sanitized = '';
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      if (esc) {
        esc = false;
        sanitized += char;
        continue;
      }
      if (char === '\\') {
        esc = true;
        sanitized += char;
        continue;
      }
      if (char === '"') {
        inStr = !inStr;
        sanitized += char;
        continue;
      }
      if (inStr) {
        if (char === '\n') { sanitized += '\\n'; continue; }
        if (char === '\r') { sanitized += '\\r'; continue; }
        if (char === '\t') { sanitized += '\\t'; continue; }
      }
      sanitized += char;
    }
    return JSON.parse(sanitized);
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
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'fast-order-505012';
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    this.qualityModel = process.env.VERTEX_QUALITY_MODEL || 'gemini-3.8-flash';
    this.fastModel = process.env.VERTEX_FAST_MODEL || 'gemini-3.8-flash';

    // Flexible credential path resolution for local dev, Docker, and production servers
    const projectCredPath = path.join(process.cwd(), 'credentials', 'fast-order-505012-2adde4c0badf.json');
    const legacyCredPath = path.join(process.cwd(), 'credentials', 'google-service-account.json');
    const localRootCredPath = path.join(process.cwd(), 'google-credentials.json');
    const fallbackPath = 'E:/programing/flutter project/bot.bird-ads.com/fast-order-505012-2adde4c0badf.json';

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      this.credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else if (fs.existsSync(projectCredPath)) {
      this.credentialsPath = projectCredPath;
    } else if (fs.existsSync(legacyCredPath)) {
      this.credentialsPath = legacyCredPath;
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

    // Multi-region priority list: global endpoint is preferred for gemini-3.8-flash
    const candidateLocations = [
      this.location,
      'global',
      'europe-west4',
      'us-east4',
      'europe-west1',
      'us-central1',
    ].filter((v, i, a) => a.indexOf(v) === i);

    const executeCall = async (modelToUse: string, locationToUse: string, includeImage: boolean = true) => {
      const host = (locationToUse === 'global' || !locationToUse)
        ? 'aiplatform.googleapis.com'
        : `${locationToUse}-aiplatform.googleapis.com`;
      const url = `https://${host}/v1/projects/${this.projectId}/locations/${locationToUse}/publishers/google/models/${modelToUse}:generateContent`;

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

    // 1. Try primaryModel across candidate regions
    for (const loc of candidateLocations) {
      try {
        res = await executeCall(primaryModel, loc, true);
        if (res.ok) break;

        lastErrorText = await res.text();
        // If rate limited (429) or overloaded (503) or 404, try next region
        if (res.status === 429 || res.status === 503 || res.status === 404) {
          console.warn(`[Vertex AI] ${primaryModel} in ${loc} returned ${res.status}. Trying next region...`);
          continue;
        } else {
          break;
        }
      } catch (callErr: any) {
        lastErrorText = callErr.message;
      }
    }

    // 2. If all regions rate-limited with image, try primaryModel text-only
    if ((!res || !res.ok) && options.imageBase64) {
      console.warn(`[Vertex AI] Retrying text-only on ${primaryModel}...`);
      res = await executeCall(primaryModel, 'global', false);
    }

    // 3. Safeguard: if still failing, use fallbackModel
    if ((!res || !res.ok) && primaryModel !== fallbackModel) {
      console.warn(`[Vertex AI] Primary model failed, falling back to ${fallbackModel}...`);
      res = await executeCall(fallbackModel, 'global', true);
    }

    if (!res || !res.ok) {
      const errText = lastErrorText || (res ? await res.text() : 'No response');
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

    const totalEntitiesCount = metaTargetingDict.demographics.length + metaTargetingDict.behaviors.length + metaTargetingDict.interests.length;

    const fullTaxonomyReference = `
══════════════════════════════════════
📋 قاموس الاستهدافات الرسمية لفيسبوك المعتمدة في Bird Ads و Meta Ads Manager (اختر الاستهدافات حصرياً من هذه العناصر الـ ${totalEntitiesCount} الرسمية الشاملة):
• المناسبات والديموغرافيا الرسمية (${metaTargetingDict.demographics.length} عنصر):
${metaTargetingDict.demographics.map((d: any) => `[${d.en}] (${d.ar})`).join(' | ')}

• السلوكيات الرسمية (${metaTargetingDict.behaviors.length} عنصر):
${metaTargetingDict.behaviors.map((b: any) => `[${b.en}] (${b.ar})`).join(' | ')}

• الاهتمامات الرسمية (${metaTargetingDict.interests.length} عنصر):
${metaTargetingDict.interests.map((i: any) => `[${i.en}] (${i.ar})`).join(' | ')}
`;

    const prompt = `
أنت "عين السوق" 🦅، خبير الميديا باينج والتسويق الرقمي الأول في مصر والوطن العربي، المتخصص في التحليل الإعلاني التكتيكي السريع لبوستات وريلز فيسبوك وإنستجرام.
أسلوبك: بالعامية المصرية البيزنس، مختصر، ذكي، وسريع وبدون أي حشو أو كلام نظري.

بيانات المنشور:
- اسم الصفحة: ${options.pageName || 'صفحة تابعة للعميل'}
- نوع المحتوى: ${isVideo ? 'فيديو ريلز (Reel/Video)' : (options.mediaType || (hasImage ? 'تصميم/صور' : 'نص فقط'))}
${metricsSummary}
- نص المنشور (المحتوى الإعلاني):
"""
${options.postText || 'لا يوجد نص مكتوب'}
"""
${mediaDirective}

══════════════════════════════════════
🛑 قواعد صارمة لا يمكن مخالفتها:
1. ❌ ممنوع منعاً باتاً دمج مصطلحات إنجليزية داخل النصوص العربية أو وضع ترجمات بين أقواس مثل: (Dynamic Subtitles) أو (Objective) أو (Automated Icebreakers) أو (Placements). الكلام كله يُكتب باللغة العربية الواضحة والمباشرة فقط. الاستثناء الوحيد للإنجليزية هو كتابة اسم الاهتمام أو السلوك الرسمي لفيسبوك داخل معقوفين مثل [E-commerce].
2. ❌ ممنوع منعاً باتاً كتابة أي نصوص أو صيغ إعلانية بديلة (ممنوع اقتراح كوبي بديل). التركيز فقط على تقييم البوست الحالي.
3. ❌ ممنوع ذكر مراحل التكبير النظرية (Scaling phases) أو شرح مصطلحات الكتب النظرية.
4. ❌ ممنوع منعاً باتاً اقتراح أي ميزانيات أو تحديد أهداف إعلانية للحملة (يُترك تحديد الهدف الإعلاني للموظف بالاتفاق مع العميل). التركيز التام على نصيحة الميديا باير الذهبية.
5. ❌ ممنوع تكرار نفس الملاحظة أو النصيحة في أكثر من مكان داخل التقرير.
6. ⭐ قاعدة ذهبية لاستهدافات ميتا (Meta Ads Detailed Targeting):
   - ممنوع نهائياً اختراع أو كتابة أي كلمة عامة وهمية مش موجودة في فيسبوك (زي كلمة Engagement لوحدها).
   - يجب اختيار الاهتمامات والسلوكيات والمناسبات **حصرياً من قائمة الـ 513 استهداف رسمي المرفقة بالأسفل** حسب النيتش وطبيعة البوست، وكتابة الاسم الرسمي بالإنجليزية داخل معقوفين مثل [Furniture].
7. ⭐ افصل السلوكيات والمناسبات عن مواضع الظهور بشكل مستقل تماماً. واذكر مواضع الظهور الفعالة باللغة العربية (مثل: ريلز إنستجرام وفيسبوك، وخلاصة الأخبار الرئيسية Feeds).
8. ⭐ التعديل المطلوب فوراً: اكتب التعديلات العملية في نقاط مرقمة بوضوح (1، 2...) بدون مصطلحات إنجليزية حشوية.
9. ⭐ زاوية استهداف بديلة (Alternative Targeting): قدم زاوية استهداف بديلة كاملة مختلفة تماماً عن الأساسية مع اهتمامات وسلوكيات رسمية حقيقية بالإنجليزية من القاموس المرفق لتمكين الميديا باير من اختبار A/B Test.
10. ⭐ السن المقترح ومبرره (Age Range & Rationale): يجب كتابة السن المقترح مع توضيح سبب ومبرر اختياره بدقة في حقل age_rationale (بناءً على القوة الشرائية وطبيعة المنتج والجمهور الأكثر طلباً) في كل من الاستهداف الأساسي والبديل.

${fullTaxonomyReference}

يجب أن يكون الرد JSON فقط مطابقاً للهيكل التالي 100%:
{
  "observed_score": 8.5,
  "copy_score": 8.0,
  "visual_score": 8.8,
  "visual_score_label": "${isVideo ? 'الفيديو' : 'التصميم'}",
  "verdict": {
    "is_suitable": true,
    "decision_label": "🟢 جاهز للتمويل فوراً",
    "status_label": "🟢 جاهز للتمويل فوراً",
    "summary": "تقييم مباشر وصريح وموجز في سطرين عن الجدوى الإعلانية"
  },
  "creative_analysis": {
    "format_detected": "${isVideo ? 'فيديو / ريلز' : (hasImage ? 'صورة / تصميم' : 'نص فقط')}",
    "visual_hooks": "تقييم مباشر للهوك في أول 3 ثواني في سطر واحد",
    "primary_strength": "أقوى ميزة تشد العميل في سطر واحد",
    "actionable_recommendations": [
      "تعديل عملي محدد رقم 1",
      "تعديل عملي محدد رقم 2 (اختياري)"
    ]
  },
  "copy_analysis": {
    "hook_and_offer_evaluation": "تقييم مباشر للهوك وقوة العرض المالي/التجاري في سطرين",
    "cta_evaluation": "تقييم زر التحويل وطريقة التواصل بوضوح في سطر واحد"
  },
  "targeting_suggestions": {
    "age_range": "24 - 45 سنة",
    "age_rationale": "سبب ومبرر تحديد هذا السن بناء على القوة الشرائية واحتياج المنتج في سطر واحد",
    "gender": "الجميع",
    "detailed_interests": [
      {
        "interest": "Interest Name in English",
        "reason": "سبب اختيار هذا الاهتمام باختصار"
      },
      {
        "interest": "Interest Name in English",
        "reason": "سبب اختيار هذا الاهتمام باختصار"
      },
      {
        "interest": "Interest Name in English",
        "reason": "سبب اختيار هذا الاهتمام باختصار"
      },
      {
        "interest": "Interest Name in English",
        "reason": "سبب اختيار هذا الاهتمام باختصار"
      }
    ],
    "behaviors": "السلوكيات المقترحة مثل Engaged Shoppers أو Facebook Page Admins",
    "placements": "مواضع الظهور الفعالة مع ذكر لماذا (مثل: Feeds + Reels & Stories)"
  },
  "alternative_targeting": {
    "angle_name": "اسم الزاوية البديلة (مثال: زاوية المشاكل والشكاوى Pain Point أو زاوية B2B)",
    "angle_rationale": "شرح فكرة هذه الزاوية البديلة ولماذا تفيد في الـ A/B Testing",
    "age_range": "26 - 50 سنة",
    "age_rationale": "سبب ومبرر تحديد هذا السن للزاوية البديلة في سطر واحد",
    "gender": "الجميع",
    "detailed_interests": [
      {
        "interest": "Alternative Interest in English",
        "reason": "سبب اختيار هذا الاهتمام للزاوية البديلة"
      },
      {
        "interest": "Alternative Interest in English",
        "reason": "سبب اختيار هذا الاهتمام للزاوية البديلة"
      },
      {
        "interest": "Alternative Interest in English",
        "reason": "سبب اختيار هذا الاهتمام للزاوية البديلة"
      }
    ],
    "behaviors": "السلوكيات المناسبة للزاوية البديلة",
    "placements": "المواضع المناسبة للزاوية البديلة"
  },
  "campaign_strategy": {
    "media_buyer_golden_tip": "نصيحة تكتيكية واحدة ذهبية تخص هذا البوست تحديداً لتحقيق أعلى عائد وأقل تكلفة رسالة/طلب"
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

  async evaluateCampaignTargeting(
    params: CampaignTargetingEvaluationParams
  ): Promise<CampaignTargetingEvaluationResult> {
    let imageBase64: string | undefined = undefined;
    if (params.imageUrl) {
      try {
        const imgRes = await fetch(params.imageUrl, { signal: AbortSignal.timeout(5000) });
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          imageBase64 = Buffer.from(buf).toString('base64');
        }
      } catch (e) {
        console.warn('Failed to download image for campaign targeting evaluation:', e);
      }
    }

    const totalEntitiesCount =
      metaTargetingDict.demographics.length +
      metaTargetingDict.behaviors.length +
      metaTargetingDict.interests.length;

    const fullTaxonomyReference = `
══════════════════════════════════════
📋 قاموس الاستهدافات الرسمية لفيسبوك المعتمدة في Bird Ads و Meta Ads Manager (اختر الاستهدافات المقترحة حصرياً من هذه العناصر الـ ${totalEntitiesCount} الرسمية):
• المناسبات والديموغرافيا الرسمية (${metaTargetingDict.demographics.length} عنصر):
${metaTargetingDict.demographics.map((d: any) => `[${d.en}] (${d.ar})`).join(' | ')}

• السلوكيات الرسمية (${metaTargetingDict.behaviors.length} عنصر):
${metaTargetingDict.behaviors.map((b: any) => `[${b.en}] (${b.ar})`).join(' | ')}

• الاهتمامات الرسمية (${metaTargetingDict.interests.length} عنصر):
${metaTargetingDict.interests.map((i: any) => `[${i.en}] (${i.ar})`).join(' | ')}
`;

    const demographicsSummary =
      params.currentTargeting.demographics && params.currentTargeting.demographics.length > 0
        ? params.currentTargeting.demographics.join(' | ')
        : 'لا توجد بيانات ديموغرافية أو مناسبات محددة';

    const interestsSummary =
      params.currentTargeting.interests && params.currentTargeting.interests.length > 0
        ? params.currentTargeting.interests.join(' | ')
        : 'لا توجد اهتمامات يدوية محددة (متروكة للذكاء الاصطناعي أو عامة)';

    const behaviorsSummary =
      params.currentTargeting.behaviors && params.currentTargeting.behaviors.length > 0
        ? params.currentTargeting.behaviors.join(' | ')
        : 'لا توجد سلوكيات محددة';

    const exclusionsSummary =
      params.currentTargeting.exclusions && params.currentTargeting.exclusions.length > 0
        ? params.currentTargeting.exclusions.join(' | ')
        : 'لا توجد استبعادات';

    const isVideo = params.mediaType === 'VIDEO';
    const mediaFormatLabel = isVideo
      ? 'فيديو إعلاني / ريلز (Reel / Video)'
      : params.mediaType === 'CAROUSEL'
      ? 'ألبوم صور / كاروسيل'
      : params.imageUrl
      ? 'تصميم / صورة إعلانية'
      : 'نص إعلاني فقط';

    const mediaDirective = isVideo
      ? 'نوع الإعلان المرئي: **فيديو إعلاني / ريلز** (الصورة المرفقة معك هي غلاف أو كادر من الفيديو). قيّم رسالة الفيديو وحيويته مع نص البوست ومدى ملاءمته للجمهور المستهدف.'
      : params.imageUrl
      ? 'نوع الإعلان المرئي: **تصميم إعلاني / صور للمنتج**. افحص جودة التصميم البصري والمنتج وتناسقه مع نص البوست ومدى مطابقته لاهتمامات وذوق الجمهور المستهدف.'
      : 'نوع الإعلان: نص إعلاني بدون وسائط مرئية.';

    const prompt = `
أنت "عين السوق" 🦅، خبير الميديا باينج وتحسين الحملات الإعلانية الأول في مصر والوطن العربي، المتخصص في تدقيق وفحص الاستهدافات الإعلانية في مدير إعلانات ميتا (Meta Ads Manager).
أسلوبك: بالعامية المصرية البيزنس، صريح، عملي، ومختصر وبدون أي حشو.

مهمتك:
فحص ومقارنة "الاستهداف الحالي المضبوط في الحملة" مع "محتوى البوست/الإعلان المعروض (الفيديو أو الصور والنص الإعلاني)" وتقييم مدى ملاءمته وهل هو مناسب للمنتج والجمهور المستهدف أم يسبب هدر ميزانية، ثم إعطاء تقييم رقمي من 10، واقتراح 5 استهدافات بديلة على الأقل من القاموس المعتمد مع ذكر السبب لكل استهداف.

بيانات الحملة والإعلان الحالي:
- اسم الحملة: ${params.campaignName}
${params.adsetName ? `- اسم المجموعة الإعلانية: ${params.adsetName}` : ''}
- نوع المحتوى الإعلاني: ${mediaFormatLabel}
- فحص الوسائط: ${mediaDirective}
- نص الإعلان / البوست:
"""
${params.postText || 'لا يوجد نص مكتوب'}
"""

الاستهداف الحالي المضبوط في الحملة:
- الفئة العمرية (السن): ${params.currentTargeting.ageRange}
- النوع: ${params.currentTargeting.gender}
- المناطق الجغرافية: ${params.currentTargeting.locations}
- نوع الاستهداف: ${params.currentTargeting.targetingType} ${params.currentTargeting.isAdvantageAudience ? '(استهداف أدفانتج بلس Advantage+ مفعل)' : ''}
- مواضع الظهور الحالية: ${params.currentTargeting.placements?.formattedText || 'مواضع أدفانتج بلس التلقائية'}
- البيانات الديموغرافية والحالة الاجتماعية والمناسبات: ${demographicsSummary}
- الاهتمامات الحالية: ${interestsSummary}
- السلوكيات الحالية: ${behaviorsSummary}
- الاستبعادات: ${exclusionsSummary}
${params.userDirective ? `
══════════════════════════════════════
⚠️ ملاحظات وتوجيهات خاصة من الميديا باير (يجب تطبيقها بحزم):
"${params.userDirective}"
🛑 تعليمات هامة بخصوص ملاحظات الميديا باير:
- التزم بهذه الملاحظات بنسبة 100% في المقترحات والتحليل والزتونة.
- لو طلب التركيز على فئة معينة (مثل تجار الجملة أو فئة بعينها)، اجعل كل المقترحات والنصائح تدور حولهم حصرياً.
- لو طلب استبعاد فئة أو جهة معينة (مثل بيوتي سنتر أو أسبا أو مستهلكين أفراد)، استبعدها تماماً ولا تذكرها في المقترحات.
` : ''}

══════════════════════════════════════
🛑 قواعد صارمة لا يمكن مخالفتها:
1. ❌ ممنوع منعاً باتاً دمج مصطلحات إنجليزية داخل النصوص العربية أو وضع ترجمات بين أقواس. الاستثناء الوحيد هو كتابة اسم الاهتمام أو السلوك الرسمي لفيسبوك داخل معقوفين مثل [Furniture].
2. ⭐ تقييم الاستهداف الحالي مقارنة بالبوست:
   - هل السن الحالي والمناطق الجغرافية والحالة الاجتماعية/الديموغرافية مناسبة لطبيعة المنتج أو الخدمة وقدرته الشرائية؟
   - هل استهداف أدفانتج بلس أو الاهتمامات الحالية تخدم البوست ولا بتستهدف جمهور عشوائي؟
   - هل المناطق المحددة منطقية لطبيعة العرض؟
3. ⭐ التقييم الرقمي: يجب إعطاء درجة دقيقة وعادلة من 10 لمدى ملاءمة الاستهداف الحالي للبوست (مثلاً: 5/10 لو الاستهداف واسع أو غير موجه، 8.5/10 لو مظبوط، 3/10 لو غير متوافق تماماً).
4. ⭐ مقترحات الاستهداف البديلة (على الأقل 5 استهدافات):
   - يجب اختيار 5 استهدافات أو اهتمامات بديلة أفضل للبوست **حصرياً من قائمة الـ 513 استهداف رسمي المرفقة بالأسفل**.
   - كتابة اسم كل استهداف بالإنجليزية داخل معقوفين مثل [E-commerce] مع شرح سبب ومبرر اختياره بالعربي.
5. ⭐ توضيح السن المقترح الأنسب للبوست مع مبرره التسويقي بدقة.
6. ⭐ فرز عناصر الاستهداف الحالي:
   - keep_items: حدد العناصر الحالية الصحيحة التي يجب الإبقاء عليها بدون تغيير حتى لا يغير المعلن كل شيء.
   - remove_items: حدد العناصر أو السلوكيات الضارة التي تهدر الميزانية ويجب حذفها فوراً مع ذكر السبب.
7. ⭐ تضييق الجمهور (Narrow Audience): وضح في narrowing_technique إرشادات عملية لكيفية استخدام زر "تقييد جمهورك بشكل أكبر" في مدير الإعلانات للربط بشرط (AND).
8. ⭐ خطة مواضع الظهور الفعالة (Placements Plan):
   - keep_placements: حدد المواضع الفعالة التي ننصح بتشغيلها في الحملة (مثل خلاصات وريلز فيسبوك وإنستجرام على الموبايل).
   - stop_placements: حدد المواضع التي يجب إيقافها فوراً في مدير الإعلانات مع ذكر السبب (مثل شبكة الجمهور Audience Network لأنها ألعاب وتطبيقات خارجية بمكافأة تهدر الميزانية، والإعلانات المضمنة في الفيديو In-Stream وسطح المكتب).
9. ⭐ نصيحة الميديا باير: نصيحة تكتيكية واحدة ذهبية تخص هذه الحملة لتحقيق أعلى عائد على الإنفاق وخفض تكلفة الرسالة/الطلب.

${fullTaxonomyReference}

يجب أن يكون الرد JSON فقط مطابقاً للهيكل التالي 100%:
{
  "targeting_suitability_score": 7.5,
  "verdict": {
    "decision_label": "🟡 استهداف مقبول ويحتاج تحسين",
    "status_label": "🟡 استهداف مقبول ويحتاج تحسين",
    "summary": "ملخص صريح في سطرين عن سبب هذا التقييم ومدى مطابقة الجمهور للمنتج المعروض"
  },
  "suitability_analysis": "تحليل تكتيكي سريع في سطرين يوضح هل الجمهور المضبوط مناسب للبوست والمنتج ولا فيه هدر ميزانية",
  "current_targeting_critique": {
    "strengths": [
      "نقطة قوة في الاستهداف الحالي 1",
      "نقطة قوة 2"
    ],
    "weaknesses": [
      "ملاحظة أو نقطة ضعف في الاستهداف الحالي 1",
      "ملاحظة 2"
    ],
    "keep_items": [
      "[اسم العنصر] - سبب الإبقاء عليه وأنه يخدم البوست"
    ],
    "remove_items": [
      "[اسم العنصر] - سبب ضرورة حذفه فوراً لأنه يهدر الميزانية"
    ]
  },
  "suggested_targeting": {
    "suggested_age_range": "24 - 45 سنة",
    "suggested_age_rationale": "سبب ومبرر تحديد هذا السن بناء على القوة الشرائية وطبيعة المنتج",
    "suggested_gender": "الجميع",
    "suggested_locations": "مصر بالكامل أو مناطق محددة",
    "suggested_placements": "خلاصة فيسبوك وإنستجرام وريلز مع قصر الظهور على الموبايل واستبعاد شبكة الجمهور Audience Network",
    "suggested_placements_plan": {
      "keep_placements": [
        "خلاصات فيسبوك وإنستجرام (Feeds) - لمشاهدة الإعلان بتركيز أثناء التصفح",
        "ريلز وقصص فيسبوك وإنستجرام (Reels & Stories) - أفضل موضع لعرض الفيديو بكامل الشاشة والتفاعل السريع",
        "الهواتف المحمولة فقط (Mobile Only) - استبعاد أجهزة الكمبيوتر لأن التفاعل الرئيسي على الموبايل"
      ],
      "stop_placements": [
        "شبكة الجمهور (Audience Network) - احذفها فوراً لأنها إعلانات ألعاب وتطبيقات خارجية بمكافأة تهدر الميزانية بنقرات وهمية",
        "الفيديو المضمن أثناء البث (In-Stream) - يسبب نقرات عاطفية غير مقصودة ويشتت المشاهد",
        "صندوق وارد ماسنجر وأشرطة البحث - تفاعل ضعيف ومعدل تحويل منخفض"
      ]
    },
    "detailed_interests": [
      {
        "interest": "Interest 1 in English",
        "reason": "سبب اختيار هذا الاهتمام ولماذا هو أفضل للبوست"
      },
      {
        "interest": "Interest 2 in English",
        "reason": "سبب اختيار هذا الاهتمام"
      },
      {
        "interest": "Interest 3 in English",
        "reason": "سبب اختيار هذا الاهتمام"
      },
      {
        "interest": "Interest 4 in English",
        "reason": "سبب اختيار هذا الاهتمام"
      },
      {
        "interest": "Interest 5 in English",
        "reason": "سبب اختيار هذا الاهتمام"
      }
    ],
    "behaviors": "السلوكيات الرسمية المقترحة مثل [Small Business Owners]",
    "narrowing_technique": "خطوات واضحة لتضييق الجمهور بزر تقييد جمهورك بشكل أكبر (مثل: ضع اهتمامات المجال في المربع الأول، واضغط تقييد جمهورك بشكل أكبر وضع أصحاب الأنشطة التجارية في المربع الثاني)"
  },
  "media_buyer_golden_tip": "نصيحة تكتيكية واحدة ذهبية تخص هذا البوست لرفع التحويل وخفض تكلفة الرسالة"
}
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
      parsed.targeting_suitability_score =
        typeof parsed.targeting_suitability_score === 'number'
          ? parsed.targeting_suitability_score
          : 7.0;
      return parsed;
    } catch (err) {
      console.error('Failed to parse Campaign Targeting Evaluation Gemini JSON:', rawResponse);
      throw new Error('فشل معالجة تقييم استهداف الحملة بالذكاء الاصطناعي، يرجى المحاولة مجدداً.');
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

      const ageMin = (Array.isArray(t.age_range) ? t.age_range[0] : t.age_min) || 18;
      const ageMax = (Array.isArray(t.age_range) ? t.age_range[1] : t.age_max) || 65;
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
        if (spec.work_positions) spec.work_positions.forEach((w: any) => behaviors.push(w.name || w));
      });

      const isAdvantagePlus = Boolean(
        t.targeting_automation?.advantage_audience === 1 ||
        t.targeting_optimization === 'expansion_all' ||
        (t.targeting_optimization === 'none' && t.targeting_automation?.advantage_audience === 1)
      );

      const targetingType = (interests.length > 0 || behaviors.length > 0)
        ? `استهداف تفصيلي (${[...interests, ...behaviors].slice(0, 3).join(', ')})`
        : isAdvantagePlus
        ? 'جمهور مخصص أدفانتج بلس (Advantage+)'
        : 'استهداف واسع بدون قيود (Broad Targeting)';

      // Extract AdSet performance from insights
      const asetInsights = aset.insights?.data?.[0] || {};
      const asetActions: any[] = asetInsights.actions || [];
      const msgAction = asetActions.find((a: any) => 
        a.action_type === 'onsite_conversion.total_messaging_connection' ||
        a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
        a.action_type === 'messaging_conversation_started_7d'
      );
      const leadAction = asetActions.find((a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead');
      const conversationsCount = parseInt(msgAction?.value || leadAction?.value || '0', 10);
      const spendNum = parseFloat(asetInsights.spend || '0');
      const asetSpend = spendNum > 0 ? spendNum.toFixed(1) + ' ' + currency : '0 ' + currency;
      const asetCpa = conversationsCount > 0 
        ? (spendNum / conversationsCount).toFixed(1) + ' ' + currency
        : 'لا توجد محادثات';

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
        spend: asetSpend,
        spend_num: spendNum,
        conversations: conversationsCount,
        cpa: asetCpa,
        reach: asetInsights.reach || 0,
        ctr: asetInsights.ctr ? parseFloat(asetInsights.ctr).toFixed(2) + '%' : '0%',
      };
    });

    // 2. Extract and format individual Ads, Real Video Details & Insights
    const formattedAds = rawAds.map((ad: any, idx: number) => {
      const cr = ad.creative || {};
      const videoId = cr.video_id || cr.object_story_spec?.video_data?.video_id || '';
      const isVideo = Boolean(videoId);
      const matchingAdset = formattedAdsets.find((aset: any) => aset.id === ad.adset_id);

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

      const msgAction = actions.find((a: any) =>
        a.action_type === 'onsite_conversion.total_messaging_connection' ||
        a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
        a.action_type === 'messaging_conversation_started_7d'
      );
      const purchases = actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')?.value || '0';
      const conversations = parseInt(msgAction?.value || '0', 10);
      const spendNum = parseFloat(adInsights.spend || '0');
      const cpaRaw = costPerAction.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')?.value;
      const cpa = conversations > 0
        ? (spendNum / conversations).toFixed(1) + ' ' + currency
        : cpaRaw ? parseFloat(cpaRaw).toFixed(1) + ' ' + currency : 'غير مسجل';

      const p25Watch = (adInsights.video_p25_watched_actions || [])[0]?.value || '0';
      const p50Watch = (adInsights.video_p50_watched_actions || [])[0]?.value || '0';
      const p100Watch = (adInsights.video_p100_watched_actions || [])[0]?.value || '0';
      const avgWatchTime = (adInsights.video_avg_time_watched_actions || [])[0]?.value || '0';

      let defaultDecision = 'KEEP';
      let defaultDecisionBadge = '✅ استمرار بالمراقبة';
      if (spendNum > 50 && conversations === 0) {
        defaultDecision = 'STOP';
        defaultDecisionBadge = '🛑 إيقاف فوري (صرف بدون رسائل)';
      } else if (spendNum > 80 && (spendNum / Math.max(1, conversations)) > 30) {
        defaultDecision = 'STOP';
        defaultDecisionBadge = '🛑 إيقاف فوري (سعر رسالة مرتفع جداً)';
      } else if (conversations >= 15 && (spendNum / conversations) <= 12) {
        defaultDecision = 'SCALE';
        defaultDecisionBadge = '🚀 تكبير وزيادة الصرف (إعلان رابح)';
      }

      return {
        ad_id: ad.id,
        ad_name: ad.name || `إعلان #${idx + 1}`,
        adset_id: ad.adset_id || '',
        adset_name: matchingAdset ? matchingAdset.name : 'مجموعة إعلانية',
        status: ad.effective_status || ad.status || 'ACTIVE',
        is_video: isVideo,
        video_id: videoId || null,
        video_source: cr.video_source || null,
        video_embed_url: videoEmbedUrl,
        post_url: postUrl || `https://www.facebook.com/ads/manager?act=${campaign.id}`,
        thumbnail_url: thumb,
        images: Array.isArray(cr.images) && cr.images.length > 0 ? cr.images : thumb ? [thumb] : [],
        media_type_label: isVideo ? '🎬 فيديو إعلاني' : '🖼️ منشور صور / تصميم إعلاني',
        title: cr.title || '',
        body: cr.body || ad.name || 'لا يوجد نص',
        cta_type: cr.call_to_action_type || 'LEARN_MORE',
        spend: spendNum > 0 ? spendNum.toFixed(1) + ' ' + currency : '0',
        spend_num: spendNum,
        purchases: purchases,
        conversations: conversations,
        cpa: cpa,
        ctr: adInsights.ctr ? parseFloat(adInsights.ctr).toFixed(2) + '%' : '0%',
        video_watch_stats: isVideo ? `مشاهدات أول 3 ثواني (P25): ${p25Watch} | كملوا نصف الفيديو: ${p50Watch} | كملوا 100%: ${p100Watch} | متوسط المشاهدة: ${avgWatchTime} ثوانٍ` : 'إعلان صور (لا ينطبق)',
        decision: defaultDecision,
        decision_badge: defaultDecisionBadge,
      };
    });

    // Sort ads: active with spend/purchases/conversations first
    const sortedAds = [...formattedAds].sort((a: any, b: any) => {
      return (b.spend_num || 0) - (a.spend_num || 0);
    });

    // Pick top active ads for in-depth creative & copywriting review (top 3 ads)
    const topAdsForDeepReview = sortedAds.slice(0, 3);
    const otherAds = sortedAds.slice(3);

    const prompt = `
أنت خبير إعلانات فيسبوك أول، واستشاري ميديا باينج (Senior Meta Media Buyer & Performance Marketing Consultant) في السوق المصري والعربي.
المهمة: تحليل استراتيجي عملي متكامل ومخصص 100% بالعامية المصرية لهذه الحملة الإعلانية:
- اسم الحملة: "${campaign.name}"
- الحساب الإعلاني: "${options?.accountName || 'حساب إعلاني'}"
- معرف الحملة: ${campaign.id}

⚠️ قواعد حاسمة وإلزامية للتحليل:
1. التخصيص التام والمطلق لمجال الحملة:
   - يجب أن تفهم وتستنتج طبيعة النشاط، والخدمة أو المنتج المعروض، والجمهور المستهدف حصراً وبدقة 100% من بيانات الحملة الفعلية (نصوص الإعلانات، عناوين الكريتيف، أسماء المجموعات الإعلانية، والجمهور المستهدف الموضح أدناه).
   - ممنوع تماماً ومطلقاً افتراض أي نشاط مسبق، أو ذكر أي عميل أو علامة تجارية أو نظام تقني أو مجالات أخرى (مثل أنظمة مطاعم أو متاجر أو Fast Order أو غيرها) ما لم تكن مكتوبة نصاً وصراحة في بيانات هذا الإعلان.
   - إذا كان الإعلان يتحدث عن خدمات سفر، توطين، هجرة، عقود عمل، خدمات قانونية، عقارات، كورسات، تجارة إلكترونية، أو أي مجال آخر، يجب أن يدور التحليل بالكامل، وتقييم العرض، والنصوص البديلة المقترحة، والاستهداف حول هذا المجال المحدد تحديداً وبدون أي خلط.

2. تقييم الهدف والأداء بالأرقام الواقعية:
   - هدف الحملة الفعلي المسجل: ${campaign.objective || 'غير محدد'}.
   - إجمالي المصروف: ${insights.spend || 0} ${currency}.
   - إجمالي النتائج المحققة: ${formattedAdsets.reduce((acc: number, a: any) => acc + (a.conversations || 0), 0)} (رسائل / نتائج).
   - قيّم تكلفة النتيجة أو سعر المحادثة بناءً على طبيعة النشاط المعلن عنه في السوق المستهدف.
   - الحملة تحتوي على ${formattedAdsets.length} مجموعة إعلانية فعلية، قيّم كل مجموعة بناءً على أرقامها الحقيقية الواردة أدناه:
${formattedAdsets.map((aset: any, idx: number) => `     * مجموعة ${idx + 1}: "${aset.name}" (الاستهداف: ${aset.targeting_type_label} | المناطق: ${aset.locations} | الأعمار: ${aset.age_range} | الصرف: ${aset.spend} | النتائج: ${aset.conversations} | التكلفة: ${aset.cpa})`).join('\n')}

3. المطلوب: تحديد القرارات العملية بدقة ("أوقف إيه وشغل إيه وكبّر إيه") مع خطة عملية واضحة لتوزيع الميزانية بناءً على الأرقام الحقيقية.

بيانات المجموعات الإعلانية الحقيقية وأرقامها بالتفصيل (${formattedAdsets.length} مجموعات):
${JSON.stringify(formattedAdsets, null, 2)}

أهم الإعلانات مع المجموعات التابعة لها والأرقام ونصوص الكوبي الفعلية:
${JSON.stringify(topAdsForDeepReview.map((a: any) => ({
  ad_id: a.ad_id,
  ad_name: a.ad_name,
  adset_name: a.adset_name,
  spend: a.spend,
  conversations: a.conversations,
  cpa: a.cpa,
  ctr: a.ctr,
  title: a.title,
  body: a.body
})), null, 2)}
${otherAds.length > 0 ? `\nباقي إعلانات الحملة:\n${JSON.stringify(otherAds.map((a: any) => ({ ad_id: a.ad_id, ad_name: a.ad_name, adset_name: a.adset_name, spend: a.spend, conversations: a.conversations, cpa: a.cpa })), null, 2)}` : ''}

المطلوب منك إخراجه بصيغة JSON مهيكلة فقط بدون أي مقدمات أو شروحات خارج الـ JSON:
{
  "verdict": "OPTIMIZATION_AND_SCALING",
  "verdict_badge": "شارة القرار العام (مثال: أداء واعد 🚀 / تحتاج فلترة الجودة / إيقاف الهدر)",
  "score": 8.5,
  "summary_egyptian": "ملخص تحليلي استراتيجي بالعامية المصرية يصف أداء الحملة الحقيقي لمجالها ونشاطها المعلن، بالأرقام الدقيقة وسعر الرسالة والفرص المتاحة...",
  "metrics_evaluation": {
    "cpa_and_results": "تقييم تكلفة النتيجة والمحادثات/النتائج المحققة بالأرقام مقارنة بطبيعة النشاط المعلن عنه",
    "roas_and_profit": "تقييم الجدوى الاقتصادية والعائد المتوقع للنشاط أو الخدمة المعلنة",
    "ctr_and_interest": "تقييم معدل النقر CTR والتفاعل ومؤشرات اهتمام الجمهور بمحتوى الإعلان",
    "frequency_and_fatigue": "تقييم التكرار والوصول ومدى تشبع الجمهور"
  },
  "adsets_analysis": [
    {
      "adset_id": "${formattedAdsets[0]?.id || ''}",
      "adset_name": "${formattedAdsets[0]?.name || ''}",
      "targeting_verdict": "تقييم ملاءمة هذا الجمهور والاستهداف لنوع الخدمة أو المنتج المعلن عنه في الحملة",
      "decision": "SCALE",
      "decision_badge": "🚀 زيادة الميزانية والتكبير",
      "decision_reason": "سبب صريح بالأرقام الحقيقية (كم صرف وكم جاب وتكلفة النتيجة)",
      "winner_ads": ["اسم أو كود الإعلان الرابح في هذه المجموعة"],
      "loser_ads_to_stop": ["اسم أو كود الإعلانات المطلوب إيقافها في هذه المجموعة"]
    }
  ],
  "actionable_stop_and_run_matrix": {
    "ads_to_stop_immediately": [
      {
        "ad_id": "معرف الإعلان المطلوب إيقافه فوراً",
        "ad_name": "اسم الإعلان",
        "adset_name": "اسم المجموعة",
        "wasted_spend": "المبلغ المهدر",
        "results": "النتائج الضعيفة",
        "reason": "تفسير صريح بالعامية المصرية يوضح سبب إيقافه لتوفير الميزانية"
      }
    ],
    "ads_to_scale_and_boost": [
      {
        "ad_id": "معرف الإعلان الرابح المتصدر",
        "ad_name": "اسم الإعلان",
        "adset_name": "اسم المجموعة",
        "spend": "المبلغ المصروف",
        "results": "النتائج المحققة",
        "action_plan": "خطة التكبير المحددة لهذا الإعلان الرابح"
      }
    ],
    "budget_reallocation_plan": "نصيحة وخطة عملية واضحة لنقل الميزانية من الإعلانات والمجموعات الأقل كفاءة إلى المتصدرة لتعظيم النتائج بأقل تكلفة."
  },
  "bottlenecks": [
    "النقطة 1 لعنق الزجاجة ونقاط التسريب الخاصة بهذا النشاط بالتفصيل مع الأرقام...",
    "النقطة 2 لعنق الزجاجة بالتفصيل مع الأرقام..."
  ],
  "scaling_advice_points": [
    "النقطة 1 لزيادة الميزانية والتكبير للنشاط بالتفصيل...",
    "النقطة 2 للتكبير..."
  ],
  "action_steps": [
    "الخطوة 1: خطوات عملية للتنفيذ الفوري بالعامية المصرية مخصصة لهذا النشاط...",
    "الخطوة 2: خطوات عملية للتنفيذ..."
  ],
  "creatives_analysis": [
    {
      "ad_id": "${topAdsForDeepReview[0]?.ad_id || ''}",
      "decision": "SCALE",
      "decision_badge": "🚀 تكبير وضخ ميزانية",
      "decision_reason": "سبب القرار بالأرقام",
      "visual_hook_analysis": "تحليل أول 3 ثوانٍ وجاذبية المشهد أو التصميم بالعامية المصرية",
      "product_offer_clarity": "تحليل مدى وضوح الخدمة أو المنتج المعروض في هذا الإعلان وكيفية إبراز القيمة",
      "conversion_reality_verdict": "تفسير أداء الإعلان الفعلي بالعامية المصرية وتوصيات التطوير",
      "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
      "weaknesses": ["نقطة ضعف 1", "نقطة ضعف 2"],
      "creative_score": 8.5
    }
  ],
  "copywriting_analysis": [
    {
      "ad_id": "${topAdsForDeepReview[0]?.ad_id || ''}",
      "ad_name": "اسم الإعلان",
      "hook_analysis": "تحليل هوك النص بالعامية المصرية",
      "body_structure_analysis": "تحليل متن النص والعرض المقدم",
      "offer_and_cta_analysis": "تحليل الدعوة لاتخاذ إجراء CTA",
      "copy_score": 8.0,
      "alternative_copy_suggestions": [
        "نص إعلاني مقترح كامل وبديل جاهز للنسخ مخصص لنفس النشاط والخدمة المعلنة (يشمل هوك جذاب، متن واضح، دعوة لاتخاذ إجراء)..."
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
    "alignment_with_creatives": "تقييم مدى تطابق الجمهور المختار مع محتوى الإعلان والخدمة المعلنة بالعامية المصرية",
    "strengths": ["نقطة قوة 1 في الاستهداف", "نقطة قوة 2"],
    "risks_and_leaks": ["نقطة خطر أو هدر في الاستهداف"],
    "recommendations": ["توصية استهداف محددة ومطابقة لنشاط الحملة 1", "توصية 2"]
  }
}
`;

      const enrichAnalysis = (parsed: any) => {
        if (!parsed || typeof parsed !== 'object') return null;

        // Backwards-compatibility mappings for bottleneck and scaling_advice
        if (Array.isArray(parsed.bottlenecks) && !parsed.bottleneck) {
          parsed.bottleneck = parsed.bottlenecks.join('\n');
        }
        if (Array.isArray(parsed.scaling_advice_points) && !parsed.scaling_advice) {
          parsed.scaling_advice = parsed.scaling_advice_points.join('\n');
        }

        // Merge AdSets analysis with ground truth formattedAdsets
        const finalAdsets: any[] = formattedAdsets.map((rawAset: any) => {
          const aiAset = (parsed.adsets_analysis || []).find((a: any) => a.adset_id === rawAset.id) || {};
          return {
            id: rawAset.id,
            name: rawAset.name,
            targeting_type_label: rawAset.targeting_type_label,
            age_range: rawAset.age_range,
            locations: rawAset.locations,
            gender: rawAset.gender,
            interests: rawAset.interests,
            behaviors: rawAset.behaviors,
            spend: rawAset.spend,
            conversations: rawAset.conversations,
            cpa: rawAset.cpa,
            reach: rawAset.reach,
            ctr: rawAset.ctr,
            targeting_verdict: aiAset.targeting_verdict || 'استهداف خاضع لاختبار A/B Testing بالأرقام.',
            decision: aiAset.decision || (rawAset.conversations >= 30 ? 'SCALE' : rawAset.conversations > 5 ? 'KEEP' : 'STOP'),
            decision_badge: aiAset.decision_badge || (rawAset.conversations >= 30 ? '🚀 زيادة الميزانية والتكبير' : rawAset.conversations > 5 ? '✅ استمرار بالمراقبة' : '🛑 إيقاف لتوفير الميزانية'),
            decision_reason: aiAset.decision_reason || `صرفت ${rawAset.spend} وحققت ${rawAset.conversations} محادثات بسعر ${rawAset.cpa} للمحادثة.`,
            winner_ads: aiAset.winner_ads || [],
            loser_ads_to_stop: aiAset.loser_ads_to_stop || [],
          };
        });

        parsed.adsets_analysis = finalAdsets;

        // Ensure stop and run matrix exists
        if (!parsed.actionable_stop_and_run_matrix) {
          parsed.actionable_stop_and_run_matrix = {
            ads_to_stop_immediately: [],
            ads_to_scale_and_boost: [],
            budget_reallocation_plan: 'نقل الميزانية من الإعلانات ذات التكلفة المرتفعة للإعلان المتصدر.',
          };
        }

        // Merge real ground truth performance metrics and video embed URLs from Meta API
        const analyzedIds = new Set((parsed.creatives_analysis || []).map((c: any) => c.ad_id));

        const finalCreatives: any[] = Array.isArray(parsed.creatives_analysis) ? parsed.creatives_analysis.map((item: any) => {
          const rawAd = formattedAds.find((f: any) => f.ad_id === item.ad_id) || {};
          return {
            ...item,
            ad_name: rawAd.ad_name || item.ad_name,
            adset_id: rawAd.adset_id || item.adset_id || '',
            adset_name: rawAd.adset_name || item.adset_name || 'مجموعة إعلانية',
            is_video: rawAd.is_video !== undefined ? Boolean(rawAd.is_video) : Boolean(item.is_video),
            video_id: rawAd.video_id || item.video_id || null,
            video_source: rawAd.video_source || item.video_source || null,
            video_embed_url: rawAd.video_embed_url || item.video_embed_url || '',
            post_url: rawAd.post_url || item.post_url || '',
            thumbnail_url: rawAd.thumbnail_url || item.thumbnail_url || '',
            images: Array.isArray(rawAd.images) && rawAd.images.length > 0 ? rawAd.images : (Array.isArray(item.images) && item.images.length > 0 ? item.images : rawAd.thumbnail_url ? [rawAd.thumbnail_url] : []),
            media_type_label: rawAd.media_type_label || item.media_type_label || (rawAd.is_video ? '🎬 فيديو إعلاني' : '🖼️ منشور صور / تصميم إعلاني'),
            spend: rawAd.spend || item.spend || '0',
            purchases: rawAd.purchases || item.purchases || '0',
            conversations: rawAd.conversations !== undefined ? rawAd.conversations : item.conversations || 0,
            cpa: rawAd.cpa || item.cpa || 'غير مسجل',
            ctr: rawAd.ctr || item.ctr || '0%',
            video_watch_stats: rawAd.video_watch_stats || '',
            decision: item.decision || rawAd.decision || 'KEEP',
            decision_badge: item.decision_badge || rawAd.decision_badge || '✅ استمرار بالمراقبة',
            decision_reason: item.decision_reason || rawAd.decision_reason || '',
          };
        }) : [];

        // Ensure any extra ads from the campaign are also included in the report with accurate Meta data
        otherAds.forEach((extraAd: any) => {
          if (!analyzedIds.has(extraAd.ad_id)) {
            finalCreatives.push({
              ad_id: extraAd.ad_id,
              ad_name: extraAd.ad_name,
              adset_id: extraAd.adset_id || '',
              adset_name: extraAd.adset_name || 'مجموعة إعلانية',
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
              conversations: extraAd.conversations || 0,
              cpa: extraAd.cpa,
              ctr: extraAd.ctr,
              video_watch_stats: extraAd.video_watch_stats,
              decision: extraAd.decision || 'KEEP',
              decision_badge: extraAd.decision_badge || '✅ استمرار بالمراقبة',
              decision_reason: extraAd.decision_reason || '',
              visual_hook_analysis: extraAd.is_video ? 'فيديو إضافي بالحملة بمعدل إنفاق منخفض، يُنصح بمقارنته مع الكريتيف المتصدر.' : 'تصميم إضافي بالحملة، لم يحصل على الجزء الأكبر من الميزانية.',
              product_offer_clarity: 'عرض تكميلي في الحملة.',
              conversion_reality_verdict: `صرف ${extraAd.spend} وحقق ${extraAd.conversations || extraAd.purchases} نتائج. الأولوية للتركيز على الإعلان المتصدر أولاً.`,
              strengths: ['يساعد في اختبار زوايا عرض إضافية'],
              weaknesses: ['لم يحصل على ميزانية كافية للتحويل'],
              creative_score: 7.0,
            });
          }
        });

        parsed.creatives_analysis = finalCreatives;
        return parsed;
      };

    try {
      const rawText = await this.generate(prompt, {
        model: 'fast',
        config: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });

      const parsed = safeParseJson(rawText);
      if (!parsed) {
        throw new Error('فشل استخراج كائن JSON صالح من الاستجابة');
      }

      return enrichAnalysis(parsed);
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
          return enrichAnalysis(parsed);
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

