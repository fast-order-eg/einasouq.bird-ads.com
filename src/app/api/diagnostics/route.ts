import { NextResponse } from 'next/server';
import vertexAI from '@/lib/vertex';
import { inspectMetaToken } from '@/lib/token-inspector';
import prisma from '@/lib/db';

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    status: 'HEALTHY',
    components: {},
  };

  // 1. Check Vertex AI (Gemini 2.5 Pro & Flash)
  try {
    const testReply = await vertexAI.generate('اكتب كلمة: متصل', { model: 'fast' });
    results.components.vertexAi = {
      status: 'CONNECTED',
      qualityModel: process.env.VERTEX_QUALITY_MODEL || 'gemini-2.5-pro',
      fastModel: process.env.VERTEX_FAST_MODEL || 'gemini-2.5-flash',
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      testResponse: testReply.trim(),
    };
  } catch (err: any) {
    results.components.vertexAi = {
      status: 'ERROR',
      error: err.message,
    };
    results.status = 'DEGRADED';
  }

  // 2. Deep Meta Token & Permissions Diagnostics (Secrets strictly redacted)
  try {
    const tokenInfo = await inspectMetaToken();
    results.components.metaTokenDiagnostics = {
      status: tokenInfo.isValid ? 'AUTHENTICATED' : 'INVALID',
      applicationName: tokenInfo.application,
      appId: tokenInfo.appId,
      userMaskedId: tokenInfo.userId,
      tokenType: tokenInfo.type,
      isLongLived: tokenInfo.isLongLived,
      expiresAt: tokenInfo.expiresAt,
      dataAccessExpiresAt: tokenInfo.dataAccessExpiresAt,
      appMode: tokenInfo.appMode,
      apiVersion: tokenInfo.apiVersion,
      managedPagesCount: tokenInfo.managedPagesCount,
      grantedPermissions: tokenInfo.grantedScopes,
      missingPermissionsForPublicPages: tokenInfo.missingScopesForPublicPages,
      domainA: tokenInfo.domainAStatus,
      domainB: tokenInfo.domainBStatus,
    };

    if (!tokenInfo.isValid) {
      results.status = 'DEGRADED';
    }
  } catch (err: any) {
    results.components.metaTokenDiagnostics = {
      status: 'ERROR',
      error: err.message,
    };
    results.status = 'DEGRADED';
  }

  // 3. MySQL Database Diagnostics
  try {
    const assetsCount = await prisma.metaAsset.count();
    const postsCount = await prisma.pagePost.count();
    results.components.database = {
      status: 'CONNECTED',
      host: '127.0.0.1:3306',
      database: 'adscope_db',
      trackedAssets: assetsCount,
      savedPosts: postsCount,
    };
  } catch (dbErr: any) {
    results.components.database = {
      status: 'DISCONNECTED',
      error: 'XAMPP MySQL is unreachable on 127.0.0.1:3306',
    };
    results.status = 'DEGRADED';
  }

  return NextResponse.json(results);
}
