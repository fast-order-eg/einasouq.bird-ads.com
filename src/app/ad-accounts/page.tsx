'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Building2,
  Search,
  RotateCw,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  DollarSign,
  Layers,
  Sparkles,
  Megaphone,
  BarChart3,
  Calendar,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  MessageSquare,
  TrendingUp,
  MousePointerClick,
  Maximize2,
  Filter,
  RefreshCw,
  Clock,
  Wallet,
  StickyNote,
  Edit3,
  Save,
  Trash2,
  Database,
  Share2,
  Link2,
  Bot,
  Zap,
  ShoppingCart,
  UserCheck,
  Flame,
  ArrowUpRight,
  HelpCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  FileDown,
  Printer,
  Film,
  Target,
  Award,
  PenTool,
  CheckCheck,
  Ban,
  ShieldCheck,
  CalendarDays,
  History
} from 'lucide-react';

// Global client-side memory cache for instant 0ms switching
let globalAdAccountsCache: any = null;

export default function AdAccountsPage() {
  const [loading, setLoading] = useState(!globalAdAccountsCache);
  const [syncing, setSyncing] = useState(false);
  const [syncType, setSyncType] = useState<'ACTIVE_ONLY' | 'ALL'>('ACTIVE_ONLY');
  const [adAccounts, setAdAccounts] = useState<any[]>(globalAdAccountsCache?.adAccounts || []);
  const [businesses, setBusinesses] = useState<any[]>(globalAdAccountsCache?.businesses || []);
  const [summary, setSummary] = useState<any>(globalAdAccountsCache?.summary || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'AD_ACCOUNTS' | 'EXCLUDED' | 'BUSINESSES'>('AD_ACCOUNTS');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RUNNING' | 'ACTIVE' | 'DISABLED'>('ALL');
  
  // Single balance refreshing ID
  const [refreshingBalanceId, setRefreshingBalanceId] = useState<string | null>(null);

  // Selected Account for Ads & Campaigns Inspection Modal
  const [inspectingAccount, setInspectingAccount] = useState<any | null>(null);
  const [modalTab, setModalTab] = useState<'CAMPAIGNS' | 'ADS'>('CAMPAIGNS');
  const [campaignDeliveryFilter, setCampaignDeliveryFilter] = useState<'ALL' | 'ACTIVE' | 'NOT_DELIVERING' | 'PAUSED' | 'COMPLETED'>('ACTIVE');
  const [adDeliveryFilter, setAdDeliveryFilter] = useState<'ALL' | 'ACTIVE' | 'NOT_DELIVERING' | 'PAUSED'>('ACTIVE');
  const [loadingAds, setLoadingAds] = useState(false);
  const [refreshingSingleAccount, setRefreshingSingleAccount] = useState(false);
  const [accountCampaigns, setAccountCampaigns] = useState<any[]>([]);
  const [accountAds, setAccountAds] = useState<any[]>([]);
  const [savedAnalyses, setSavedAnalyses] = useState<{ [key: string]: any }>({});
  const [adsError, setAdsError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [galleryModal, setGalleryModal] = useState<{ images: string[]; activeIndex: number; title: string } | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleDownloadAllImages = async (urls: string[], name: string) => {
    if (!urls || urls.length === 0) return;
    try {
      setDownloadingZip(true);
      const res = await fetch('/api/media/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, filename: name || 'creative_photos' }),
      });
      if (!res.ok) throw new Error('فشل إنشاء ملف الصور المضغوط');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${name || 'creative_photos'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      alert('حدث خطأ أثناء تحميل الصور: ' + (e.message || 'خطأ غير معروف'));
    } finally {
      setDownloadingZip(false);
    }
  };

  // Date Range Presets State inside Modal
  const [datePreset, setDatePreset] = useState<string>('maximum');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDateInputs, setShowCustomDateInputs] = useState(false);

  // Expanded Campaigns for inline AdSets & Ads Tray
  const [expandedCampaigns, setExpandedCampaigns] = useState<{ [key: string]: boolean }>({});

  // AI Campaign Analysis State
  const [analyzingCampId, setAnalyzingCampId] = useState<string | null>(null);
  const [activeAnalysisModal, setActiveAnalysisModal] = useState<{ campaign: any; analysis: any } | null>(null);
  const [analysisModalTab, setAnalysisModalTab] = useState<'ALL' | 'METRICS' | 'ADSETS' | 'CREATIVES' | 'COPYWRITING' | 'TARGETING'>('ALL');
  const [copiedCopyText, setCopiedCopyText] = useState<string | null>(null);

  // Last Updated Timestamps
  const [accountsLastUpdated, setAccountsLastUpdated] = useState<string | null>(null);
  const [inspectingAccountCachedAt, setInspectingAccountCachedAt] = useState<string | null>(null);

  const formatDateTimeArabic = (dateInput?: string | Date | null) => {
    if (!dateInput) return '';
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'م' : 'ص';
      hours = hours % 12 || 12;
      const hoursStr = String(hours).padStart(2, '0');
      return `${day}/${month}/${year} - ${hoursStr}:${minutes} ${ampm}`;
    } catch {
      return '';
    }
  };

  const copyAdCopySuggestion = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCopyText(id);
    setTimeout(() => setCopiedCopyText(null), 2500);
  };

  const openCampaignAnalysis = (camp: any) => {
    if (!camp) return;
    const savedItem = savedAnalyses[camp.id];
    let parsedAnalysis: any = null;
    if (savedItem) {
      const raw = savedItem.analysis || savedItem;
      parsedAnalysis = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch(e){ return raw; } })() : raw;
    }
    if (parsedAnalysis) {
      setActiveAnalysisModal({ campaign: camp, analysis: parsedAnalysis });
    } else {
      handleAnalyzeCampaign(camp, false);
    }
  };

  // Notes Modal state
  const [noteModalAccount, setNoteModalAccount] = useState<any | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteFeedback, setNoteFeedback] = useState<string | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleCampaignExpansion = (campId: string) => {
    setExpandedCampaigns((prev) => ({
      ...prev,
      [campId]: !prev[campId],
    }));
  };

  const fetchAccounts = async (forceRefresh = false, activeOnly = false) => {
    if (forceRefresh) setSyncing(true);
    else if (adAccounts.length === 0) setLoading(true);

    try {
      const url = `/api/ads/accounts${forceRefresh ? `?refresh=true${activeOnly ? '&activeOnly=true' : ''}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        globalAdAccountsCache = data;
        setAdAccounts(data.adAccounts || []);
        setBusinesses(data.businesses || []);
        setSummary(data.summary || null);
        if (data.lastUpdated) {
          setAccountsLastUpdated(data.lastUpdated);
        }
        try {
          localStorage.setItem('adscope_cached_ad_accounts_v2', JSON.stringify(data));
        } catch (e) {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (globalAdAccountsCache && globalAdAccountsCache.adAccounts && globalAdAccountsCache.adAccounts.length > 0) {
      setAdAccounts(globalAdAccountsCache.adAccounts);
      setBusinesses(globalAdAccountsCache.businesses || []);
      setSummary(globalAdAccountsCache.summary || null);
      if (globalAdAccountsCache.lastUpdated) {
        setAccountsLastUpdated(globalAdAccountsCache.lastUpdated);
      }
      setLoading(false);
      return;
    }

    try {
      const cached = localStorage.getItem('adscope_cached_ad_accounts_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.adAccounts && parsed.adAccounts.length > 0) {
          globalAdAccountsCache = parsed;
          setAdAccounts(parsed.adAccounts);
          setBusinesses(parsed.businesses || []);
          setSummary(parsed.summary || null);
          if (parsed.lastUpdated) {
            setAccountsLastUpdated(parsed.lastUpdated);
          }
          setLoading(false);
          return;
        }
      }
    } catch (e) {}

    fetchAccounts(false);
  }, []);

  // Quick Single Account Balance Refresh (200ms)
  const handleRefreshSingleBalance = async (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshingBalanceId(accountId);

    try {
      const res = await fetch('/api/ads/refresh-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setAdAccounts((prev) =>
          prev.map((a) =>
            (a.account_id === accountId || a.id === accountId)
              ? {
                  ...a,
                  available_funds: data.available_funds,
                  amount_spent: data.amount_spent,
                  account_status: data.account_status,
                }
              : a
          )
        );
      }
    } catch (err) {
      console.error('Balance refresh error:', err);
    } finally {
      setRefreshingBalanceId(null);
    }
  };

  // Toggle Account Exclusion
  const handleToggleExclusion = async (account: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newExcluded = !account.is_excluded;

    // Optimistic UI update
    setAdAccounts((prev) =>
      prev.map((a) =>
        (a.account_id === account.account_id || a.id === account.id)
          ? { ...a, is_excluded: newExcluded }
          : a
      )
    );

    try {
      await fetch('/api/ads/toggle-exclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.account_id || account.id,
          isExcluded: newExcluded,
        }),
      });
    } catch (err) {
      console.error('Toggle exclusion error:', err);
    }
  };

  // Inspect Account with Date Preset support
  const handleInspectAccount = async (
    account: any,
    isSingleRefresh = false,
    preset = datePreset,
    timeRange?: { since: string; until: string }
  ) => {
    setInspectingAccount(account);
    if (isSingleRefresh) {
      setRefreshingSingleAccount(true);
    } else {
      setLoadingAds(true);
      setAccountCampaigns([]);
      setAccountAds([]);
      setSavedAnalyses({});
      setCampaignDeliveryFilter('ACTIVE');
      setAdDeliveryFilter('ACTIVE');
      setExpandedCampaigns({});
    }
    setAdsError(null);

    try {
      const res = await fetch('/api/ads/account-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.account_id || account.id,
          forceRefresh: isSingleRefresh,
          datePreset: preset,
          timeRange: timeRange || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.cachedAt) {
          setInspectingAccountCachedAt(data.cachedAt);
        } else {
          setInspectingAccountCachedAt(new Date().toISOString());
        }
        const camps = data.campaigns || [];
        const adsList = data.ads || [];
        setAccountCampaigns(camps);
        setAccountAds(adsList);
        setSavedAnalyses(data.savedAnalyses || {});

        const hasActiveCamps = camps.some((c: any) => c.delivery_status === 'ACTIVE');
        if (!hasActiveCamps) {
          setCampaignDeliveryFilter('ALL');
        }

        const hasActiveAds = adsList.some((a: any) => a.effective_status === 'ACTIVE');
        if (!hasActiveAds) {
          setAdDeliveryFilter('ALL');
        }

        const realActiveCount = camps.filter((c: any) => c.delivery_status === 'ACTIVE').length;
        setAdAccounts((prev) => {
          const updated = prev.map((a) =>
            (a.account_id === account.account_id || a.id === account.id)
              ? { ...a, active_campaigns_count: realActiveCount, has_cache: true }
              : a
          );
          if (globalAdAccountsCache) {
            globalAdAccountsCache.adAccounts = updated;
          }
          try {
            const cached = localStorage.getItem('adscope_cached_ad_accounts_v2');
            if (cached) {
              const parsed = JSON.parse(cached);
              parsed.adAccounts = updated;
              localStorage.setItem('adscope_cached_ad_accounts_v2', JSON.stringify(parsed));
            }
          } catch (e) {}
          return updated;
        });
      } else {
        setAdsError(data.error || 'تعذر جلب إعلانات هذا الحساب');
      }
    } catch (err: any) {
      setAdsError(err.message || 'خطأ في الاتصال');
    } finally {
      setLoadingAds(false);
      setRefreshingSingleAccount(false);
    }
  };

  // Change Date Preset & Refetch
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset === 'custom') {
      setShowCustomDateInputs(true);
      return;
    }
    setShowCustomDateInputs(false);
    if (inspectingAccount) {
      handleInspectAccount(inspectingAccount, true, preset);
    }
  };

  const handleApplyCustomDates = () => {
    if (!customStartDate || !customEndDate) {
      alert('يرجى تحديد تاريخ البداية والنهاية');
      return;
    }
    if (inspectingAccount) {
      handleInspectAccount(inspectingAccount, true, 'custom', {
        since: customStartDate,
        until: customEndDate,
      });
    }
  };

  // Trigger or Re-Run Gemini AI Campaign Strategic Analysis

  const handleDownloadPDF = (campaign: any, analysis: any) => {
    if (!campaign || !analysis) return;

    const bottlenecksList: string[] = Array.isArray(analysis.bottlenecks)
      ? analysis.bottlenecks
      : typeof analysis.bottleneck === 'string'
      ? analysis.bottleneck.split('\n').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const scalingList: string[] = Array.isArray(analysis.scaling_advice_points)
      ? analysis.scaling_advice_points
      : typeof analysis.scaling_advice === 'string'
      ? analysis.scaling_advice.split('\n').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const actionSteps: string[] = Array.isArray(analysis.action_steps) ? analysis.action_steps : [];
    const creatives: any[] = Array.isArray(analysis.creatives_analysis) ? analysis.creatives_analysis : [];
    const copies: any[] = Array.isArray(analysis.copywriting_analysis) ? analysis.copywriting_analysis : [];
    const targeting: any = analysis.targeting_audit || {};
    const appliedTargeting = targeting.applied_targeting_summary || {};

    const insights = campaign.insights?.data?.[0] || {};
    const currency = inspectingAccount?.currency || 'EGP';

    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تقرير فحص وتحليل الحملة: ${campaign.name || 'حملة إعلانية'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 14mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      line-height: 1.6;
      font-size: 13pt;
      margin: 0;
      padding: 0;
    }
    .header-box {
      border: 2px solid #4f46e5;
      border-radius: 16px;
      padding: 20px;
      background: linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%);
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .header-title {
      font-size: 22pt;
      font-weight: 900;
      color: #1e1b4b;
      margin: 0 0 6px 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 11pt;
    }
    .badge-purple { background: #6366f1; color: #ffffff; }
    .badge-emerald { background: #059669; color: #ffffff; }
    .badge-amber { background: #d97706; color: #ffffff; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 14px;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
    }
    .meta-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 12px;
    }
    .meta-label {
      font-size: 10pt;
      color: #64748b;
      font-weight: 600;
      display: block;
    }
    .meta-value {
      font-size: 12pt;
      color: #0f172a;
      font-weight: 800;
    }
    .section-box {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 20px;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 16pt;
      font-weight: 800;
      color: #1e293b;
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .verdict-banner {
      background: #ede9fe;
      border-right: 6px solid #6366f1;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .bullet-point {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      margin-bottom: 8px;
      font-size: 12pt;
      line-height: 1.5;
    }
    .bullet-amber {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
    }
    .bullet-purple {
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      color: #6b21a8;
    }
    .bullet-emerald {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 12px;
    }
    .card-item {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      background: #f8fafc;
      page-break-inside: avoid;
    }
    .footer-note {
      text-align: center;
      font-size: 10pt;
      color: #94a3b8;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header-box">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h1 class="header-title">📊 تقرير التحليل الاستراتيجي الشامل للحملة الإعلانية</h1>
      <span class="badge badge-purple">Gemini 3.8 Flash</span>
    </div>
    <p style="font-size: 14pt; font-weight: 700; color: #334155; margin: 4px 0 0 0;">
      ${campaign.name || 'حملة إعلانية'}
    </p>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">الحساب الإعلاني</span>
        <span class="meta-value">${inspectingAccount?.name || 'حساب إعلاني'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">معرف الحملة (ID)</span>
        <span class="meta-value">${campaign.id}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">إجمالي المصروف</span>
        <span class="meta-value">${insights.spend || 0} ${currency}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">مرات الظهور</span>
        <span class="meta-value">${insights.impressions ? Number(insights.impressions).toLocaleString('en-US') : '0'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">معدل النقر (CTR)</span>
        <span class="meta-value">${insights.ctr ? parseFloat(insights.ctr).toFixed(2) + '%' : '---'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">العائد (Purchase ROAS)</span>
        <span class="meta-value">${insights.purchase_roas?.[0]?.value ? parseFloat(insights.purchase_roas[0].value).toFixed(2) + 'x' : 'غير متوفر'}</span>
      </div>
    </div>
  </div>

  <!-- Section 1: Performance & Metrics -->
  <div class="section-box">
    <h2 class="section-title">📊 الجزء الأول: تقييم الأداء المالي والأرقام والمقاييس</h2>
    
    <div class="verdict-banner">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 800; font-size: 14pt; color: #4338ca;">
          الحكم الاستراتيجي: ${analysis.verdict_badge || 'تحليل الأداء'}
        </span>
        <span class="badge badge-purple" style="font-size: 12pt;">
          التقييم: ${analysis.score || '8.5'} / 10
        </span>
      </div>
      <p style="margin: 0; font-size: 12pt; color: #1e1b4b; font-weight: 600;">
        ${analysis.summary_egyptian || ''}
      </p>
    </div>

    <!-- Bottlenecks as distinct bullets -->
    <div style="margin-bottom: 14px;">
      <h3 style="font-size: 13pt; font-weight: 800; color: #b45309; margin: 0 0 8px 0;">
        ⚠️ عنق الزجاجة ونقاط التسريب (Bottlenecks):
      </h3>
      ${bottlenecksList.map(b => `
        <div class="bullet-point bullet-amber">
          <span style="font-weight: 900; font-size: 14pt; line-height: 1;">•</span>
          <span style="font-weight: 600;">${b}</span>
        </div>
      `).join('')}
    </div>

    <!-- Scaling points as distinct bullets -->
    <div style="margin-bottom: 14px;">
      <h3 style="font-size: 13pt; font-weight: 800; color: #6b21a8; margin: 0 0 8px 0;">
        🚀 توصيات زيادة الميزانية والتكبير (Scaling Advice):
      </h3>
      ${scalingList.map(s => `
        <div class="bullet-point bullet-purple">
          <span style="font-weight: 900; font-size: 14pt; line-height: 1;">•</span>
          <span style="font-weight: 600;">${s}</span>
        </div>
      `).join('')}
    </div>

    <!-- Action Steps -->
    ${actionSteps.length > 0 ? `
      <div>
        <h3 style="font-size: 13pt; font-weight: 800; color: #15803d; margin: 0 0 8px 0;">
          ✅ خطة العمل والتنفيذ الفوري (نعمل إيه بالظبط):
        </h3>
        ${actionSteps.map((step, idx) => `
          <div class="bullet-point bullet-emerald">
            <span style="font-weight: 900; background: #22c55e; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10pt; shrink: 0;">${idx + 1}</span>
            <span style="font-weight: 600;">${step}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  </div>

  <!-- Section 2: Creatives & Visuals Analysis -->
  ${creatives.length > 0 ? `
    <div class="section-box">
      <h2 class="section-title">🎬 الجزء الثاني: فحص وتحليل الكريتيف والتصميمات والفيديوهات (${creatives.length} إعلان)</h2>
      <div class="card-grid">
        ${creatives.map((cr, idx) => `
          <div class="card-item">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <div>
                <span style="font-weight: 800; font-size: 12pt; color: #0f172a;">${cr.ad_name || 'إعلان #' + (idx + 1)}</span>
                <span style="display: inline-block; margin-right: 8px; padding: 2px 8px; border-radius: 9999px; font-size: 9pt; font-weight: 700; background: #ede9fe; color: #6366f1;">
                  ${cr.media_type_label || (cr.is_video ? '🎬 فيديو ريلز إعلاني (14 ثانية)' : '🖼️ منشور ألبوم صور')}
                </span>
              </div>
              <span class="badge badge-purple">${cr.creative_score || '8'}/10</span>
            </div>

            <!-- Ad Stats Grid -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f1f5f9; padding: 8px; border-radius: 8px; margin-bottom: 8px; font-size: 9.5pt;">
              <div><span style="color: #64748b; font-size: 8.5pt; display: block;">المصروف:</span><strong>${cr.spend || '0'}</strong></div>
              <div><span style="color: #059669; font-size: 8.5pt; display: block;">المبيعات:</span><strong style="color: #059669;">${cr.purchases || '0'}</strong></div>
              <div><span style="color: #4f46e5; font-size: 8.5pt; display: block;">تكلفة الشراء:</span><strong>${cr.cpa || 'غير مسجل'}</strong></div>
              <div><span style="color: #d97706; font-size: 8.5pt; display: block;">CTR:</span><strong>${cr.ctr || '0%'}</strong></div>
            </div>

            ${cr.conversion_reality_verdict ? `
              <div style="background: #e0e7ff; border-right: 4px solid #4f46e5; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px;">
                <strong style="color: #3730a3; font-size: 10pt; display: block; margin-bottom: 2px;">⚖️ حقيقة المبيعات وتفسير الفارق:</strong>
                <p style="margin: 0; font-size: 10pt; color: #1e1b4b; line-height: 1.5;">${cr.conversion_reality_verdict}</p>
              </div>
            ` : ''}

            ${cr.post_url ? `
              <p style="font-size: 10pt; margin: 4px 0 8px 0; color: #4f46e5; word-break: break-all;">
                <strong>رابط المنشور:</strong> <a href="${cr.post_url}" target="_blank">${cr.post_url}</a>
              </p>
            ` : ''}
            <div style="margin-bottom: 6px;">
              <strong style="color: #475569; font-size: 11pt;">الهوك البصري (Visual Hook):</strong>
              <p style="margin: 2px 0 6px 0; font-size: 11pt; color: #1e293b;">${cr.visual_hook_analysis || 'غير محدد'}</p>
            </div>
            <div style="margin-bottom: 6px;">
              <strong style="color: #475569; font-size: 11pt;">وضوح المنتج والعرض:</strong>
              <p style="margin: 2px 0 6px 0; font-size: 11pt; color: #1e293b;">${cr.product_offer_clarity || 'غير محدد'}</p>
            </div>
            ${Array.isArray(cr.strengths) && cr.strengths.length > 0 ? `
              <div style="margin-top: 6px;">
                <strong style="color: #166534; font-size: 10pt;">نقاط القوة:</strong>
                <ul style="margin: 2px 0; padding-right: 18px; font-size: 10.5pt; color: #166534;">
                  ${cr.strengths.map((s: string) => `<li>${s}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${Array.isArray(cr.weaknesses) && cr.weaknesses.length > 0 ? `
              <div style="margin-top: 6px;">
                <strong style="color: #b45309; font-size: 10pt;">نقاط التحسين والضعف:</strong>
                <ul style="margin: 2px 0; padding-right: 18px; font-size: 10.5pt; color: #92400e;">
                  ${cr.weaknesses.map((w: string) => `<li>${w}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  ` : ''}

  <!-- Section 3: Copywriting Analysis -->
  ${copies.length > 0 ? `
    <div class="section-box">
      <h2 class="section-title">✍️ الجزء الثالث: فحص وتحليل المحتوى الإعلاني والكتابة التسويقية (Copywriting)</h2>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${copies.map((cp, idx) => `
          <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #f8fafc; page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <span style="font-weight: 800; font-size: 12pt; color: #0f172a;">${cp.ad_name || 'إعلان #' + (idx + 1)}</span>
              <span class="badge badge-purple">تقييم الكوبي: ${cp.copy_score || '8'}/10</span>
            </div>
            <p style="margin: 4px 0 6px 0; font-size: 11pt;"><strong>تحليل الهوك (Hook):</strong> ${cp.hook_analysis || 'غير محدد'}</p>
            <p style="margin: 4px 0 6px 0; font-size: 11pt;"><strong>طريقة السرد والمميزات (Body):</strong> ${cp.body_structure_analysis || 'غير محدد'}</p>
            <p style="margin: 4px 0 6px 0; font-size: 11pt;"><strong>العرض والدعوة للإجراء (CTA):</strong> ${cp.offer_and_cta_analysis || 'غير محدد'}</p>

            ${Array.isArray(cp.alternative_copy_suggestions) && cp.alternative_copy_suggestions.length > 0 ? `
              <div style="margin-top: 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px;">
                <strong style="color: #4338ca; font-size: 11pt; display: block; margin-bottom: 6px;">💡 نصوص مقترحة جاهزة للـ A/B Testing:</strong>
                ${cp.alternative_copy_suggestions.map((sug: string, sIdx: number) => `
                  <div style="background: #f1f5f9; border-right: 4px solid #6366f1; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; font-size: 11pt; line-height: 1.5; white-space: pre-line;">
                    ${sug}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  ` : ''}

  <!-- Section 4: Targeting & Audience Audit -->
  ${targeting && targeting.applied_targeting_summary ? `
    <div class="section-box">
      <h2 class="section-title">🎯 الجزء الرابع: فحص وتدقيق الاستهداف والجمهور (Targeting Audit)</h2>
      
      <div class="meta-grid" style="margin-top: 0; margin-bottom: 14px;">
        <div class="meta-item">
          <span class="meta-label">نوع الاستهداف</span>
          <span class="meta-value">${appliedTargeting.targeting_type_label || (appliedTargeting.is_advantage_plus ? 'Advantage+ Audience' : 'يدوي')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">المناطق الجغرافية</span>
          <span class="meta-value">${appliedTargeting.locations || 'غير محدد'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">السن والنوع</span>
          <span class="meta-value">${appliedTargeting.age_range || ''} | ${appliedTargeting.gender || ''}</span>
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <strong style="color: #475569; font-size: 11pt;">تقييم مطابقة الاستهداف مع الكريتيف:</strong>
        <p style="margin: 4px 0 10px 0; font-size: 12pt; color: #1e1b4b; font-weight: 600;">
          ${targeting.alignment_with_creatives || ''}
        </p>
      </div>

      ${Array.isArray(targeting.strengths) && targeting.strengths.length > 0 ? `
        <div style="margin-bottom: 8px;">
          <strong style="color: #166534; font-size: 11pt;">نقاط القوة في الاستهداف:</strong>
          <ul style="margin: 4px 0; padding-right: 18px; font-size: 11pt; color: #166534;">
            ${targeting.strengths.map((st: string) => `<li>${st}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${Array.isArray(targeting.risks_and_leaks) && targeting.risks_and_leaks.length > 0 ? `
        <div style="margin-bottom: 8px;">
          <strong style="color: #b45309; font-size: 11pt;">نقاط الخطر والتسريب:</strong>
          <ul style="margin: 4px 0; padding-right: 18px; font-size: 11pt; color: #92400e;">
            ${targeting.risks_and_leaks.map((rk: string) => `<li>${rk}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${Array.isArray(targeting.recommendations) && targeting.recommendations.length > 0 ? `
        <div>
          <strong style="color: #4338ca; font-size: 11pt;">توصيات تطوير الاستهداف:</strong>
          <ul style="margin: 4px 0; padding-right: 18px; font-size: 11pt; color: #3730a3;">
            ${targeting.recommendations.map((rc: string) => `<li>${rc}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  ` : ''}

  <div class="footer-note">
    تم إنشاء هذا التقرير الاستراتيجي الشامل بواسطة نظام AdScope AI Intelligence • محرك Gemini 2.5 Pro
  </div>
</body>
</html>`;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 500);
    }
  };

  const handleAnalyzeCampaign = async (camp: any, forceReAnalyze = false) => {
    if (!forceReAnalyze && savedAnalyses[camp.id]) {
      const raw = savedAnalyses[camp.id].analysis || savedAnalyses[camp.id];
      const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch(e){ return raw; } })() : raw;
      setActiveAnalysisModal({ campaign: camp, analysis: parsed });
      return;
    }

    setAnalyzingCampId(camp.id);
    try {
      // Find full campaign object from accountCampaigns if available
      const fullCamp = accountCampaigns.find((c: any) => c.id === camp.id) || camp;

      const res = await fetch('/api/ads/analyze-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign: fullCamp,
          accountId: inspectingAccount?.account_id || inspectingAccount?.id,
          accountName: inspectingAccount?.name || '',
          currency: inspectingAccount?.currency || 'EGP',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        if (res.status === 401) {
          alert('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
          window.location.href = '/login';
          return;
        }
        if (res.status === 504 || res.status === 502 || res.status === 524) {
          throw new Error('استغرق الفحص وقتاً أطول من المعتاد نظراً لحجم البيانات، برجاء إعادة المحاولة');
        }
        throw new Error('حدث خطأ في استجابة السيرفر أثناء معالجة التحليل');
      }

      if (data && data.success && data.analysis) {
        setSavedAnalyses((prev) => ({
          ...prev,
          [camp.id]: {
            campaign_id: camp.id,
            campaign_name: camp.name,
            analyzed_at: data.analyzedAt,
            analysis: data.analysis,
          },
        }));
        setActiveAnalysisModal({ campaign: fullCamp, analysis: data.analysis });
      } else {
        alert(data?.error || 'تعذر تحليل أداء الحملة بالذكاء الاصطناعي');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في الاتصال بالسيرفر، يرجى المحاولة لاحقاً');
    } finally {
      setAnalyzingCampId(null);
    }
  };

  // Open Notes Modal
  const handleOpenNoteModal = (account: any) => {
    setNoteModalAccount(account);
    setNoteText(account.note || '');
    setNoteFeedback(null);
  };

  // Save Note to Database
  const handleSaveNote = async () => {
    if (!noteModalAccount) return;
    setSavingNote(true);
    setNoteFeedback(null);

    try {
      const res = await fetch('/api/ads/account-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: noteModalAccount.account_id || noteModalAccount.id,
          note: noteText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNoteFeedback('تم حفظ الملاحظة بنجاح في قاعدة البيانات ✅');
        setAdAccounts((prev) =>
          prev.map((a) =>
            (a.account_id === noteModalAccount.account_id || a.id === noteModalAccount.id)
              ? { ...a, note: data.note, note_updated_at: data.updatedAt }
              : a
          )
        );
        setTimeout(() => {
          setNoteModalAccount(null);
          setNoteFeedback(null);
        }, 1000);
      } else {
        setNoteFeedback(data.error || 'فشل حفظ الملاحظة');
      }
    } catch (err: any) {
      setNoteFeedback(err.message || 'خطأ في الاتصال');
    } finally {
      setSavingNote(false);
    }
  };

  // Filter Active vs Excluded Accounts
  const activeApprovedAccounts = useMemo(() => {
    return adAccounts.filter((a) => !a.is_excluded && a.account_status === 1);
  }, [adAccounts]);

  const excludedAccountsList = useMemo(() => {
    return adAccounts.filter((a) => a.is_excluded || a.account_status !== 1);
  }, [adAccounts]);

  // Filter Ad Accounts based on Search and Tab
  const filteredAccounts = useMemo(() => {
    const sourceList = activeTab === 'EXCLUDED' ? excludedAccountsList : activeApprovedAccounts;

    return sourceList.filter((a) => {
      const matchesSearch =
        (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.account_id || a.id || '').includes(searchQuery) ||
        (a.note || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.currency || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'RUNNING') return a.account_status === 1 && (a.active_campaigns_count > 0 || parseFloat(a.available_funds) > 0);
      if (statusFilter === 'ACTIVE') return a.account_status === 1;
      if (statusFilter === 'DISABLED') return a.account_status !== 1;

      return true;
    });
  }, [activeTab, activeApprovedAccounts, excludedAccountsList, searchQuery, statusFilter]);

  // Dynamic Totals strictly for visible, non-excluded, active (non-restricted) accounts
  const visibleActiveAccountsForTotals = useMemo(() => {
    const baseList = activeTab === 'AD_ACCOUNTS' ? filteredAccounts : activeApprovedAccounts;
    return baseList.filter((a) => !a.is_excluded && a.account_status === 1);
  }, [activeTab, filteredAccounts, activeApprovedAccounts]);

  const liveTotalActiveCampaigns = useMemo(() => {
    return visibleActiveAccountsForTotals.reduce((acc, a) => acc + (Number(a.active_campaigns_count) || 0), 0);
  }, [visibleActiveAccountsForTotals]);

  const liveTotalAvailableFunds = useMemo(() => {
    return Math.round(
      visibleActiveAccountsForTotals.reduce((acc, a) => acc + (parseFloat(a.available_funds || '0') || 0), 0)
    );
  }, [visibleActiveAccountsForTotals]);

  // Filter Businesses
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((b) => {
      return (
        (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.id || '').includes(searchQuery)
      );
    });
  }, [businesses, searchQuery]);

  // Filter Campaigns inside Modal
  const modalFilteredCampaigns = useMemo(() => {
    if (campaignDeliveryFilter === 'ALL') return accountCampaigns;
    return accountCampaigns.filter((c) => c.delivery_status === campaignDeliveryFilter);
  }, [accountCampaigns, campaignDeliveryFilter]);

  // Filter Ads inside Modal
  const modalFilteredAds = useMemo(() => {
    if (adDeliveryFilter === 'ALL') return accountAds;
    if (adDeliveryFilter === 'ACTIVE') return accountAds.filter((a) => a.effective_status === 'ACTIVE');
    if (adDeliveryFilter === 'NOT_DELIVERING') return accountAds.filter((a) => a.effective_status === 'DISAPPROVED' || a.effective_status === 'WITH_ISSUES');
    if (adDeliveryFilter === 'PAUSED') return accountAds.filter((a) => (a.effective_status || '').includes('PAUSED') || a.status === 'PAUSED');
    return accountAds;
  }, [accountAds, adDeliveryFilter]);

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return { label: 'نشط ومصرح', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: CheckCircle2 };
      case 2:
        return { label: 'معطل / مقيد', bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400', icon: XCircle };
      case 3:
        return { label: 'معلق مديونية', bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', icon: AlertTriangle };
      default:
        return { label: 'غير نشط', bg: 'bg-slate-500/10 border-slate-500/30 text-slate-400', icon: AlertCircle };
    }
  };

  const getDeliveryStatusBadge = (deliveryStatus: string) => {
    switch (deliveryStatus) {
      case 'ACTIVE':
        return {
          label: 'نشطة',
          bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
          dot: 'bg-emerald-400 animate-ping',
          icon: PlayCircle
        };
      case 'NOT_DELIVERING':
        return {
          label: 'لا يتم العرض (مرفوضة أو معطلة)',
          bg: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
          dot: 'bg-rose-400',
          icon: XCircle
        };
      case 'PAUSED':
        return {
          label: 'متوقفة مؤقتاً (مطفأة)',
          bg: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
          dot: 'bg-amber-400',
          icon: PauseCircle
        };
      case 'COMPLETED':
      default:
        return {
          label: 'انتهت / مكتملة',
          bg: 'bg-slate-800 border-slate-700 text-slate-400',
          dot: 'bg-slate-500',
          icon: Clock
        };
    }
  };

  // Helper to extract Facebook/Instagram Post URL from creative
  const getPostUrl = (creative: any) => {
    if (!creative) return null;
    if (creative.instagram_permalink_url) return creative.instagram_permalink_url;
    if (creative.link_url && creative.link_url.includes('facebook.com')) return creative.link_url;

    const storyId = creative.effective_object_story_id || creative.object_story_id;
    if (storyId) {
      const parts = storyId.split('_');
      if (parts.length === 2) {
        return `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`;
      }
      return `https://www.facebook.com/${storyId}`;
    }
    return null;
  };

  // Highly Accurate Dynamic Campaign Type & Metrics Extractor
  const extractCampaignDetails = (camp: any) => {
    const objective = (camp.objective || '').toUpperCase();
    const adsets = camp.adsets?.data || camp.adsets || [];
    const adsList = camp.ads?.data || camp.ads || [];
    const primaryAdset = adsets[0] || {};
    const optGoal = (primaryAdset.optimization_goal || '').toUpperCase();
    const insights = camp.insights?.data?.[0] || {};
    const actions = insights.actions || [];
    const costs = insights.cost_per_action_type || [];
    const actionValues = insights.action_values || [];
    const roasArr = insights.purchase_roas || [];

    const getAction = (types: string[]) => {
      for (const t of types) {
        const match = actions.find((a: any) => a.action_type === t || a.action_type.includes(t));
        if (match) return parseInt(match.value, 10);
      }
      return 0;
    };

    const getCost = (types: string[]) => {
      for (const t of types) {
        const match = costs.find((c: any) => c.action_type === t || c.action_type.includes(t));
        if (match) return Math.round(parseFloat(match.value)).toLocaleString('en-US');
      }
      return null;
    };

    const getValue = (types: string[]) => {
      for (const t of types) {
        const match = actionValues.find((v: any) => v.action_type === t || v.action_type.includes(t));
        if (match) return Math.round(parseFloat(match.value)).toLocaleString('en-US', { maximumFractionDigits: 0 });
      }
      return null;
    };

    // Specific Action extractions
    const msgStarted = getAction(['messaging_conversation_started_7d', 'messaging_conversation_started', 'total_messaging_connection']);
    const msgCost = getCost(['total_messaging_connection', 'messaging_conversation_started_7d', 'messaging_conversation_started']);
    const msgReplies = getAction(['messaging_conversation_replied_7d', 'messaging_first_reply']);
    const msgReplyCost = getCost(['messaging_first_reply', 'messaging_conversation_replied_7d']);
    const msgConnections = getAction(['total_messaging_connection', 'messaging_user_depth_2_message_send']);

    const purchases = getAction(['onsite_web_purchase', 'omni_purchase', 'purchase']);
    const costPerPurchase = getCost(['onsite_web_purchase', 'omni_purchase', 'purchase']);
    const purchaseValue = getValue(['onsite_web_purchase', 'omni_purchase', 'purchase']);
    const roas = roasArr[0]?.value ? parseFloat(roasArr[0].value).toFixed(1) : null;
    const addToCart = getAction(['onsite_web_add_to_cart', 'omni_add_to_cart', 'add_to_cart']);
    const costPerAddToCart = getCost(['onsite_web_add_to_cart', 'omni_add_to_cart', 'add_to_cart']);
    const initiateCheckout = getAction(['onsite_web_initiate_checkout', 'omni_initiated_checkout', 'initiate_checkout']);
    const costPerCheckout = getCost(['onsite_web_initiate_checkout', 'omni_initiated_checkout', 'initiate_checkout']);

    const leads = getAction(['onsite_web_lead', 'lead', 'onsite_conversion.lead']);
    const costPerLead = getCost(['onsite_web_lead', 'lead', 'onsite_conversion.lead']);

    const linkClicks = getAction(['link_click', 'landing_page_view']);
    const costPerLinkClick = insights.cost_per_inline_link_click ? Math.round(parseFloat(insights.cost_per_inline_link_click)).toLocaleString('en-US') : getCost(['link_click']);

    // Determine Exact Campaign Category
    let category: 'MESSAGES' | 'SALES' | 'LEADS' | 'TRAFFIC' | 'ENGAGEMENT' = 'MESSAGES';
    let categoryBadge = 'محادثات ورسائل 💬';
    let categoryColor = 'bg-blue-500/15 border-blue-500/30 text-blue-300';

    if (optGoal.includes('CONVERSATION') || optGoal.includes('MESSAGING') || objective.includes('MESSAGES')) {
      category = 'MESSAGES';
      categoryBadge = 'محادثات ورسائل 💬';
      categoryColor = 'bg-blue-500/15 border-blue-500/30 text-blue-300';
    } else if (optGoal.includes('OFFSITE_CONVERSIONS') || optGoal.includes('PURCHASE') || objective.includes('SALES')) {
      if (msgStarted > 50 && purchases < 5 && !roas) {
        category = 'MESSAGES';
        categoryBadge = 'محادثات ورسائل 💬';
        categoryColor = 'bg-blue-500/15 border-blue-500/30 text-blue-300';
      } else {
        category = 'SALES';
        categoryBadge = 'مبيعات متجر 🛒';
        categoryColor = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      }
    } else if (optGoal.includes('LEAD') || objective.includes('LEAD')) {
      category = 'LEADS';
      categoryBadge = 'استمارات ليد 📋';
      categoryColor = 'bg-amber-500/15 border-amber-500/30 text-amber-300';
    } else if (optGoal.includes('LINK_CLICKS') || optGoal.includes('LANDING_PAGE') || objective.includes('TRAFFIC')) {
      category = 'TRAFFIC';
      categoryBadge = 'زيارات متجر 🌐';
      categoryColor = 'bg-purple-500/15 border-purple-500/30 text-purple-300';
    } else {
      if (msgStarted > purchases && msgStarted > leads) {
        category = 'MESSAGES';
        categoryBadge = 'محادثات ورسائل 💬';
        categoryColor = 'bg-blue-500/15 border-blue-500/30 text-blue-300';
      } else if (purchases > 0) {
        category = 'SALES';
        categoryBadge = 'مبيعات متجر 🛒';
        categoryColor = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      } else if (leads > 0) {
        category = 'LEADS';
        categoryBadge = 'استمارات ليد 📋';
        categoryColor = 'bg-amber-500/15 border-amber-500/30 text-amber-300';
      } else {
        category = 'ENGAGEMENT';
        categoryBadge = 'تفاعل ومشاهدات 📢';
        categoryColor = 'bg-slate-800 border-slate-700 text-slate-300';
      }
    }

    return {
      category,
      categoryBadge,
      categoryColor,
      spend: insights.spend ? Math.round(parseFloat(insights.spend)).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0',
      reach: insights.reach ? parseInt(insights.reach, 10).toLocaleString('en-US') : '0',
      impressions: insights.impressions ? parseInt(insights.impressions, 10).toLocaleString('en-US') : '0',
      frequency: insights.frequency ? parseFloat(insights.frequency).toFixed(1) : '1',
      cpm: insights.cpm ? Math.round(parseFloat(insights.cpm)).toLocaleString('en-US') : '0',
      cpc: insights.cpc ? Math.round(parseFloat(insights.cpc)).toLocaleString('en-US') : '0',
      ctr: insights.ctr ? parseFloat(insights.ctr).toFixed(1) : '0',
      linkCtr: insights.inline_link_click_ctr ? parseFloat(insights.inline_link_click_ctr).toFixed(1) : null,
      msgStarted: msgStarted || msgConnections,
      msgCost: msgCost || '0',
      msgReplies,
      msgReplyCost: msgReplyCost || '---',
      msgConnections,
      purchases,
      costPerPurchase: costPerPurchase || '---',
      purchaseValue,
      roas,
      addToCart,
      costPerAddToCart: costPerAddToCart || '---',
      initiateCheckout,
      costPerCheckout: costPerCheckout || '---',
      leads,
      costPerLead: costPerLead || '---',
      linkClicks,
      costPerLinkClick: costPerLinkClick || '---',
      adsets,
      adsetsList: adsets,
      adsList,
      adsetsCount: adsets.length > 0 ? adsets.length : 1,
      adsCount: adsList.length,
    };
  };

  // Format Date in English digits with Hours & Minutes
  const formatDateEnglish = (d: string | null) => {
    if (!d) return 'مستمرة (بدون تاريخ انتهاء)';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;

    return `${year}/${month}/${day} ${String(hours12).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const savedAnalysesList = useMemo(() => {
    return Object.values(savedAnalyses || {});
  }, [savedAnalyses]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">الحسابات الإعلانية ومديرو الأعمال</h1>
              <p className="text-xs text-slate-400 mt-0.5">استعراض الحسابات النشطة، خانة الاستبعاد، فلاتر التاريخ، تحديث الرصيد السريع، وتقارير الذكاء الاصطناعي</p>
            </div>
          </div>
        </div>

        {/* Single Refresh Action & Last Updated */}
        <div className="flex flex-wrap items-center gap-2.5">
          {accountsLastUpdated && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-slate-400 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>آخر تحديث:</span>
              <span className="text-emerald-300 font-bold dir-ltr">{formatDateTimeArabic(accountsLastUpdated)}</span>
            </div>
          )}
          <button
            onClick={() => fetchAccounts(true)}
            disabled={syncing}
            title="تحديث بيانات الحسابات الإعلانية من فيسبوك وقاعدة البيانات"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'جاري التحديث...' : 'تحديث'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Real Active Running Campaigns */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/40 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
            <span>الحملات النشطة الشغالة الآن</span>
            <Megaphone className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {liveTotalActiveCampaigns.toLocaleString('en-US')}
            <span className="text-xs font-normal text-slate-400 mr-1.5">حملة فعلية</span>
          </p>
          <p className="text-[11px] text-emerald-400/90 font-semibold flex items-center gap-1">
            <PlayCircle className="w-3 h-3" />
            تعمل وتقوم بالعرض حالياً (بدون المتوقف مؤقتاً)
          </p>
        </div>

        {/* 2. Total Available Funds */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/40 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-indigo-300 text-xs font-bold">
            <span>إجمالي الأموال المتوفرة</span>
            <Wallet className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-300">
            {liveTotalAvailableFunds.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            <span className="text-xs font-normal text-slate-400 mr-1.5">ج.م</span>
          </p>
          <p className="text-[11px] text-indigo-400/80 font-semibold">للحسابات النشطة الظاهرة فقط (بدون المستبعد أو المقيد)</p>
        </div>

        {/* 3. Total Active Approved Accounts */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>الحسابات المعتمدة والنشطة</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white">{activeApprovedAccounts.length}</p>
          <p className="text-[11px] text-emerald-400 font-semibold">مشمولة في المزامنة اليومية</p>
        </div>

        {/* 4. Excluded / Restricted Accounts */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>الحسابات المستبعدة / المعطلة</span>
            <Ban className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">{excludedAccountsList.length}</p>
          <p className="text-[11px] text-rose-400/80 font-semibold">مستبعدة لتسريع الأداء وحماية الليمت</p>
        </div>
      </div>

      {/* Main Tabs + Search & Filters */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Main Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start">
            <button
              onClick={() => setActiveTab('AD_ACCOUNTS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'AD_ACCOUNTS'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>الحسابات المعتمدة ({activeApprovedAccounts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('EXCLUDED')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'EXCLUDED'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>المستبعدة من التحديث ({excludedAccountsList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('BUSINESSES')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'BUSINESSES'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>مديرو الأعمال ({businesses.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، رقم الـ ID، الملاحظات، أو العملة..."
              className="w-full pl-4 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-all"
            />
          </div>
        </div>

        {/* Sub-filters for Ad Accounts */}
        {(activeTab === 'AD_ACCOUNTS' || activeTab === 'EXCLUDED') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs">
            <span className="text-slate-500 font-medium ml-1">التصفية:</span>
            {[
              { id: 'ALL', label: `الكل (${activeTab === 'EXCLUDED' ? excludedAccountsList.length : activeApprovedAccounts.length})` },
              { id: 'RUNNING', label: `شغالة وعليها حملات الآن (${(activeTab === 'EXCLUDED' ? excludedAccountsList : activeApprovedAccounts).filter(a => a.account_status === 1 && a.active_campaigns_count > 0).length})` },
              { id: 'ACTIVE', label: `النشطة فقط (${(activeTab === 'EXCLUDED' ? excludedAccountsList : activeApprovedAccounts).filter(a => a.account_status === 1).length})` },
              { id: 'DISABLED', label: `المعطلة والمقيدة (${(activeTab === 'EXCLUDED' ? excludedAccountsList : activeApprovedAccounts).filter(a => a.account_status !== 1).length})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RotateCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">جاري قراءة الحسابات والملاحظات من قاعدة البيانات...</p>
        </div>
      ) : activeTab === 'AD_ACCOUNTS' || activeTab === 'EXCLUDED' ? (
        filteredAccounts.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
            <CreditCard className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">
              {activeTab === 'EXCLUDED' ? 'لا توجد حسابات مستبعدة مطابقة للبحث' : 'لا توجد حسابات معتمدة مطابقة للبحث أو الفلتر'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((a) => {
              const statusInfo = getStatusBadge(a.account_status);
              const StatusIcon = statusInfo.icon;
              const spentAmount = Math.round(parseFloat(a.amount_spent || '0') / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
              const availableFunds = Math.round(parseFloat(a.available_funds || '0')).toLocaleString('en-US', { maximumFractionDigits: 0 });
              const pureId = (a.account_id || a.id || '').replace(/^act_/, '');
              const firstLineNote = a.note ? a.note.split('\n')[0].trim() : '';
              const isRefreshingThisBalance = refreshingBalanceId === pureId;

              return (
                <div
                  key={pureId}
                  className={`p-5 rounded-2xl border transition-all space-y-4 shadow-sm flex flex-col justify-between ${
                    a.is_excluded
                      ? 'bg-slate-950/80 border-rose-500/20 opacity-85'
                      : a.account_status === 1
                      ? 'bg-slate-900/90 hover:bg-slate-900 border-slate-800/90 hover:border-slate-700'
                      : 'bg-slate-950/60 border-amber-500/20'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Status badge + Real Active Count + Exclusion Toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusInfo.label}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {a.active_campaigns_count > 0 ? (
                          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            {a.active_campaigns_count} حملة نشطة
                          </span>
                        ) : null}

                        {/* Exclude / Include Toggle Button */}
                        <button
                          onClick={(e) => handleToggleExclusion(a, e)}
                          title={a.is_excluded ? 'إلغاء الاستبعاد وتضمينه في المزامنة السريعة' : 'استبعاد الحساب من التحديث الشامل والمزامنة'}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            a.is_excluded
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                          }`}
                        >
                          {a.is_excluded ? '✅ إعادة تضمين' : '🚫 استبعاد'}
                        </button>
                      </div>
                    </div>

                    {/* Account Name + Copy */}
                    <div>
                      <div className="flex items-center justify-between group">
                        <h3 className="font-black text-slate-100 text-base leading-snug line-clamp-1" title={a.name}>
                          {a.name}
                        </h3>
                        <button
                          onClick={() => copyToClipboard(a.name, `name-${pureId}`)}
                          title="نسخ اسم الحساب"
                          className="text-slate-500 hover:text-indigo-400 p-1 transition-all cursor-pointer"
                        >
                          {copiedId === `name-${pureId}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Explicit Account ID with Copy */}
                      <div className="flex items-center justify-between mt-1.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 font-sans">معرف الحساب (ID):</span>
                          <span className="text-xs font-bold text-indigo-300 tracking-wide">{pureId}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(pureId, `id-${pureId}`)}
                          title="نسخ رقم الحساب"
                          className="text-slate-400 hover:text-indigo-400 p-0.5 transition-all flex items-center gap-1 text-[10px] cursor-pointer"
                        >
                          {copiedId === `id-${pureId}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-sans">تم</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="font-sans">نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Interactive Note Box */}
                    <div
                      onClick={() => handleOpenNoteModal(a)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        firstLineNote
                          ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60 text-amber-200'
                          : 'bg-slate-950/60 border-dashed border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${firstLineNote ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                          <StickyNote className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium truncate">
                          {firstLineNote ? firstLineNote : 'اضغط لإضافة ملاحظة للحساب...'}
                        </span>
                      </div>
                      <Edit3 className="w-3.5 h-3.5 shrink-0 opacity-60 hover:opacity-100" />
                    </div>

                    {/* Metrics Grid: Total Spent + Available Funds with SINGLE REFRESH BUTTON */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-xs">
                      {/* Total Spent */}
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/60">
                        <span className="text-slate-500 block text-[10px]">إجمالي المصروف</span>
                        <span className="font-bold text-slate-200">{spentAmount} {a.currency}</span>
                      </div>

                      {/* Available Funds with Single Refresh Button */}
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-950/30 to-slate-950/90 border border-emerald-500/30 flex items-center justify-between">
                        <div>
                          <span className="text-emerald-400/80 block text-[10px] font-bold flex items-center gap-1">
                            <Wallet className="w-3 h-3 text-emerald-400" />
                            الأموال المتوفرة
                          </span>
                          <span className="font-black text-emerald-400 text-sm">
                            {availableFunds} {a.currency}
                          </span>
                        </div>

                        {/* Instant Balance Refresh Button */}
                        <button
                          onClick={(e) => handleRefreshSingleBalance(pureId, e)}
                          disabled={isRefreshingThisBalance}
                          title="تحديث رصيد هذا الحساب الآن بشكل فوري ومستقل"
                          className="w-7 h-7 rounded-lg bg-slate-900/90 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 flex items-center justify-center transition-all cursor-pointer shrink-0"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${isRefreshingThisBalance ? 'animate-spin text-emerald-300' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Inspect Ads */}
                  <div className="pt-3 border-t border-slate-800/60">
                    <button
                      onClick={() => handleInspectAccount(a)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>استعراض الإعلانات والحملات التفصيلية</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Businesses Tab */
        filteredBusinesses.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
            <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">لا يوجد مديرو أعمال مطابقون للبحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBusinesses.map((b) => (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    b.verification_status === 'verified'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    {b.verification_status === 'verified' ? 'موثق رسمياً' : 'غير موثق'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Business Portfolio</span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-100 text-base line-clamp-1">{b.name}</h3>
                    <button
                      onClick={() => copyToClipboard(b.name, `biz-name-${b.id}`)}
                      title="نسخ اسم مدير الأعمال"
                      className="text-slate-500 hover:text-indigo-400 p-1 cursor-pointer"
                    >
                      {copiedId === `biz-name-${b.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-1.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-sans">معرف البيزنس (ID):</span>
                      <span className="text-xs font-bold text-purple-300">{b.id}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(b.id, `biz-id-${b.id}`)}
                      title="نسخ معرف مدير الأعمال"
                      className="text-slate-400 hover:text-indigo-400 p-0.5 flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      {copiedId === `biz-id-${b.id}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-sans">تم</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="font-sans">نسخ</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Rich Detailed Ads & Campaigns Modal */}
      {inspectingAccount && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-1 sm:p-4 md:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-6xl w-full max-h-[96vh] sm:max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-white text-base leading-snug">{inspectingAccount.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">{inspectingAccount.currency}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400 font-mono">
                      معرف الحساب (ID): {(inspectingAccount.account_id || inspectingAccount.id || '').replace(/^act_/, '')}
                    </span>
                    <button
                      onClick={() => copyToClipboard((inspectingAccount.account_id || inspectingAccount.id || '').replace(/^act_/, ''), 'header-id')}
                      className="text-slate-400 hover:text-indigo-400 p-0.5 cursor-pointer"
                    >
                      {copiedId === 'header-id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 mr-2">
                      <Wallet className="w-3 h-3" />
                      الأموال المتوفرة: {Math.round(parseFloat(inspectingAccount.available_funds || '0')).toLocaleString('en-US', { maximumFractionDigits: 0 })} {inspectingAccount.currency}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {inspectingAccountCachedAt && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-400 shadow-sm">
                    <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>آخر تحديث:</span>
                    <span className="text-indigo-300 font-bold dir-ltr">{formatDateTimeArabic(inspectingAccountCachedAt)}</span>
                  </div>
                )}

                {/* Single-Account Refresh Button */}
                <button
                  onClick={() => handleInspectAccount(inspectingAccount, true)}
                  disabled={refreshingSingleAccount || loadingAds}
                  title="تحديث وسحب أحدث بيانات هذا الحساب الآن من فيسبوك وحفظها بالـ DB"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer shadow-sm"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${refreshingSingleAccount ? 'animate-spin text-indigo-400' : ''}`} />
                  <span>{refreshingSingleAccount ? 'جاري التحديث...' : 'تحديث هذا الحساب'}</span>
                </button>

                <button
                  onClick={() => {
                    setInspectingAccount(null);
                    setInspectingAccountCachedAt(null);
                  }}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs + DATE RANGE PRESETS */}
            <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
              {/* Tabs: Campaigns vs Ads */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalTab('CAMPAIGNS')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    modalTab === 'CAMPAIGNS'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>الحملات الإعلانية ({accountCampaigns.length})</span>
                </button>

                <button
                  onClick={() => setModalTab('ADS')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    modalTab === 'ADS'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                  }`}
                >
                  <Megaphone className="w-4 h-4" />
                  <span>الإعلانات الفردية ({accountAds.length})</span>
                </button>
              </div>

              {/* DATE RANGE SELECTOR BAR */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto whitespace-nowrap scrollbar-none max-w-full">
                <span className="text-slate-400 font-semibold px-2 flex items-center gap-1 text-[11px]">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
                  النطاق الزمني:
                </span>
                {[
                  { id: 'maximum', label: 'الحد الأقصى' },
                  { id: 'today', label: 'اليوم' },
                  { id: 'yesterday', label: 'أمس' },
                  { id: 'last_7d', label: 'آخر 7 أيام' },
                  { id: 'last_30d', label: 'آخر 30 يوم' },
                  { id: 'this_month', label: 'هذا الشهر' },
                  { id: 'custom', label: 'مخصص...' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleDatePresetChange(p.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-[11px] ${
                      datePreset === p.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Picker Sub-bar */}
            {showCustomDateInputs && (
              <div className="px-5 py-2.5 bg-indigo-950/40 border-b border-indigo-500/30 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-indigo-300 font-bold">تحديد نطاق مخصص بالأيام:</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">من:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">إلى:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={handleApplyCustomDates}
                  className="px-3.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  تطبيق النطاق
                </button>
              </div>
            )}

            {/* Campaign Delivery Filter Pills */}
            {modalTab === 'CAMPAIGNS' && accountCampaigns.length > 0 && (
              <div className="px-3 sm:px-5 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 text-xs overflow-x-auto whitespace-nowrap scrollbar-none">
                <span className="text-slate-500 font-medium ml-1">تصفية حالة العرض:</span>
                {[
                  {
                    id: 'ACTIVE',
                    label: `🟢 نشطة (${accountCampaigns.filter(c => c.delivery_status === 'ACTIVE').length})`,
                    activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  },
                  {
                    id: 'NOT_DELIVERING',
                    label: `🔴 لا يتم العرض / مرفوضة (${accountCampaigns.filter(c => c.delivery_status === 'NOT_DELIVERING').length})`,
                    activeClass: 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  },
                  {
                    id: 'PAUSED',
                    label: `⏸️ متوقفة مؤقتاً (${accountCampaigns.filter(c => c.delivery_status === 'PAUSED').length})`,
                    activeClass: 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  },
                  {
                    id: 'COMPLETED',
                    label: `⏹️ انتهت / مكتملة (${accountCampaigns.filter(c => c.delivery_status === 'COMPLETED').length})`,
                    activeClass: 'bg-slate-700 text-white'
                  },
                  {
                    id: 'ALL',
                    label: `📋 الكل (${accountCampaigns.length})`,
                    activeClass: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setCampaignDeliveryFilter(f.id as any)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      campaignDeliveryFilter === f.id
                        ? f.activeClass
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* Ad Delivery Filter Pills */}
            {modalTab === 'ADS' && accountAds.length > 0 && (
              <div className="px-5 py-2 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium ml-1">تصفية الإعلانات:</span>
                {[
                  {
                    id: 'ACTIVE',
                    label: `🟢 إعلانات نشطة وقيد العرض (${accountAds.filter(a => a.effective_status === 'ACTIVE').length})`,
                    activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  },
                  {
                    id: 'NOT_DELIVERING',
                    label: `🔴 مرفوضة أو بها مشاكل (${accountAds.filter(a => a.effective_status === 'DISAPPROVED' || a.effective_status === 'WITH_ISSUES').length})`,
                    activeClass: 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  },
                  {
                    id: 'PAUSED',
                    label: `⏸️ متوقفة مؤقتاً (${accountAds.filter(a => (a.effective_status || '').includes('PAUSED') || a.status === 'PAUSED').length})`,
                    activeClass: 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  },
                  {
                    id: 'ALL',
                    label: `📋 كل الإعلانات (${accountAds.length})`,
                    activeClass: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setAdDeliveryFilter(f.id as any)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      adDeliveryFilter === f.id
                        ? f.activeClass
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-5">
              {/* TOP SECTION: SAVED AI CAMPAIGN ANALYSES SHOWCASE */}
              {modalTab === 'CAMPAIGNS' && savedAnalysesList.length > 0 && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/30 space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                      <h4 className="font-black text-white text-xs">
                        🧠 تقارير وتحليلات الذكاء الاصطناعي المحفوظة لهذا الحساب ({savedAnalysesList.length})
                      </h4>
                    </div>
                    
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedAnalysesList.map((item: any, aIdx: number) => {
                      const analysis = item.analysis || item;
                      const campObj = accountCampaigns.find(c => c.id === item.campaign_id) || { id: item.campaign_id, name: item.campaign_name };

                      return (
                        <div
                          key={aIdx}
                          className="p-3.5 rounded-xl bg-slate-950/90 border border-purple-500/30 hover:border-purple-500/60 transition-all space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                                {analysis.verdict_badge || 'تقرير استراتيجي'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.analyzed_at ? formatDateEnglish(item.analyzed_at) : 'محفوظ'}
                              </span>
                            </div>

                            <h5 className="font-bold text-slate-100 text-xs line-clamp-1">{item.campaign_name || campObj.name}</h5>
                            <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                              {analysis.summary_egyptian}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                            <button
                              onClick={() => openCampaignAnalysis(campObj)}
                              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-bold text-indigo-300 hover:text-indigo-200 transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>عرض التقرير المحفوظ 🧠</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {loadingAds ? (
                <div className="py-20 text-center space-y-3">
                  <RotateCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-sm text-slate-300 font-medium">جاري قراءة تفاصيل الحملات والمجموعات والإعلانات...</p>
                </div>
              ) : adsError ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {adsError}
                </div>
              ) : modalTab === 'CAMPAIGNS' ? (
                modalFilteredCampaigns.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm space-y-2">
                    <p>لا توجد حملات مطابقة لهذا الفلتر</p>
                    <button
                      onClick={() => setCampaignDeliveryFilter('ALL')}
                      className="text-xs text-indigo-400 underline font-semibold cursor-pointer"
                    >
                      عرض كافة الحملات ({accountCampaigns.length})
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {modalFilteredCampaigns.map((camp, idx) => {
                      const deliveryInfo = getDeliveryStatusBadge(camp.delivery_status);
                      const DeliveryIcon = deliveryInfo.icon;
                      const m = extractCampaignDetails(camp);
                      const isExpanded = Boolean(expandedCampaigns[camp.id]);
                      const hasSavedAnalysis = Boolean(savedAnalyses[camp.id]);
                      const budget = camp.daily_budget
                        ? `${(parseFloat(camp.daily_budget) / 100).toFixed(0)} ${inspectingAccount.currency}/يومي`
                        : camp.lifetime_budget
                        ? `${(parseFloat(camp.lifetime_budget) / 100).toFixed(0)} ${inspectingAccount.currency}/إجمالي`
                        : 'ميزانية المجموعة';

                      return (
                        <div
                          key={camp.id || idx}
                          className={`p-5 rounded-2xl border transition-all space-y-4 shadow-sm ${
                            camp.delivery_status === 'ACTIVE'
                              ? 'bg-slate-950 border-emerald-500/30 hover:border-emerald-500/50'
                              : camp.delivery_status === 'NOT_DELIVERING'
                              ? 'bg-slate-950/70 border-rose-500/20'
                              : 'bg-slate-950/70 border-slate-800/90'
                          }`}
                        >
                          {/* Campaign Header + Explicit ID + Goal Badge + Expand Button */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${deliveryInfo.bg}`}>
                                <span className={`w-2 h-2 rounded-full ${deliveryInfo.dot}`} />
                                <DeliveryIcon className="w-3.5 h-3.5" />
                                {deliveryInfo.label}
                              </span>

                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${m.categoryColor}`}>
                                {m.categoryBadge}
                              </span>

                              {/* Toggle AdSets & Ads Expansion Tray */}
                              <button
                                onClick={() => toggleCampaignExpansion(camp.id)}
                                title="استعراض المجموعات الإعلانية والبوستات الموجودة جوة الحملة دي"
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                  isExpanded
                                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                                    : 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-300'
                                }`}
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>{m.adsetsCount} {m.adsetsCount === 1 ? 'مجموعة إعلانية (AdSet)' : 'مجموعات إعلانية (AdSets)'}</span>
                                <span className="text-[10px] opacity-75 mr-1">• {m.adsCount} إعلانات</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>

                              <h4 className="font-black text-slate-100 text-sm leading-snug">{camp.name}</h4>
                            </div>

                            {/* Top Right: AI Analysis Button + Explicit Campaign ID + Date */}
                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                              {/* AI Strategic Analysis Buttons */}
                              {hasSavedAnalysis ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    onClick={() => openCampaignAnalysis(camp)}
                                    disabled={analyzingCampId === camp.id}
                                    title="عرض التقرير الاستراتيجي المحفوظ سابقاً"
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white font-black text-xs shadow-md transition-all cursor-pointer font-sans bg-purple-700 hover:bg-purple-600 border border-purple-400/40"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                                    <span>عرض تقرير الذكاء الاصطناعي 🧠</span>
                                  </button>

                                  <button
                                    onClick={() => handleAnalyzeCampaign(camp, true)}
                                    disabled={analyzingCampId === camp.id}
                                    title="إعادة فحص وتحديث الحملة بالذكاء الاصطناعي بناءً على الأرقام الحالية"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-purple-200 hover:text-white font-bold text-xs transition-all cursor-pointer font-sans bg-purple-500/20 hover:bg-purple-600/40 border border-purple-500/40 shadow-sm"
                                  >
                                    <RotateCw className={`w-3.5 h-3.5 ${analyzingCampId === camp.id ? 'animate-spin text-purple-300' : ''}`} />
                                    <span>{analyzingCampId === camp.id ? 'جاري الفحص...' : 'إعادة التحليل بالأرقام الحالية'}</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAnalyzeCampaign(camp, false)}
                                  disabled={analyzingCampId === camp.id}
                                  title="فحص وتحليل استراتيجي للحملة بالذكاء الاصطناعي"
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white font-black text-xs shadow-md transition-all cursor-pointer font-sans bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-purple-600/20"
                                >
                                  <Sparkles className={`w-3.5 h-3.5 ${analyzingCampId === camp.id ? 'animate-spin' : ''}`} />
                                  <span>{analyzingCampId === camp.id ? 'جاري التحليل...' : 'حلل بالذكاء الاصطناعي 🤖'}</span>
                                </button>
                              )}

                              {/* Explicit Campaign ID with Copy Button */}
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
                                <span className="text-slate-500 font-sans">معرف الحملة (ID):</span>
                                <span className="font-bold text-indigo-300">{camp.id}</span>
                                <button
                                  onClick={() => copyToClipboard(camp.id, `camp-id-${camp.id}`)}
                                  title="نسخ معرف الحملة"
                                  className="text-slate-400 hover:text-white p-0.5 mr-1 cursor-pointer"
                                >
                                  {copiedId === `camp-id-${camp.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>

                              <span className="font-sans text-[11px] text-slate-400">
                                الانتهاء: <span className="font-mono text-indigo-300 font-bold">{formatDateEnglish(camp.stop_time)}</span>
                              </span>
                            </div>
                          </div>

                          {/* Dynamic 12 Metrics based on Category (MESSAGES vs SALES vs LEADS) */}
                          {m.category === 'MESSAGES' ? (
                            /* MESSAGES METRICS GRID (Clean & Dynamic) */
                            <div className="space-y-2">
                              {/* Row 1: Financial & Messaging Outcomes */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">1. الميزانية</span>
                                  <span className="font-black text-indigo-300">{budget}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">2. المصروف الحالي</span>
                                  <span className="font-black text-emerald-400">{m.spend} {inspectingAccount.currency}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-950/50 to-slate-900 border border-blue-500/40">
                                  <span className="text-blue-300 block text-[10px] font-bold">3. بدء المحادثات (Messages)</span>
                                  <span className="font-black text-white text-sm">
                                    {m.msgStarted > 0 ? `${Number(m.msgStarted).toLocaleString('en-US')} محادثة` : '0'}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30">
                                  <span className="text-amber-400 block text-[10px] font-bold">4. سعر الرسالة / المحادثة</span>
                                  <span className="font-black text-amber-300">
                                    {m.msgCost ? `${m.msgCost} ${inspectingAccount.currency}` : '---'}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">5. ردود واستجابات العملاء</span>
                                  <span className="font-black text-slate-200">
                                    {m.msgReplies > 0 ? `${m.msgReplies} رد` : '---'}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">6. سعر أول رد</span>
                                  <span className="font-bold text-slate-300">
                                    {m.msgReplyCost !== '---' ? `${m.msgReplyCost} ${inspectingAccount.currency}` : '---'}
                                  </span>
                                </div>
                              </div>

                              {/* Row 2: Traffic, Engagement & Delivery */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">7. اتصالات عميقة (Depth)</span>
                                  <span className="font-bold text-slate-300">
                                    {m.msgConnections > 0 ? `${m.msgConnections} تواصل` : '---'}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">8. معدل النقر (Link CTR)</span>
                                  <span className="font-black text-purple-300">
                                    {m.linkCtr ? `${m.linkCtr}%` : `${m.ctr}%`}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">9. تكلفة النقرة (CPC)</span>
                                  <span className="font-bold text-slate-300">{m.cpc} {inspectingAccount.currency}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">10. الظهور والوصول</span>
                                  <span className="font-bold text-slate-300">{m.impressions}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">11. التكرار (Frequency)</span>
                                  <span className={`font-black ${parseFloat(m.frequency) > 2.5 ? 'text-amber-400' : 'text-slate-300'}`}>
                                    {m.frequency} مرة/فرد
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">12. الألف ظهور (CPM)</span>
                                  <span className="font-bold text-slate-300">{m.cpm} {inspectingAccount.currency}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* SALES & E-COMMERCE METRICS GRID */
                            <div className="space-y-2">
                              {/* Row 1: Purchases, ROAS & Funnel */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">1. الميزانية</span>
                                  <span className="font-black text-indigo-300">{budget}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">2. المصروف الحالي</span>
                                  <span className="font-black text-emerald-400">{m.spend} {inspectingAccount.currency}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-950/50 to-slate-900 border border-emerald-500/40">
                                  <span className="text-emerald-300 block text-[10px] font-bold">3. عمليات الشراء (Purchases)</span>
                                  <span className="font-black text-white text-sm">
                                    {m.purchases > 0 ? `${Number(m.purchases).toLocaleString('en-US')} طلب` : '0'}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30">
                                  <span className="text-amber-400 block text-[10px] font-bold">4. تكلفة الشراء (CPA)</span>
                                  <span className="font-black text-amber-300">
                                    {m.costPerPurchase !== '---' ? `${m.costPerPurchase} ${inspectingAccount.currency}` : '---'}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">5. العائد على الإنفاق (ROAS)</span>
                                  <span className="font-black text-emerald-400">
                                    {m.roas ? `${m.roas}X` : m.purchaseValue ? `${m.purchaseValue} ج.م` : '---'}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">6. إضافة للسلة (Cart)</span>
                                  <span className="font-black text-slate-200">
                                    {m.addToCart > 0 ? `${m.addToCart} (${m.costPerAddToCart} ج.م)` : '---'}
                                  </span>
                                </div>
                              </div>

                              {/* Row 2: Checkout, CTR, CPC, Frequency */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">7. بدء الدفع (Checkout)</span>
                                  <span className="font-bold text-slate-300">
                                    {m.initiateCheckout > 0 ? `${m.initiateCheckout} (${m.costPerCheckout} ج.م)` : '---'}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">8. معدل النقر (Link CTR)</span>
                                  <span className="font-black text-purple-300">
                                    {m.linkCtr ? `${m.linkCtr}%` : `${m.ctr}%`}
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">9. تكلفة النقرة (CPC)</span>
                                  <span className="font-bold text-slate-300">{m.cpc} {inspectingAccount.currency}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">10. الظهور والوصول</span>
                                  <span className="font-bold text-slate-300">{m.impressions}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">11. التكرار (Frequency)</span>
                                  <span className={`font-black ${parseFloat(m.frequency) > 2.5 ? 'text-amber-400' : 'text-slate-300'}`}>
                                    {m.frequency} مرة/فرد
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">12. الألف ظهور (CPM)</span>
                                  <span className="font-bold text-slate-300">{m.cpm} {inspectingAccount.currency}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* INLINE EXPANDABLE TRAY: All AdSets & All Ads/Posts Inside this Campaign */}
                          {isExpanded && (
                            <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-4 pt-3 mt-2 shadow-inner">
                              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-purple-400" />
                                  <h5 className="font-bold text-white text-xs">
                                    محتويات الحملة ({m.adsetsList.length} مجموعات إعلانية • {m.adsList.length} إعلانات وبوستات)
                                  </h5>
                                </div>
                                <span className="text-[11px] text-slate-400">تقدر تستعرض البوستات مباشرة وتنسخ روابطها ومعرفاتها</span>
                              </div>

                              {/* 1. AdSets List */}
                              {m.adsetsList.length > 0 && (
                                <div className="space-y-2">
                                  <span className="text-[11px] font-bold text-purple-300 block">المجموعات الإعلانية (AdSets):</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {m.adsetsList.map((adset: any, aIdx: number) => (
                                      <div key={adset.id || aIdx} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                                        <div className="space-y-0.5 truncate">
                                          <p className="font-bold text-slate-200 truncate">{adset.name}</p>
                                          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                                            <span>معرف المجموعة (ID): {adset.id}</span>
                                            <button
                                              onClick={() => copyToClipboard(adset.id, `adset-id-${adset.id}`)}
                                              title="نسخ معرف المجموعة"
                                              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                                            >
                                              {copiedId === `adset-id-${adset.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                          </div>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-bold shrink-0">
                                          {adset.optimization_goal || 'CONVERSATIONS'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 2. Ads / Creatives / Posts List inside this Campaign */}
                              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                                <span className="text-[11px] font-bold text-indigo-300 block">الإعلانات والبوستات (Ads & Posts):</span>
                                {m.adsList.length === 0 ? (
                                  <p className="text-xs text-slate-500 py-2">لا توجد إعلانات مرتبطة مباشرة داخل هذه الحملة</p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {m.adsList.map((ad: any) => {
                                      const creative = ad.creative || {};
                                      const thumb = creative.thumbnail_url || creative.image_url;
                                      const adPostUrl = getPostUrl(creative);
                                      const isAdActive = ad.effective_status === 'ACTIVE';

                                      return (
                                        <div
                                          key={ad.id}
                                          className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                                            isAdActive
                                              ? 'bg-slate-900 border-emerald-500/30'
                                              : 'bg-slate-900/60 border-slate-800'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                              isAdActive ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                                            }`}>
                                              {isAdActive ? '🟢 إعلان نشط' : ad.effective_status || ad.status}
                                            </span>

                                            {/* Explicit Ad ID + Copy */}
                                            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                                              <span>معرف الإعلان (ID): <strong className="text-indigo-300">{ad.id}</strong></span>
                                              <button
                                                onClick={() => copyToClipboard(ad.id, `ad-inline-id-${ad.id}`)}
                                                title="نسخ معرف الإعلان"
                                                className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                                              >
                                                {copiedId === `ad-inline-id-${ad.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                              </button>
                                            </div>
                                          </div>

                                          {/* Creative Image + Copy Preview */}
                                          <div className="flex gap-2.5">
                                            {thumb ? (
                                              <div
                                                onClick={() => setPreviewImage(thumb)}
                                                className="relative group cursor-pointer w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-700"
                                              >
                                                <img src={thumb} alt="Ad Creative" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold">
                                                  تكبير
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                                                <ImageIcon className="w-6 h-6" />
                                              </div>
                                            )}

                                            <div className="flex-1 space-y-1 overflow-hidden">
                                              <h6 className="text-xs font-bold text-slate-200 truncate">{ad.name}</h6>
                                              <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                                                {creative.body || creative.title || 'بدون نص إعلاني'}
                                              </p>
                                            </div>
                                          </div>

                                          {/* Post Links + Copy Link */}
                                          {adPostUrl && (
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                                              <a
                                                href={adPostUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold"
                                              >
                                                <span>عرض المنشور على فيسبوك</span>
                                                <ExternalLink className="w-3 h-3" />
                                              </a>

                                              <button
                                                onClick={() => copyToClipboard(adPostUrl, `ad-post-link-${ad.id}`)}
                                                className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                                              >
                                                {copiedId === `ad-post-link-${ad.id}` ? (
                                                  <>
                                                    <Check className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-emerald-400 font-sans">تم النسخ</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="w-3 h-3" />
                                                    <span className="font-sans">نسخ الرابط</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* Ads Tab (Filtered by Delivery Status) */
                modalFilteredAds.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm space-y-2">
                    <p>لا توجد إعلانات مطابقة لهذا الفلتر</p>
                    <button
                      onClick={() => setAdDeliveryFilter('ALL')}
                      className="text-xs text-indigo-400 underline font-semibold cursor-pointer"
                    >
                      عرض كافة الإعلانات ({accountAds.length})
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {modalFilteredAds.map((ad) => {
                      const isAdActive = ad.effective_status === 'ACTIVE';
                      const creative = ad.creative || {};
                      const thumb = creative.thumbnail_url || creative.image_url;
                      const insight = ad.insights?.data?.[0];
                      const postUrl = getPostUrl(creative);

                      return (
                        <div
                          key={ad.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 shadow-sm flex flex-col justify-between ${
                            isAdActive
                              ? 'bg-slate-950 border-emerald-500/30 hover:border-emerald-500/60'
                              : 'bg-slate-950/70 border-slate-800/90'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                isAdActive
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}>
                                {isAdActive ? '🟢 إعلان نشط وقيد العرض' : ad.effective_status || ad.status}
                              </span>

                              {/* Explicit Ad ID + Copy */}
                              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                                <span>معرف الإعلان (ID): <strong className="text-indigo-300">{ad.id}</strong></span>
                                <button
                                  onClick={() => copyToClipboard(ad.id, `ad-full-id-${ad.id}`)}
                                  title="نسخ معرف الإعلان"
                                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                                >
                                  {copiedId === `ad-full-id-${ad.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>

                            {/* Creative Image + Copy */}
                            <div className="flex gap-3">
                              {thumb ? (
                                <div
                                  onClick={() => setPreviewImage(thumb)}
                                  className="relative group cursor-pointer w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-800"
                                >
                                  <img
                                    src={thumb}
                                    alt="Creative"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold gap-1">
                                    <Maximize2 className="w-3 h-3" />
                                    <span>تكبير</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-20 h-20 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                                  <ImageIcon className="w-6 h-6" />
                                </div>
                              )}
                              <div className="flex-1 space-y-1">
                                <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{ad.name}</h4>
                                <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                                  {creative.body || creative.title || 'بدون نص إعلاني'}
                                </p>
                              </div>
                            </div>

                            {/* Direct Post Link */}
                            {postUrl && (
                              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                                <a
                                  href={postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold"
                                >
                                  <span>عرض المنشور على فيسبوك</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>

                                <button
                                  onClick={() => copyToClipboard(postUrl, `ad-post-link2-${ad.id}`)}
                                  className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                                >
                                  {copiedId === `ad-post-link2-${ad.id}` ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400 font-sans">تم النسخ</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span className="font-sans">نسخ الرابط</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Live Performance Numbers */}
                          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/60 text-[11px] text-center font-bold">
                            <div className="p-1.5 rounded-lg bg-slate-900/90 text-emerald-400">
                              <span className="text-[9px] text-slate-500 block font-normal">المصروف</span>
                              {insight?.spend ? Math.round(parseFloat(insight.spend)).toLocaleString('en-US') : '0'} {inspectingAccount.currency}
                            </div>
                            <div className="p-1.5 rounded-lg bg-slate-900/90 text-amber-300">
                              <span className="text-[9px] text-slate-500 block font-normal">الظهور</span>
                              {insight?.impressions ? Number(insight.impressions).toLocaleString('en-US') : '0'}
                            </div>
                            <div className="p-1.5 rounded-lg bg-slate-900/90 text-purple-300">
                              <span className="text-[9px] text-slate-500 block font-normal">CTR</span>
                              {insight?.ctr ? `${parseFloat(insight.ctr).toFixed(1)}%` : '---'}
                            </div>
                            <div className="p-1.5 rounded-lg bg-slate-900/90 text-blue-300">
                              <span className="text-[9px] text-slate-500 block font-normal">الوصول</span>
                              {insight?.reach ? Number(insight.reach).toLocaleString('en-US') : '0'}
                            </div>
                          </div>

                          {/* Quick Campaign Analysis Link for this Ad */}
                          <button
                            onClick={() => {
                              const parentCamp = accountCampaigns.find(c => c.id === ad.campaign_id) || { id: ad.campaign_id, name: 'الحملة التابع لها الإعلان' };
                              openCampaignAnalysis(parentCamp);
                            }}
                            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>عرض تقرير وتحليل الحملة بالذكاء الاصطناعي 🧠</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Strategic Campaign Analysis Modal */}
      {activeAnalysisModal && (() => {
        const camp = activeAnalysisModal.campaign;
        const analysis = activeAnalysisModal.analysis || {};
        const currency = inspectingAccount?.currency || 'EGP';
        const insights = camp?.insights?.data?.[0] || {};

        // Extract bottlenecks as list
        const bottlenecksList: string[] = Array.isArray(analysis.bottlenecks)
          ? analysis.bottlenecks
          : typeof analysis.bottleneck === 'string'
          ? analysis.bottleneck.split('\n').map((s: string) => s.trim()).filter(Boolean)
          : [];

        // Extract scaling advice as list
        const scalingAdviceList: string[] = Array.isArray(analysis.scaling_advice_points)
          ? analysis.scaling_advice_points
          : typeof analysis.scaling_advice === 'string'
          ? analysis.scaling_advice.split('\n').map((s: string) => s.trim()).filter(Boolean)
          : [];

        const actionSteps: string[] = Array.isArray(analysis.action_steps) ? analysis.action_steps : [];
        const adsets: any[] = Array.isArray(analysis.adsets_analysis) ? analysis.adsets_analysis : [];
        const stopRunMatrix: any = analysis.actionable_stop_and_run_matrix || {};
        const adsToStop: any[] = Array.isArray(stopRunMatrix.ads_to_stop_immediately) ? stopRunMatrix.ads_to_stop_immediately : [];
        const adsToScale: any[] = Array.isArray(stopRunMatrix.ads_to_scale_and_boost) ? stopRunMatrix.ads_to_scale_and_boost : [];
        const budgetPlan: string = stopRunMatrix.budget_reallocation_plan || '';
        const creatives: any[] = Array.isArray(analysis.creatives_analysis) ? analysis.creatives_analysis : [];
        const copies: any[] = Array.isArray(analysis.copywriting_analysis) ? analysis.copywriting_analysis : [];
        const targeting: any = analysis.targeting_audit || {};
        const appliedTargeting = targeting.applied_targeting_summary || {};

        return (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-indigo-950 via-slate-950 to-purple-950">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                    <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-white text-lg sm:text-xl">تقرير الفحص والتحليل الاستراتيجي الشامل</h3>
                      <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                        Gemini 3.8 Flash
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-300 truncate max-w-lg mt-1">{camp.name}</p>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadPDF(camp, analysis)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    title="تحميل وطباعة التقرير بصيغة PDF منسق بالعربية"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>تحميل التقرير PDF 📥</span>
                  </button>

                  <button
                    onClick={() => handleAnalyzeCampaign(camp, true)}
                    disabled={analyzingCampId === camp.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                    title="إعادة فحص الحملة بالأرقام الحالية عبر الذكاء الاصطناعي"
                  >
                    <RotateCw className={`w-4 h-4 ${analyzingCampId === camp.id ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">إعادة التحليل</span>
                  </button>

                  <button
                    onClick={() => setActiveAnalysisModal(null)}
                    className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-lg cursor-pointer transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Navigation Tabs Bar for Easy Section Filtering */}
              <div className="px-4 sm:px-6 py-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
                {[
                  { id: 'ALL', label: '📄 التقرير بالكامل (شامل)' },
                  { id: 'METRICS', label: '📊 1. الأداء والنتائج' },
                  { id: 'ADSETS', label: `⚡ 2. المجموعات والقرارات (${adsets.length})` },
                  { id: 'CREATIVES', label: `🎬 3. الكريتيف والفيديوهات (${creatives.length})` },
                  { id: 'COPYWRITING', label: `✍️ 4. المحتوى والكوبي (${copies.length})` },
                  { id: 'TARGETING', label: '🎯 5. تدقيق الاستهداف' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAnalysisModalTab(tab.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      analysisModalTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-6 text-slate-200">
                
                {/* SECTION 1: PERFORMANCE & METRICS */}
                {(analysisModalTab === 'ALL' || analysisModalTab === 'METRICS') && (
                  <div className="space-y-5">
                    {/* Section Header */}
                    <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black">
                        1
                      </div>
                      <h4 className="text-lg sm:text-xl font-black text-white">
                        الجزء الأول: تقييم الأداء الرقمي والنتائج (Performance & Metrics)
                      </h4>
                    </div>

                    {/* Verdict Banner & Score (30% Bigger Text) */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-950 to-purple-950/40 border border-indigo-500/40 space-y-3 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-300">الحكم الاستراتيجي والتقييم:</span>
                          <span className="text-sm sm:text-base font-black px-4 py-1.5 rounded-full bg-indigo-600 text-white shadow-md">
                            {analysis.verdict_badge || 'تحليل الأداء'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-indigo-500/30">
                          <span className="text-xs text-slate-400 font-bold">التقييم الشامل:</span>
                          <span className="text-xl sm:text-2xl font-black text-amber-400">{analysis.score || '8.5'}</span>
                          <span className="text-xs text-slate-500">/ 10</span>
                        </div>
                      </div>

                      {/* Egyptian Summary (Enlarged by 30%) */}
                      <p className="text-base sm:text-lg font-semibold text-slate-100 leading-relaxed pt-2">
                        {analysis.summary_egyptian}
                      </p>
                    </div>

                    {/* Bottlenecks (عنق الزجاجة ونقاط التسريب) - Clear Bullet Points */}
                    {bottlenecksList.length > 0 && (
                      <div className="p-5 sm:p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                        <div className="flex items-center gap-2 text-sm sm:text-base font-black text-amber-300">
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                          <span>عنق الزجاجة ونقاط التسريب (Bottlenecks):</span>
                        </div>
                        <div className="space-y-2.5">
                          {bottlenecksList.map((point: string, pIdx: number) => (
                            <div
                              key={pIdx}
                              className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/20 text-amber-100 text-sm sm:text-base leading-relaxed"
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-2 shrink-0 shadow-sm shadow-amber-400/50" />
                              <span className="font-medium">{point}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scaling Advice (توصيات زيادة الميزانية والتكبير) - Clear Bullet Points */}
                    {scalingAdviceList.length > 0 && (
                      <div className="p-5 sm:p-6 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-3">
                        <div className="flex items-center gap-2 text-sm sm:text-base font-black text-purple-300">
                          <TrendingUp className="w-5 h-5 text-purple-400" />
                          <span>توصيات زيادة الميزانية والتكبير (Scaling Advice):</span>
                        </div>
                        <div className="space-y-2.5">
                          {scalingAdviceList.map((point: string, pIdx: number) => (
                            <div
                              key={pIdx}
                              className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-purple-500/20 text-purple-100 text-sm sm:text-base leading-relaxed"
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 mt-2 shrink-0 shadow-sm shadow-purple-400/50" />
                              <span className="font-medium">{point}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Steps (خطة العمل والتنفيذ الفوري 1، 2، 3) */}
                    {actionSteps.length > 0 && (
                      <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center gap-2 text-sm sm:text-base font-black text-emerald-400">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span>خطة العمل والتنفيذ الفوري (نعمل إيه بالظبط الآن):</span>
                        </div>
                        <div className="space-y-2.5">
                          {actionSteps.map((step: string, sIdx: number) => (
                            <div
                              key={sIdx}
                              className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 text-sm sm:text-base leading-relaxed"
                            >
                              <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                                {sIdx + 1}
                              </span>
                              <span className="font-medium">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metrics Evaluation Grid (30% Larger Font) */}
                    {analysis.metrics_evaluation && typeof analysis.metrics_evaluation === 'object' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                        {Object.entries(analysis.metrics_evaluation).map(([key, val]: any, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                            <span className="text-xs text-indigo-400 block font-bold">
                              {key === 'cpa_and_results' ? '🎯 سعر النتيجة والتحويلات' :
                               key === 'roas_and_profit' ? '💰 العائد على الصرف والربحية' :
                               key === 'ctr_and_interest' ? '⚡ معدل النقر وجودة الترافيك' : '🔄 التكرار والتشبع الإعلاني'}
                            </span>
                            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
                              {typeof val === 'string' ? val : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 2: ADSETS & STOP/SCALE MATRIX */}
                {(analysisModalTab === 'ALL' || analysisModalTab === 'ADSETS') && (
                  <div className="space-y-6 pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                          2
                        </div>
                        <h4 className="text-lg sm:text-xl font-black text-white">
                          الجزء الثاني: تحليل المجموعات الإعلانية ومصفوفة الإيقاف والتشغيل (AdSets & Action Matrix)
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-bold hidden sm:inline">
                        مقارنة الـ A/B Testing وقرارات فورية لكل إعلان
                      </span>
                    </div>

                    {/* STOP & RUN ACTION MATRIX BANNER */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* ADS TO STOP IMMEDIATELY */}
                      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-red-950/40 via-slate-950 to-red-950/20 border border-red-500/40 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
                          <div className="flex items-center gap-2 text-red-400 font-black text-base sm:text-lg">
                            <XCircle className="w-5 h-5 text-red-400" />
                            <span>🛑 إعلانات يجب إيقافها فوراً (لتوفير الميزانية)</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-xs">
                            {adsToStop.length} إعلان
                          </span>
                        </div>

                        {adsToStop.length === 0 ? (
                          <p className="text-xs sm:text-sm text-slate-400">لا توجد إعلانات تحرق الميزانية حالياً بشكل حرج.</p>
                        ) : (
                          <div className="space-y-3">
                            {adsToStop.map((ad: any, sIdx: number) => (
                              <div key={sIdx} className="p-3.5 rounded-xl bg-slate-900/90 border border-red-500/30 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h6 className="text-white font-bold text-sm line-clamp-1">{ad.ad_name || `إعلان #${ad.ad_id}`}</h6>
                                    <span className="text-[11px] text-slate-400 font-mono">معرف: {ad.ad_id} {ad.adset_name ? `• ${ad.adset_name}` : ''}</span>
                                  </div>
                                  <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold text-xs shrink-0">
                                    صرف: {ad.wasted_spend || ad.spend || 'غير محدد'}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm text-red-200 leading-relaxed bg-red-950/40 p-2 rounded-lg border border-red-500/20">
                                  ⚠️ <span className="font-semibold">{ad.reason || 'إعلان منخفض الأداء يحرق الميزانية بدون نتائج كافية.'}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ADS TO SCALE & BOOST */}
                      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-950 to-emerald-950/20 border border-emerald-500/40 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                          <div className="flex items-center gap-2 text-emerald-400 font-black text-base sm:text-lg">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                            <span>🚀 إعلانات رابحة يجب تكبيرها (Scale & Boost)</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs">
                            {adsToScale.length} إعلان
                          </span>
                        </div>

                        {adsToScale.length === 0 ? (
                          <p className="text-xs sm:text-sm text-slate-400">لم يتم رصد إعلانات متصدرة بشكل استثنائي بعد.</p>
                        ) : (
                          <div className="space-y-3">
                            {adsToScale.map((ad: any, wIdx: number) => (
                              <div key={wIdx} className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h6 className="text-white font-bold text-sm line-clamp-1">{ad.ad_name || `إعلان #${ad.ad_id}`}</h6>
                                    <span className="text-[11px] text-slate-400 font-mono">معرف: {ad.ad_id} {ad.adset_name ? `• ${ad.adset_name}` : ''}</span>
                                  </div>
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs shrink-0">
                                    نتائج: {ad.conversations || ad.purchases || 'متصدر'}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm text-emerald-200 leading-relaxed bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/20">
                                  🌟 <span className="font-semibold">{ad.scale_action || ad.reason || 'إعلان رابح بأقل سعر محادثة، يجب تركيز الميزانية عليه.'}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BUDGET REALLOCATION PLAN */}
                    {budgetPlan && (
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-950 to-indigo-950/40 border border-blue-500/30 flex items-start gap-3">
                        <Zap className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
                        <div className="space-y-1">
                          <span className="text-sm font-black text-blue-300 block">💡 خطة إعادة توزيع وضخ الميزانية:</span>
                          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">{budgetPlan}</p>
                        </div>
                      </div>
                    )}

                    {/* ADSETS DETAILED COMPARISON CARDS */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                          <Layers className="w-5 h-5 text-amber-400" />
                          <span>تفاصيل ومقارنة المجموعات الإعلانية ({adsets.length})</span>
                        </h5>
                        <span className="text-xs text-slate-400 font-bold">مقارنة معدل الصرف والنتائج وتكلفة التحويل</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {adsets.map((aset: any, aIdx: number) => {
                          const isScale = aset.decision === 'SCALE';
                          const isStop = aset.decision === 'STOP';
                          return (
                            <div
                              key={aIdx}
                              className={`p-5 rounded-2xl bg-slate-950 border transition-all space-y-4 shadow-lg flex flex-col justify-between ${
                                isScale
                                  ? 'border-emerald-500/50 shadow-emerald-950/30'
                                  : isStop
                                  ? 'border-red-500/40 shadow-red-950/20'
                                  : 'border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="space-y-3">
                                {/* Header */}
                                <div className="space-y-1 border-b border-slate-800 pb-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                                      مجموعة #{aIdx + 1}
                                    </span>
                                    <span className={`text-xs px-3 py-1 rounded-full font-black border ${
                                      isScale
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : isStop
                                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                    }`}>
                                      {aset.decision_badge || (isScale ? '🚀 تكبير' : isStop ? '🛑 إيقاف' : '✅ استمرار')}
                                    </span>
                                  </div>
                                  <h6 className="text-white font-black text-base line-clamp-2 mt-1">{aset.name}</h6>
                                  <span className="text-[11px] text-amber-300 font-semibold block">{aset.targeting_type_label || 'استهداف جمهور'}</span>
                                </div>

                                {/* Numbers Bar */}
                                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-center">
                                  <div>
                                    <span className="text-[10px] text-slate-400 block font-medium">المصروف</span>
                                    <span className="font-black text-slate-100 text-xs sm:text-sm">{aset.spend || '0 EGP'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-emerald-400 block font-bold">المحادثات</span>
                                    <span className="font-black text-emerald-400 text-sm sm:text-base">{aset.conversations || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-indigo-400 block font-medium">سعر المحادثة</span>
                                    <span className="font-black text-indigo-300 text-xs sm:text-sm">{aset.cpa || 'غير مسجل'}</span>
                                  </div>
                                </div>

                                {/* Targeting Verdict */}
                                {aset.targeting_verdict && (
                                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                                    <span className="font-bold text-amber-400 block mb-0.5">🎯 تقييم الجمهور:</span>
                                    <p className="font-medium">{aset.targeting_verdict}</p>
                                  </div>
                                )}

                                {/* Decision Reason */}
                                {aset.decision_reason && (
                                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs leading-relaxed">
                                    <span className="font-bold text-indigo-400 block mb-0.5">⚖️ حيثيات القرار:</span>
                                    <p className="text-slate-300 font-medium">{aset.decision_reason}</p>
                                  </div>
                                )}
                              </div>

                              {/* Age & Location badge */}
                              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                                <span>العمر: {aset.age_range || '25-55'}</span>
                                <span>الوصول: {Number(aset.reach || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 3: CREATIVES & VISUALS ANALYSIS */}
                {(analysisModalTab === 'ALL' || analysisModalTab === 'CREATIVES') && (
                  <div className="space-y-5 pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                          3
                        </div>
                        <h4 className="text-lg sm:text-xl font-black text-white">
                          الجزء الثالث: فحص وتحليل الكريتيف والتصميمات والفيديوهات ({creatives.length})
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-bold">
                        فحص كل فيديو وتصميم ورابطه المباشر
                      </span>
                    </div>

                    {creatives.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                        <Film className="w-8 h-8 text-purple-400 mx-auto opacity-60" />
                        <p className="text-sm text-slate-400">
                          لم يتم استخراج تفاصيل الكريتيف لهذا التقرير بعد. اضغط على "إعادة التحليل" بالأعلى لتشغيل الفحص التراكمي الشامل لكافة الفيديوهات والتصميمات.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {creatives.map((cr: any, cIdx: number) => {
                          const rawAd = (camp?.ads?.data || camp?.ads || []).find((a: any) => a.id === cr.ad_id) || {};
                          const isVideo = Boolean(cr.is_video ?? (cr.video_id || rawAd.creative?.video_id || rawAd.creative?.object_story_spec?.video_data?.video_id));
                          const videoId = cr.video_id || rawAd.creative?.video_id || rawAd.creative?.object_story_spec?.video_data?.video_id;
                          const videoSource = cr.video_source || rawAd.creative?.video_source || null;
                          const embedUrl = cr.video_embed_url || (videoId ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(`https://www.facebook.com/reel/${videoId}/`)}&show_text=false&t=0` : '');
                          const postUrl = cr.post_url || (videoId ? `https://www.facebook.com/reel/${videoId}/` : '');
                          const rawImages: string[] = (Array.isArray(cr.images) && cr.images.length > 0)
                            ? cr.images
                            : (Array.isArray(rawAd.creative?.images) && rawAd.creative.images.length > 0)
                            ? rawAd.creative.images
                            : cr.thumbnail_url ? [cr.thumbnail_url] : rawAd.creative?.thumbnail_url ? [rawAd.creative.thumbnail_url] : [];
                          const thumbUrl = rawImages[0] || cr.thumbnail_url || rawAd.creative?.image_url || rawAd.creative?.thumbnail_url || '';
                          const mediaLabel = cr.media_type_label || (isVideo ? '🎬 فيديو ريلز إعلاني (14 ثانية)' : rawImages.length > 1 ? `🖼️ ألبوم صور (${rawImages.length} صور)` : '🖼️ منشور صور للمنتج');

                          return (
                            <div
                              key={cIdx}
                              className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-purple-500/30 hover:border-purple-500/60 transition-all space-y-4 shadow-xl flex flex-col justify-between"
                            >
                              <div className="space-y-4">
                                {/* Creative Header */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-black text-white text-base sm:text-lg line-clamp-1">{cr.ad_name || `إعلان #${cIdx + 1}`}</h5>
                                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${isVideo ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'}`}>
                                        {mediaLabel}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      <span className="text-xs text-slate-400 font-mono">معرف: {cr.ad_id}</span>
                                      {cr.adset_name && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800/80 text-amber-300 font-bold border border-slate-700">
                                          {cr.adset_name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {cr.decision_badge && (
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${
                                        cr.decision === 'STOP'
                                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                          : cr.decision === 'SCALE'
                                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                      }`}>
                                        {cr.decision_badge}
                                      </span>
                                    )}
                                    <span className="px-3.5 py-1.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs sm:text-sm font-black shadow-sm">
                                      {cr.creative_score || '8'}/10 ⭐
                                    </span>
                                  </div>
                                </div>

                                {/* Media Player / Viewer (Native Centered Video or High-Res Image Gallery) */}
                                {isVideo ? (
                                  <div className="space-y-2.5">
                                    <div className="relative w-full rounded-2xl overflow-hidden bg-black/95 border border-purple-500/40 shadow-xl flex items-center justify-center min-h-[350px] max-h-[480px]">
                                      {videoSource ? (
                                        <video
                                          src={videoSource}
                                          controls
                                          playsInline
                                          preload="metadata"
                                          className="w-full max-h-[460px] object-contain mx-auto rounded-2xl"
                                        />
                                      ) : embedUrl ? (
                                        <iframe
                                          src={embedUrl}
                                          className="w-full h-[420px] rounded-2xl border-none"
                                          style={{ border: 'none', overflow: 'hidden' }}
                                          scrolling="no"
                                          allowFullScreen={true}
                                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                                        />
                                      ) : (
                                        <div className="p-6 text-center text-slate-400">
                                          <Film className="w-10 h-10 mx-auto text-purple-400 mb-2" />
                                          <span className="text-sm font-bold text-slate-300">فيديو ريلز إعلاني</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Direct Video Download Button */}
                                    {videoSource && (
                                      <a
                                        href={`/api/media/download?url=${encodeURIComponent(videoSource)}&filename=${encodeURIComponent((cr.ad_name || 'creative_video') + '.mp4')}`}
                                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md"
                                        download
                                      >
                                        <FileDown className="w-4 h-4 text-purple-300" />
                                        <span>تحميل الفيديو مباشرة (MP4) 📥</span>
                                      </a>
                                    )}

                                    {cr.video_watch_stats && cr.video_watch_stats !== 'إعلان صور (لا ينطبق)' && (
                                      <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs font-semibold text-purple-200">
                                        ⏱️ <span className="font-bold">إحصائيات المشاهدة:</span> {cr.video_watch_stats}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {thumbUrl && (
                                      <div
                                        onClick={() => setGalleryModal({ images: rawImages, activeIndex: 0, title: cr.ad_name || 'creative_photos' })}
                                        className="relative group cursor-pointer w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/90 flex items-center justify-center shadow-lg p-2"
                                      >
                                        <img
                                          src={thumbUrl}
                                          alt="Creative"
                                          className="max-w-full max-h-full object-contain mx-auto group-hover:scale-105 transition-transform duration-300"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs sm:text-sm font-bold gap-2">
                                          <Maximize2 className="w-5 h-5 text-indigo-400" />
                                          <span>انقر لتكبير وتصفح الصور بدقة كاملة 🔍</span>
                                        </div>
                                        {rawImages.length > 1 && (
                                          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 shadow-md">
                                            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>{rawImages.length} صور في الألبوم</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Thumbnails strip for multiple photos */}
                                    {rawImages.length > 1 && (
                                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                                        {rawImages.map((imgUrl: string, imgIdx: number) => (
                                          <div
                                            key={imgIdx}
                                            onClick={() => setGalleryModal({ images: rawImages, activeIndex: imgIdx, title: cr.ad_name || 'creative_photos' })}
                                            className="w-14 h-14 rounded-xl overflow-hidden border border-slate-800 hover:border-indigo-500 cursor-pointer shrink-0 bg-slate-900 p-0.5 transition-all shadow-sm"
                                          >
                                            <img src={imgUrl} alt={`Thumb ${imgIdx}`} className="w-full h-full object-contain" />
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Download Buttons Bar */}
                                    <div className="flex items-center gap-2">
                                      {rawImages.length > 1 ? (
                                        <button
                                          onClick={() => handleDownloadAllImages(rawImages, cr.ad_name || 'creative_photos')}
                                          disabled={downloadingZip}
                                          className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md"
                                        >
                                          <FileDown className="w-4 h-4 text-emerald-400" />
                                          <span>{downloadingZip ? 'جاري تجهيز وتحزيم الملف...' : `تحميل كل الصور دفعة واحدة (${rawImages.length} صور Zip) 📥`}</span>
                                        </button>
                                      ) : thumbUrl ? (
                                        <a
                                          href={`/api/media/download?url=${encodeURIComponent(thumbUrl)}&filename=${encodeURIComponent((cr.ad_name || 'creative_photo') + '.jpg')}`}
                                          className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md"
                                          download
                                        >
                                          <FileDown className="w-4 h-4 text-indigo-300" />
                                          <span>تحميل الصورة بدقة عالية 📥</span>
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                )}

                                {/* Live Ad Stats Bar */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
                                  <div className="space-y-0.5">
                                    <span className="text-[11px] text-slate-400 block font-medium">المصروف:</span>
                                    <span className="font-black text-slate-100">{cr.spend || '0 EGP'}</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="text-[11px] text-emerald-400 block font-bold">
                                      {cr.conversations !== undefined ? 'المحادثات (واتساب):' : 'النتائج (Purchases):'}
                                    </span>
                                    <span className="font-black text-emerald-400 text-sm">
                                      {cr.conversations !== undefined ? cr.conversations : (cr.purchases ?? '0')}
                                    </span>
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="text-[11px] text-indigo-400 block font-medium">سعر النتيجة (CPA):</span>
                                    <span className="font-black text-indigo-300">{cr.cpa || 'غير مسجل'}</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="text-[11px] text-amber-400 block font-medium">معدل النقر (CTR):</span>
                                    <span className="font-black text-amber-300">{cr.ctr || '0%'}</span>
                                  </div>
                                </div>

                                {/* Immediate Decision Note */}
                                {cr.decision_reason && (
                                  <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                                    cr.decision === 'STOP'
                                      ? 'bg-red-950/40 border-red-500/40 text-red-200'
                                      : cr.decision === 'SCALE'
                                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                                      : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-200'
                                  }`}>
                                    <span className="font-bold">⚡ {cr.decision_badge || 'القرار'}: </span>
                                    <span className="font-medium">{cr.decision_reason}</span>
                                  </div>
                                )}

                                {/* Direct Post / Video Link */}
                                {postUrl && (
                                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                                    <a
                                      href={postUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-bold"
                                    >
                                      <Film className="w-4 h-4" />
                                      <span>مشاهدة الفيديو / المنشور على فيسبوك</span>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    <button
                                      onClick={() => copyToClipboard(postUrl, `cr-link-${cr.ad_id || cIdx}`)}
                                      className="text-slate-400 hover:text-white cursor-pointer"
                                    >
                                      {copiedId === `cr-link-${cr.ad_id || cIdx}` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                )}

                                {/* Conversion Reality Verdict */}
                                {cr.conversion_reality_verdict && (
                                  <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/40 space-y-1.5 shadow-sm">
                                    <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                                      ⚖️ حقيقة المبيعات وتفسير الفارق التسويقي:
                                    </span>
                                    <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed font-semibold">
                                      {cr.conversion_reality_verdict}
                                    </p>
                                  </div>
                                )}

                                {/* Visual Hook Analysis */}
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-amber-400 block">
                                    🎬 الهوك البصري (أول 3 ثوانٍ / حركة المشهد وجاذبية العرض):
                                  </span>
                                  <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
                                    {cr.visual_hook_analysis || 'لا توجد ملاحظات'}
                                  </p>
                                </div>

                                {/* Product & Offer Clarity */}
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-teal-400 block">
                                    🛍️ وضوح المنتج والعرض التسويقي:
                                  </span>
                                  <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
                                    {cr.product_offer_clarity || 'لا توجد ملاحظات'}
                                  </p>
                                </div>

                                {/* Strengths */}
                                {Array.isArray(cr.strengths) && cr.strengths.length > 0 && (
                                  <div className="space-y-1 pt-1">
                                    <span className="text-xs font-bold text-emerald-400 block">✅ نقاط القوة:</span>
                                    <ul className="space-y-1 text-xs sm:text-sm text-slate-300 pr-2">
                                      {cr.strengths.map((st: string, sIdx: number) => (
                                        <li key={sIdx} className="flex items-start gap-1.5">
                                          <span className="text-emerald-400 font-bold">•</span>
                                          <span>{st}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Weaknesses */}
                                {Array.isArray(cr.weaknesses) && cr.weaknesses.length > 0 && (
                                  <div className="space-y-1 pt-1">
                                    <span className="text-xs font-bold text-amber-400 block">⚠️ نقاط التحسين والضعف:</span>
                                    <ul className="space-y-1 text-xs sm:text-sm text-slate-300 pr-2">
                                      {cr.weaknesses.map((wk: string, wIdx: number) => (
                                        <li key={wIdx} className="flex items-start gap-1.5">
                                          <span className="text-amber-400 font-bold">•</span>
                                          <span>{wk}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 4: COPYWRITING & AD COPY ANALYSIS */}
                {(analysisModalTab === 'ALL' || analysisModalTab === 'COPYWRITING') && (
                  <div className="space-y-5 pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black">
                          4
                        </div>
                        <h4 className="text-lg sm:text-xl font-black text-white">
                          الجزء الرابع: فحص وتحليل المحتوى الإعلاني والكتابة التسويقية ({copies.length})
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-bold">
                        تحليل الهوك والمتن مع نصوص مقترحة للـ A/B Testing
                      </span>
                    </div>

                    {copies.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                        <PenTool className="w-8 h-8 text-teal-400 mx-auto opacity-60" />
                        <p className="text-sm text-slate-400">
                          لم يتم استخراج تحليل الكوبي لهذا التقرير بعد. اضغط على "إعادة التحليل" بالأعلى لتوليد فحص الكوبي ونصوص الـ A/B Testing الجاهزة.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {copies.map((cp: any, pIdx: number) => (
                          <div
                            key={pIdx}
                            className="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-teal-500/30 hover:border-teal-500/60 transition-all space-y-4 shadow-md"
                          >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                              <div>
                                <h5 className="font-black text-white text-base">{cp.ad_name || `إعلان #${pIdx + 1}`}</h5>
                                <span className="text-xs text-slate-400 font-mono">معرف: {cp.ad_id}</span>
                              </div>
                              <span className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs sm:text-sm font-black">
                                تقييم الكوبي: {cp.copy_score || '8'}/10 ✍️
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                                <span className="text-xs font-bold text-amber-400 block">🪝 تحليل الهوك (Hook):</span>
                                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                                  {cp.hook_analysis || 'غير محدد'}
                                </p>
                              </div>

                              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                                <span className="text-xs font-bold text-indigo-400 block">📝 صياغة المميزات والـ Body:</span>
                                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                                  {cp.body_structure_analysis || 'غير محدد'}
                                </p>
                              </div>

                              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                                <span className="text-xs font-bold text-emerald-400 block">🎯 العرض والـ Call to Action:</span>
                                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                                  {cp.offer_and_cta_analysis || 'غير محدد'}
                                </p>
                              </div>
                            </div>

                            {/* Alternative Ready-to-Use Copy Suggestions with Copy Button */}
                            {Array.isArray(cp.alternative_copy_suggestions) && cp.alternative_copy_suggestions.length > 0 && (
                              <div className="space-y-2.5 pt-2">
                                <span className="text-xs sm:text-sm font-black text-indigo-300 block">
                                  💡 نصوص إعلانية بديلة مقترحة جاهزة للـ A/B Testing (انسخ واستخدم فوراً):
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {cp.alternative_copy_suggestions.map((suggestion: string, sIdx: number) => {
                                    const copyId = `copy-${cp.ad_id || pIdx}-${sIdx}`;
                                    const isCopied = copiedCopyText === copyId;

                                    return (
                                      <div
                                        key={sIdx}
                                        className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 flex flex-col justify-between gap-3 shadow-inner"
                                      >
                                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                                          {suggestion}
                                        </p>
                                        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                                          <button
                                            onClick={() => copyAdCopySuggestion(suggestion, copyId)}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                              isCopied
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40'
                                            }`}
                                          >
                                            {isCopied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{isCopied ? 'تم نسخ النص بنجاح!' : 'نسخ الكوبي 📋'}</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 5: TARGETING & AUDIENCE AUDIT */}
                {(analysisModalTab === 'ALL' || analysisModalTab === 'TARGETING') && (
                  <div className="space-y-5 pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black">
                          5
                        </div>
                        <h4 className="text-lg sm:text-xl font-black text-white">
                          الجزء الخامس: فحص وتدقيق الاستهداف والجمهور (Targeting Audit)
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-bold">
                        تقييم ملاءمة الجمهور للكريتيف والتصميمات
                      </span>
                    </div>

                    {/* Applied Targeting Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">نوع الاستهداف:</span>
                        <span className="text-xs sm:text-sm font-black text-indigo-300 block">
                          {appliedTargeting.targeting_type_label || (appliedTargeting.is_advantage_plus ? 'Advantage+ Audience' : 'استهداف يدوي')}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">المناطق والمدن:</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-200 block truncate" title={appliedTargeting.locations}>
                          {appliedTargeting.locations || 'غير محدد'}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">السن والنوع:</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-200 block">
                          {appliedTargeting.age_range || '18-65'} | {appliedTargeting.gender || 'الكل'}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">الاهتمامات والسلوكيات:</span>
                        <span className="text-xs sm:text-sm font-bold text-purple-300 block truncate" title={appliedTargeting.interests_and_behaviors}>
                          {appliedTargeting.interests_and_behaviors || 'Broad / بدون اهتمامات'}
                        </span>
                      </div>
                    </div>

                    {/* Alignment with Creatives (Enlarged by 30%) */}
                    <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-sm sm:text-base font-black text-blue-300">
                        <Target className="w-5 h-5 text-blue-400" />
                        <span>تقييم مدى تطابق الاستهداف مع الكريتيف والمنتج:</span>
                      </div>
                      <p className="text-base sm:text-lg text-slate-100 font-semibold leading-relaxed">
                        {targeting.alignment_with_creatives || 'الاستهداف متوافق مع زاوية الكريتيف المعروض.'}
                      </p>
                    </div>

                    {/* Strengths, Risks & Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                      {/* Strengths */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                        <span className="text-xs sm:text-sm font-bold text-emerald-400 block">✅ نقاط القوة:</span>
                        <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300 pr-2">
                          {(targeting.strengths || ['استهداف متوازن بدون تعقيد']).map((st: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-400 font-bold">•</span>
                              <span>{st}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Risks & Leaks */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
                        <span className="text-xs sm:text-sm font-bold text-amber-400 block">⚠️ الثغرات ونقاط التسريب:</span>
                        <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300 pr-2">
                          {(targeting.risks_and_leaks || ['مراقبة التكرار لتفادي إرهاق الشريحة']).map((rk: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>{rk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Recommendations */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2">
                        <span className="text-xs sm:text-sm font-bold text-indigo-400 block">💡 توصيات تطوير الاستهداف:</span>
                        <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300 pr-2">
                          {(targeting.recommendations || ['تجربة Lookalike من زبائن الشراء الفعلي']).map((rc: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-indigo-400 font-bold">•</span>
                              <span>{rc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => handleDownloadPDF(camp, analysis)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>تحميل التقرير PDF 📥</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAnalyzeCampaign(camp, true)}
                    disabled={analyzingCampId === camp.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${analyzingCampId === camp.id ? 'animate-spin' : ''}`} />
                    <span>إعادة التحليل بالأرقام الحالية</span>
                  </button>

                  <button
                    onClick={() => setActiveAnalysisModal(null)}
                    className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Notes Modal */}
      {noteModalAccount && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <StickyNote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">ملاحظات الحساب الإعلاني</h3>
                  <p className="text-xs text-slate-400 truncate max-w-xs">{noteModalAccount.name}</p>
                </div>
              </div>
              <button
                onClick={() => setNoteModalAccount(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                اكتب ملاحظاتك (السطر الأول سيظهر بجوار أيقونة النوت في كارت الحساب):
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="مثال: حساب خاص بعميل المراتب - شغال تحويلات&#10;العميل طلب زيادة الميزانية يوم الجمعة..."
                rows={5}
                className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/80 transition-all leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>يتم الحفظ في قاعدة البيانات وربطه بالحساب دائماً</span>
                <span>{noteText.length} حرف</span>
              </div>
            </div>

            {noteFeedback && (
              <div className={`p-2.5 rounded-xl text-xs font-semibold text-center ${
                noteFeedback.includes('بنجاح') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {noteFeedback}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
              {noteModalAccount.note && (
                <button
                  onClick={() => {
                    setNoteText('');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 mr-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح النص</span>
                </button>
              )}

              <button
                onClick={() => setNoteModalAccount(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>

              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
              >
                <Save className={`w-3.5 h-3.5 ${savingNote ? 'animate-spin' : ''}`} />
                <span>{savingNote ? 'جاري الحفظ...' : 'حفظ الملاحظة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-Resolution Gallery & Image Zoom Modal */}
      {galleryModal && (
        <div
          onClick={() => setGalleryModal(null)}
          className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-3 sm:p-6 animate-in fade-in duration-200"
        >
          {/* Top Bar */}
          <div className="w-full max-w-5xl flex items-center justify-between gap-3 text-white pb-3 border-b border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="font-black text-sm sm:text-base text-slate-100">{galleryModal.title}</span>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
                صورة {galleryModal.activeIndex + 1} من {galleryModal.images.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Single Image Download */}
              <a
                href={`/api/media/download?url=${encodeURIComponent(galleryModal.images[galleryModal.activeIndex])}&filename=${encodeURIComponent(galleryModal.title + `_photo_${galleryModal.activeIndex + 1}.jpg`)}`}
                download
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md"
                title="تحميل هذه الصورة المعروضة"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>تحميل هذه الصورة 📥</span>
              </a>

              {/* All Images Download Zip */}
              {galleryModal.images.length > 1 && (
                <button
                  onClick={() => handleDownloadAllImages(galleryModal.images, galleryModal.title)}
                  disabled={downloadingZip}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  title="تحميل جميع صور الألبوم في ملف مضغوط Zip"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{downloadingZip ? 'جاري التحزيم...' : `تحميل الكل (${galleryModal.images.length} صور Zip) 📦`}</span>
                </button>
              )}

              <button
                onClick={() => setGalleryModal(null)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-base cursor-pointer transition-all"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Main Image Display with Navigation Arrows */}
          <div className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-auto p-2" onClick={e => e.stopPropagation()}>
            {galleryModal.images.length > 1 && (
              <button
                onClick={() => setGalleryModal(prev => prev ? { ...prev, activeIndex: (prev.activeIndex - 1 + prev.images.length) % prev.images.length } : null)}
                className="absolute left-2 sm:left-4 z-10 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white flex items-center justify-center shadow-2xl cursor-pointer transition-all hover:scale-110"
                title="الصورة السابقة"
              >
                ❮
              </button>
            )}

            <img
              src={galleryModal.images[galleryModal.activeIndex]}
              alt={`Photo ${galleryModal.activeIndex + 1}`}
              className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl border border-slate-800/80"
            />

            {galleryModal.images.length > 1 && (
              <button
                onClick={() => setGalleryModal(prev => prev ? { ...prev, activeIndex: (prev.activeIndex + 1) % prev.images.length } : null)}
                className="absolute right-2 sm:right-4 z-10 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white flex items-center justify-center shadow-2xl cursor-pointer transition-all hover:scale-110"
                title="الصورة التالية"
              >
                ❯
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {galleryModal.images.length > 1 && (
            <div className="w-full max-w-4xl flex items-center justify-center gap-2 overflow-x-auto p-2 bg-slate-900/60 rounded-2xl border border-slate-800/80" onClick={e => e.stopPropagation()}>
              {galleryModal.images.map((imgUrl, i) => (
                <div
                  key={i}
                  onClick={() => setGalleryModal(prev => prev ? { ...prev, activeIndex: i } : null)}
                  className={`w-14 h-14 rounded-xl overflow-hidden cursor-pointer border-2 transition-all shrink-0 bg-slate-950 ${galleryModal.activeIndex === i ? 'border-indigo-500 scale-105 shadow-lg' : 'border-slate-800 opacity-60 hover:opacity-100'}`}
                >
                  <img src={imgUrl} alt={`Thumb ${i}`} className="w-full h-full object-contain" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fallback Single Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[88vh] rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold"
            >
              ✕
            </button>
            <img src={previewImage} alt="Ad Preview" className="max-w-full max-h-[85vh] object-contain mx-auto rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
