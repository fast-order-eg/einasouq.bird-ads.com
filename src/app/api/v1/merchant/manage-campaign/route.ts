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
    const probeUrl = `https://graph.facebook.com/v21.0/${cleanId}?fields=id,name,status,daily_budget,lifetime_budget,stop_time,adsets{id,name,daily_budget,lifetime_budget,end_time,targeting}&access_token=${token}`;
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
    // Action 4: UPDATE_TARGETING (تعديل الاستهداف: سن، نوع، مناطق، اهتمامات)
    // ----------------------------------------------------
    if (action === 'UPDATE_TARGETING' || action === 'TARGETING') {
      const targetingUpdate = body.targeting || {};

      // يجب استخراج AdSet لتحديث استهدافه
      let targetAdsetId = cleanId;
      let existingTargeting = probeData.targeting || {};

      if (isCampaign) {
        if (adsets.length === 0) {
          return NextResponse.json({ success: false, error: 'لم يتم العثور على مجموعات إعلانية تابعة لهذه الحملة لتعديل استهدافها' }, { status: 400 });
        }
        targetAdsetId = adsets[0].id;
        existingTargeting = adsets[0].targeting || {};
      }

      // دمج وتحديث خيارات الاستهداف
      const updatedTargeting = { ...existingTargeting };

      // 1. السن
      const isAdvantageAudience = existingTargeting.targeting_automation?.advantage_audience === 1;
      let minAge = targetingUpdate.age_min ? parseInt(targetingUpdate.age_min, 10) : (updatedTargeting.age_min || 18);
      let maxAge = targetingUpdate.age_max ? parseInt(targetingUpdate.age_max, 10) : (updatedTargeting.age_max || 65);

      if (isAdvantageAudience) {
        // في Advantage+ Audience ميتا تعتمد age_range كاقتراح عمر وتفرض age_max = 65 كحد أقصى للتحكم
        updatedTargeting.age_range = [minAge, maxAge];
        updatedTargeting.age_max = 65;
        if (targetingUpdate.age_min) updatedTargeting.age_min = minAge;
      } else {
        if (targetingUpdate.age_min) updatedTargeting.age_min = minAge;
        if (targetingUpdate.age_max) updatedTargeting.age_max = maxAge;
        delete updatedTargeting.age_range;
      }

      // 2. النوع (1 = رجال، 2 = نساء، فارغ/مدمج = الجميع)
      if (targetingUpdate.genders !== undefined) {
        if (Array.isArray(targetingUpdate.genders) && targetingUpdate.genders.length > 0) {
          updatedTargeting.genders = targetingUpdate.genders;
        } else if (targetingUpdate.gender === 'MEN' || targetingUpdate.gender === 'رجال') {
          updatedTargeting.genders = [1];
        } else if (targetingUpdate.gender === 'WOMEN' || targetingUpdate.gender === 'نساء') {
          updatedTargeting.genders = [2];
        } else {
          delete updatedTargeting.genders; // الجميع
        }
      }

      // 3. المناطق الجغرافية (Geo Locations)
      if (targetingUpdate.geo_locations) {
        updatedTargeting.geo_locations = targetingUpdate.geo_locations;
      } else if (targetingUpdate.countries) {
        updatedTargeting.geo_locations = { countries: targetingUpdate.countries };
      } else if (targetingUpdate.country === 'EG' || targetingUpdate.country === 'مصر') {
        updatedTargeting.geo_locations = { countries: ['EG'] };
      }

      // 4. الاهتمامات (Interests / Flexible Spec)
      if (Array.isArray(targetingUpdate.interests) && targetingUpdate.interests.length > 0) {
        updatedTargeting.flexible_spec = [
          { interests: targetingUpdate.interests }
        ];
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

      // إرسال الاستهداف المحدث لميتا
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

    return NextResponse.json({
      success: false,
      error: `الإجراء "${action}" غير مدعوم. الإجراءات المتاحة: UPDATE_STATUS, UPDATE_BUDGET, UPDATE_STOP_TIME, UPDATE_TARGETING, RENAME`
    }, { status: 400 });

  } catch (err: any) {
    console.error('[Manage Campaign API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}
