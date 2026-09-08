import { NextResponse } from 'next/server';
import vertexAI from '@/lib/vertex';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, country = 'EG', excludeTerms = [] } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'الرجاء إدخال مجال البحث أو وصف النشاط' },
        { status: 400 }
      );
    }

    console.log(
      `[API /api/ads/suggest-keywords] Generating keywords for prompt: "${prompt}" (Country: ${country}, Exclude: ${Array.isArray(excludeTerms) ? excludeTerms.length : 0})`
    );

    const result = await vertexAI.suggestNicheKeywords(
      prompt.trim(),
      country,
      Array.isArray(excludeTerms) ? excludeTerms : []
    );

    return NextResponse.json({
      success: true,
      suggestedTerms: result.suggestedTerms,
      explanation: result.explanation,
      angles: result.angles || [],
    });
  } catch (error: any) {
    console.error('[API /api/ads/suggest-keywords Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'فشل توليد الكلمات المفتاحية بالذكاء الاصطناعي' },
      { status: 500 }
    );
  }
}
