import { NextResponse } from 'next/server';

function validateApiKey(req: Request): boolean {
  const expectedKey = process.env.MERCHANT_API_KEY || 'fastorder_merchant_secure_api_key_2026';
  const headerKey = req.headers.get('x-api-key') || req.headers.get('X-API-KEY');
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (headerKey && headerKey === expectedKey) return true;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'ApiKey') && parts[1] === expectedKey) {
      return true;
    }
  }
  return false;
}

// خريطة مفاتيح المحافظات المصرية الرسمية في Meta Graph API
const EGYPT_GOVERNORATES_MAP: Record<string, { key: string; name: string }> = {
  'القاهرة': { key: '1001', name: 'محافظة القاهرة' },
  'الجيزة': { key: '998', name: 'محافظة الجيزة' },
  'الاسكندرية': { key: '996', name: 'محافظة الإسكندرية' },
  'الإسكندرية': { key: '996', name: 'محافظة الإسكندرية' },
  'القليوبية': { key: '1002', name: 'محافظة القليوبية' },
  'الشرقية': { key: '1004', name: 'محافظة الشرقية' },
  'الدقهلية': { key: '991', name: 'محافظة الدقهلية' },
  'الغربية': { key: '995', name: 'محافظة الغربية' },
  'المنوفية': { key: '999', name: 'محافظة المنوفية' },
  'البحيرة': { key: '993', name: 'محافظة البحيرة' },
  'كفر الشيخ': { key: '1011', name: 'محافظة كفر الشيخ' },
  'دمياط': { key: '1010', name: 'محافظة دمياط' },
  'بورسعيد': { key: '1009', name: 'محافظة بورسعيد' },
  'الاسماعيلية': { key: '997', name: 'محافظة الإسماعيلية' },
  'الإسماعيلية': { key: '997', name: 'محافظة الإسماعيلية' },
  'السويس': { key: '1005', name: 'محافظة السويس' },
  'الفيوم': { key: '994', name: 'محافظة الفيوم' },
  'بني سويف': { key: '1008', name: 'محافظة بني سويف' },
  'المنيا': { key: '1000', name: 'محافظة المنيا' },
  'اسيوط': { key: '1007', name: 'محافظة أسيوط' },
  'أسيوط': { key: '1007', name: 'محافظة أسيوط' },
  'سوهاج': { key: '1014', name: 'محافظة سوهاج' },
  'قنا': { key: '1013', name: 'محافظة قنا' },
  'الاقصر': { key: '4194', name: 'محافظة الأقصر' },
  'الأقصر': { key: '4194', name: 'محافظة الأقصر' },
  'اسوان': { key: '1006', name: 'محافظة أسوان' },
  'أسوان': { key: '1006', name: 'محافظة أسوان' },
  'البحر الاحمر': { key: '992', name: 'محافظة البحر الأحمر' },
  'البحر الأحمر': { key: '992', name: 'محافظة البحر الأحمر' },
  'مطروح': { key: '1012', name: 'محافظة مطروح' },
  'الوادي الجديد': { key: '1003', name: 'محافظة الوادي الجديد' },
  'شمال سيناء': { key: '1016', name: 'محافظة شمال سيناء' },
  'جنوب سيناء': { key: '1015', name: 'محافظة جنوب سيناء' }
};

/**
 * البحث عن اهتمام في Meta Graph API بالاسم وإرجاع معرفه
 */
async function resolveInterest(name: string, token: string): Promise<{ id: string; name: string } | null> {
  try {
    const url = new URL('https://graph.facebook.com/v21.0/search');
    url.searchParams.set('type', 'adinterest');
    url.searchParams.set('q', name.trim());
    url.searchParams.set('limit', '1');
    url.searchParams.set('access_token', token);

    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return { id: data.data[0].id, name: data.data[0].name };
    }
  } catch (err) {
    console.error(`[resolveInterest] Error resolving "${name}":`, err);
  }
  return null;
}

export async function POST(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ success: false, error: 'غير مصرح: مفتاح API غير صحيح أو مفقود' }, { status: 401 });
  }

  const token = process.env.META_USER_TOKEN;
  if (!token) {
    return NextResponse.json({ success: false, error: 'رمز الوصول لـ Meta Graph API غير معرف' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { target_id, action } = body;

    if (!target_id || !String(target_id).trim()) {
      return NextResponse.json({ success: false, error: 'معرف الحملة أو المجموعة target_id مطلوب' }, { status: 400 });
    }

    const cleanId = String(target_id).trim();

    // 1. فحص طبيعة الكائن (حملة أم مجموعة إعلانية أم إعلان)
    const probeUrl = `https://graph.facebook.com/v21.0/${cleanId}?fields=id,name,status,daily_budget,lifetime_budget,stop_time,adsets{id,name,daily_budget,lifetime_budget,end_time,targeting},ads{id,name,creative{id,name,object_story_id}}&access_token=${token}`;
    const probeRes = await fetch(probeUrl);
    const probeData = await probeRes.json();

    if (probeData.error) {
      return NextResponse.json({
        success: false,
        error: probeData.error.message || `لم يتم العثور على الكائن بالمعرف ${cleanId}`,
        meta_error: probeData.error
      }, { status: 400 });
    }

    const isCampaign = Boolean(probeData.adsets !== undefined || probeData.stop_time !== undefined);
    const adsets = probeData.adsets?.data || [];
    const ads = probeData.ads?.data || [];

    // ----------------------------------------------------
    // Action 1: UPDATE_STATUS (إيقاف أو تشغيل)
    // ----------------------------------------------------
    if (action === 'UPDATE_STATUS' || action === 'STATUS') {
      const targetStatus = String(body.status || '').toUpperCase();
      if (!['ACTIVE', 'PAUSED'].includes(targetStatus)) {
        return NextResponse.json({ success: false, error: 'الحالة يجب أن تكون إما ACTIVE أو PAUSED' }, { status: 400 });
      }

      const updateUrl = `https://graph.facebook.com/v21.0/${cleanId}`;
      const updateRes = await fetch(updateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, access_token: token })
      });
      const updateData = await updateRes.json();

      if (updateData.error) {
        return NextResponse.json({ success: false, error: updateData.error.message, meta_error: updateData.error }, { status: 400 });
      }

      const label = targetStatus === 'ACTIVE' ? 'تشغيل' : 'إيقاف مؤقت';
      return NextResponse.json({
        success: true,
        id: cleanId,
        status: targetStatus,
        status_label: targetStatus === 'ACTIVE' ? '🟢 نشطة' : '⏸️ متوقفة',
        message: `تم ${label} الحملة (${probeData.name || cleanId}) بنجاح ✅`
      });
    }

    // ----------------------------------------------------
    // Action 2: UPDATE_BUDGET (تعديل الميزانية)
    // ----------------------------------------------------
    if (action === 'UPDATE_BUDGET' || action === 'BUDGET') {
      const budgetNum = parseFloat(body.daily_budget || body.budget || body.lifetime_budget || 0);
      if (isNaN(budgetNum) || budgetNum <= 0) {
        return NextResponse.json({ success: false, error: 'يرجى تحديد ميزانية صالحة أكبر من الصفر' }, { status: 400 });
      }

      // في ميتا يتم إرسال المبلغ بالسنت/القرش (ضرب 100)
      const budgetInCents = Math.round(budgetNum * 100);
      const isDaily = Boolean(body.daily_budget || (!body.lifetime_budget && probeData.daily_budget));

      let targetUpdateId = cleanId;
      let payload: any = {};

      if (isCampaign) {
        if (probeData.lifetime_budget && !body.daily_budget) {
          payload.lifetime_budget = budgetInCents;
        } else if (probeData.daily_budget || isDaily) {
          payload.daily_budget = budgetInCents;
        } else if (adsets.length > 0) {
          // الميزانية على مستوى المجموعة الإعلانية (ABO)
          targetUpdateId = adsets[0].id;
          if (adsets[0].lifetime_budget && !body.daily_budget) {
            payload.lifetime_budget = budgetInCents;
          } else {
            payload.daily_budget = budgetInCents;
          }
        } else {
          payload.daily_budget = budgetInCents;
        }
      } else {
        payload[isDaily ? 'daily_budget' : 'lifetime_budget'] = budgetInCents;
      }

      payload.access_token = token;

      const updateRes = await fetch(`https://graph.facebook.com/v21.0/${targetUpdateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const updateData = await updateRes.json();

      if (updateData.error) {
        return NextResponse.json({ success: false, error: updateData.error.message, meta_error: updateData.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        id: cleanId,
        budget: budgetNum,
        budget_formatted: `${budgetNum.toLocaleString('en-US')} ج.م`,
        budget_type: payload.daily_budget ? 'يومية' : 'إجمالية',
        message: `تم تعديل الميزانية إلى ${budgetNum.toLocaleString('en-US')} ج.م (${payload.daily_budget ? 'يومية' : 'إجمالية'}) بنجاح 💵`
      });
    }

    // ----------------------------------------------------
    // Action 3: UPDATE_STOP_TIME (تعديل أو تمديد تاريخ الانتهاء)
    // ----------------------------------------------------
    if (action === 'UPDATE_STOP_TIME' || action === 'STOP_TIME' || action === 'EXTEND') {
      let resolvedStopTime: string | null = null;

      if (body.extend_days) {
        const days = parseInt(body.extend_days, 10);
        if (isNaN(days) || days <= 0) {
          return NextResponse.json({ success: false, error: 'عدد الأيام المطلوب تمديدها غير صالح' }, { status: 400 });
        }

        // الحساب من تاريخ الانتهاء الحالي إن وجد ولم يفت بعد، أو من الآن
        const currentStopMs = probeData.stop_time ? new Date(probeData.stop_time).getTime() : Date.now();
        const baseMs = currentStopMs > Date.now() ? currentStopMs : Date.now();
        const newStopDate = new Date(baseMs + days * 24 * 60 * 60 * 1000);
        resolvedStopTime = newStopDate.toISOString();
      } else if (body.stop_time === 'clear' || body.stop_time === 'never' || body.stop_time === null) {
        resolvedStopTime = ''; // إزالة تاريخ الانتهاء
      } else if (body.stop_time) {
        const d = new Date(body.stop_time);
        if (isNaN(d.getTime())) {
          return NextResponse.json({ success: false, error: 'صيغة تاريخ الانتهاء غير صحيحة' }, { status: 400 });
        }
        resolvedStopTime = d.toISOString();
      } else {
        return NextResponse.json({ success: false, error: 'يرجى تحديد stop_time أو extend_days' }, { status: 400 });
      }

      const payload: any = { access_token: token };
      if (resolvedStopTime === '') {
        payload.stop_time = null;
      } else {
        payload.stop_time = resolvedStopTime;
      }

      // تحديث الحملة
      const updateRes = await fetch(`https://graph.facebook.com/v21.0/${cleanId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const updateData = await updateRes.json();

      if (updateData.error) {
        return NextResponse.json({ success: false, error: updateData.error.message, meta_error: updateData.error }, { status: 400 });
      }

      // إذا كانت هناك مجموعات إعلانية محددة بوقت، نحدث نهايتها أيضاً
      if (adsets.length > 0) {
        await Promise.all(adsets.map((aset: any) => {
          return fetch(`https://graph.facebook.com/v21.0/${aset.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ end_time: resolvedStopTime || null, access_token: token })
          }).catch(() => null);
        }));
      }

      return NextResponse.json({
        success: true,
        id: cleanId,
        stop_time: resolvedStopTime,
        message: resolvedStopTime
          ? `تم تحديث موعد انتهاء الحملة بنجاح إلى: ${new Date(resolvedStopTime).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })} ⏳`
          : `تم جعل الحملة مستمرة بدون تاريخ انتهاء ♾️`
      });
    }

    // ----------------------------------------------------
    // Action 4: UPDATE_TARGETING (تعديل الاستهداف: سن، نوع، مناطق، اهتمامات، مواضع)
    // ----------------------------------------------------
    if (action === 'UPDATE_TARGETING' || action === 'TARGETING') {
      const targetingUpdate = body.targeting || {};

      let targetAdsetId = cleanId;
      let existingTargeting = probeData.targeting || {};

      if (isCampaign) {
        if (adsets.length === 0) {
          return NextResponse.json({ success: false, error: 'لم يتم العثور على مجموعات إعلانية تابعة لهذه الحملة لتعديل استهدافها' }, { status: 400 });
        }
        targetAdsetId = adsets[0].id;
        existingTargeting = adsets[0].targeting || {};
      }

      const updatedTargeting = { ...existingTargeting };

      // 1. الفئة العمرية (Age)
      const isAdvantageAudience = existingTargeting.targeting_automation?.advantage_audience === 1;
      let minAge = targetingUpdate.age_min ? parseInt(targetingUpdate.age_min, 10) : (updatedTargeting.age_min || 18);
      let maxAge = targetingUpdate.age_max ? parseInt(targetingUpdate.age_max, 10) : (updatedTargeting.age_max || 65);

      if (isAdvantageAudience) {
        updatedTargeting.age_range = [minAge, maxAge];
        updatedTargeting.age_max = 65;
        if (targetingUpdate.age_min) updatedTargeting.age_min = minAge;
      } else {
        if (targetingUpdate.age_min) updatedTargeting.age_min = minAge;
        if (targetingUpdate.age_max) updatedTargeting.age_max = maxAge;
        delete updatedTargeting.age_range;
      }

      // 2. الجنس (Gender)
      if (targetingUpdate.genders !== undefined) {
        if (Array.isArray(targetingUpdate.genders) && targetingUpdate.genders.length > 0) {
          updatedTargeting.genders = targetingUpdate.genders;
        } else if (targetingUpdate.gender === 'MEN' || targetingUpdate.gender === 'رجال') {
          updatedTargeting.genders = [1];
        } else if (targetingUpdate.gender === 'WOMEN' || targetingUpdate.gender === 'نساء') {
          updatedTargeting.genders = [2];
        } else {
          delete updatedTargeting.genders;
        }
      } else if (targetingUpdate.gender) {
        const g = String(targetingUpdate.gender).toUpperCase();
        if (g === 'MEN' || g === 'رجال') {
          updatedTargeting.genders = [1];
        } else if (g === 'WOMEN' || g === 'نساء') {
          updatedTargeting.genders = [2];
        } else {
          delete updatedTargeting.genders;
        }
      }

      // 3. المناطق الجغرافية (Geo Locations & Regions)
      const rawRegions = targetingUpdate.regions || targetingUpdate.governorates || targetingUpdate.locations;
      if (rawRegions) {
        const regionList: string[] = Array.isArray(rawRegions)
          ? rawRegions
          : String(rawRegions).split(/[,،]/).map(s => s.trim()).filter(Boolean);

        const mappedRegions: { key: string }[] = [];
        let isEntireEgypt = false;

        for (const reg of regionList) {
          const cleanName = reg.trim();
          if (cleanName === 'مصر' || cleanName === 'كل مصر' || cleanName === 'EG') {
            isEntireEgypt = true;
            break;
          }
          const matched = EGYPT_GOVERNORATES_MAP[cleanName];
          if (matched) {
            mappedRegions.push({ key: matched.key });
          }
        }

        if (isEntireEgypt || (mappedRegions.length === 0 && (targetingUpdate.country === 'EG' || targetingUpdate.country === 'مصر'))) {
          updatedTargeting.geo_locations = {
            countries: ['EG'],
            location_types: ['home', 'recent']
          };
        } else if (mappedRegions.length > 0) {
          updatedTargeting.geo_locations = {
            regions: mappedRegions,
            location_types: ['home', 'recent']
          };
        }
      } else if (targetingUpdate.geo_locations) {
        updatedTargeting.geo_locations = targetingUpdate.geo_locations;
      } else if (targetingUpdate.countries) {
        updatedTargeting.geo_locations = {
          countries: targetingUpdate.countries,
          location_types: ['home', 'recent']
        };
      }

      // 4. الاهتمامات (Interests)
      if (Array.isArray(targetingUpdate.interests) && targetingUpdate.interests.length > 0) {
        const resolvedList: { id: string; name: string }[] = [];
        for (const item of targetingUpdate.interests) {
          if (typeof item === 'object' && item.id) {
            resolvedList.push(item);
          } else if (typeof item === 'string') {
            const found = await resolveInterest(item, token);
            if (found) resolvedList.push(found);
          }
        }
        if (resolvedList.length > 0) {
          updatedTargeting.flexible_spec = [{ interests: resolvedList }];
        }
      }

      // 5. مواضع الظهور (Placements)
      if (Array.isArray(targetingUpdate.publisher_platforms)) {
        updatedTargeting.publisher_platforms = targetingUpdate.publisher_platforms;
      }
      if (Array.isArray(targetingUpdate.instagram_positions)) {
        updatedTargeting.instagram_positions = targetingUpdate.instagram_positions;
      }
      if (Array.isArray(targetingUpdate.facebook_positions)) {
        updatedTargeting.facebook_positions = targetingUpdate.facebook_positions;
      }

      // إرسال التحديث لـ Meta
      const updateRes = await fetch(`https://graph.facebook.com/v21.0/${targetAdsetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targeting: updatedTargeting,
          access_token: token
        })
      });
      const updateData = await updateRes.json();

      if (updateData.error) {
        return NextResponse.json({
          success: false,
          error: updateData.error.message,
          meta_error: updateData.error
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        campaign_id: isCampaign ? cleanId : null,
        adset_id: targetAdsetId,
        updated_targeting: {
          age_min: updatedTargeting.age_min,
          age_max: updatedTargeting.age_max,
          genders: updatedTargeting.genders || 'الجميع',
          geo_locations: updatedTargeting.geo_locations,
          publisher_platforms: updatedTargeting.publisher_platforms
        },
        message: `تم تحديث استهداف المجموعة الإعلانية بنجاح 🎯`
      });
    }

    // ----------------------------------------------------
    // Action 5: RENAME (تغيير الاسم)
    // ----------------------------------------------------
    if (action === 'RENAME' || action === 'UPDATE_NAME') {
      const newName = String(body.name || '').trim();
      if (!newName) {
        return NextResponse.json({ success: false, error: 'الاسم الجديد مطلوب' }, { status: 400 });
      }

      const updateRes = await fetch(`https://graph.facebook.com/v21.0/${cleanId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, access_token: token })
      });
      const updateData = await updateRes.json();

      if (updateData.error) {
        return NextResponse.json({ success: false, error: updateData.error.message, meta_error: updateData.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        id: cleanId,
        name: newName,
        message: `تم تغيير الاسم إلى "${newName}" بنجاح ✏️`
      });
    }

    // ----------------------------------------------------
    // Action 6: DUPLICATE (تكرار / نسخ الحملة)
    // ----------------------------------------------------
    if (action === 'DUPLICATE' || action === 'COPY') {
      const renamePrefix = body.rename_prefix || 'نسخة - ';
      const statusOption = body.status_option || 'PAUSED';

      const copyRes = await fetch(`https://graph.facebook.com/v21.0/${cleanId}/copies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          deep_copy: body.deep_copy !== false,
          status_option: statusOption,
          rename_options: {
            rename_strategy: 'ONLY_TOP_LEVEL_RENAME',
            rename_prefix: renamePrefix
          }
        })
      });
      const copyData = await copyRes.json();

      if (copyData.error) {
        return NextResponse.json({
          success: false,
          error: copyData.error.message,
          meta_error: copyData.error
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        original_id: cleanId,
        copied_id: copyData.copied_campaign_id || copyData.id,
        message: `تم عمل نسخة (Duplicate) من الحملة بنجاح 📋`
      });
    }

    // ----------------------------------------------------
    // Action 7: UPDATE_CREATIVE (تغيير بوست أو كرييتف الإعلان)
    // ----------------------------------------------------
    if (action === 'UPDATE_CREATIVE' || action === 'UPDATE_POST') {
      const targetAdId = body.ad_id || (ads.length > 0 ? ads[0].id : cleanId);
      const { creative_id, object_story_id } = body;

      if (!creative_id && !object_story_id) {
        return NextResponse.json({ success: false, error: 'يرجى تحديد creative_id أو object_story_id (معرف المنشور)' }, { status: 400 });
      }

      let creativePayload: any = {};
      if (creative_id) {
        creativePayload = { creative_id };
      } else if (object_story_id) {
        // إنشاء كرييتف جديد مرتبط بالبوست المحدد
        const accountId = probeData.account_id || cleanId;
        const creativeCreateRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountId}/adcreatives`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            object_story_id,
            access_token: token
          })
        });
        const createdCreative = await creativeCreateRes.json();
        if (createdCreative.error) {
          return NextResponse.json({ success: false, error: createdCreative.error.message, meta_error: createdCreative.error }, { status: 400 });
        }
        creativePayload = { creative_id: createdCreative.id };
      }

      const updateAdRes = await fetch(`https://graph.facebook.com/v21.0/${targetAdId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creative: creativePayload,
          access_token: token
        })
      });
      const updateAdData = await updateAdRes.json();

      if (updateAdData.error) {
        return NextResponse.json({ success: false, error: updateAdData.error.message, meta_error: updateAdData.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        ad_id: targetAdId,
        message: `تم تغيير البوست / الكرييتف للإعلان بنجاح 🖼️`
      });
    }

    return NextResponse.json({
      success: false,
      error: `الإجراء "${action}" غير مدعوم. الإجراءات المتاحة: UPDATE_STATUS, UPDATE_BUDGET, UPDATE_STOP_TIME, UPDATE_TARGETING, RENAME, DUPLICATE, UPDATE_CREATIVE`
    }, { status: 400 });

  } catch (err: any) {
    console.error('[Manage Campaign API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}
