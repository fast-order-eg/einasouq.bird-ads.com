# Prompt for a Vibe-Coding Agent

## How to use this document

Copy the entire section titled **MASTER BUILD PROMPT** and paste it into your Vibe-Coding environment. Do not paste any Meta App Secret, access token, Google service-account private key, or other secret into the prompt. Put secrets only in a local `.env` file or the server’s secret manager.

The prompt is intentionally written in English because coding agents usually follow detailed technical requirements more reliably in English. The requested product interface, reports, and user-facing explanations must support Arabic RTL, with English fallback where appropriate.

---

# MASTER BUILD PROMPT

You are a senior full-stack engineer, product architect, data engineer, AI engineer, and security-minded technical lead. Build a production-oriented internal web application called **AdScope Intelligence**. It will be developed locally first, then deployed to a private company server so a marketing team can use it. The first release is for internal company use, but the architecture must be ready to evolve into a multi-tenant SaaS product later.

Do not create a superficial mock dashboard. Build a working application with real server-side integrations, persistent storage, authentication, background synchronization, structured AI analysis, evidence trails, error handling, and a clear capability matrix that distinguishes available data from unavailable data.

## 1. Product objective

The application has two main use cases:

1. **Facebook and Instagram page analysis.** Analyze pages and accounts that the company owns or is authorized to access, and analyze public Facebook page content only through officially permitted Meta access. For Instagram, implement only officially supported access paths. Do not scrape arbitrary private or public profiles when the official API does not provide that capability. If a requested Instagram competitor-profile feature is not available through the approved API, show a transparent “not available through the current Meta access level” state and offer an approved fallback such as manual import or hashtag-based discovery.

2. **Competitor ad intelligence.** Accept a competitor Page URL, Page ID, brand name, keyword, industry, country, or language. Search Meta Ad Library through the official Ads Archive API, collect the returned ad records and creative snapshot links, store periodic observations, compare changes over time, and produce evidence-based creative and strategic analysis. Never claim to know a competitor’s exact sales, ROAS, conversions, targeting, or internal performance unless the authenticated API response explicitly contains that information.

The application must clearly separate:

- Raw facts returned by Meta.
- Derived calculations made by deterministic code.
- AI interpretations and hypotheses.
- Missing or restricted data.
- User-entered notes and assumptions.

Every AI insight must show the source records and the observation date on which it is based.

## 2. Non-negotiable platform and compliance rules

Use official Meta APIs and documented Meta access flows. Do not build CAPTCHA bypassing, login bypassing, stealth browser automation, cookie theft, private-content extraction, rate-limit evasion, or scraping of protected pages. Do not use a browser scraper as the primary data source. If an official API does not provide a requested metric, the UI must say “Data not available” or “Not available through the current Meta access level.”

Use Meta Ad Library / Ads Archive for public ad discovery. The application must support:

- `search_terms`.
- `search_page_ids`, with validation and a maximum of 10 IDs in a single request.
- `ad_reached_countries`.
- `ad_type`.
- `ad_active_status`.
- `media_type`.
- `publisher_platforms`.
- `languages` where supported.
- `ad_delivery_date_min` and `ad_delivery_date_max` where supported.
- API pagination through `paging.next`.

Do not assume that the API returns complete results in one request. Store the query parameters and the exact timestamp of every synchronization run.

Use Page Public Content Access only when the app has the required Meta feature, review status, business verification, and permissions. Use the Instagram access path only for endpoints and use cases approved by Meta. The current documented Instagram Public Content Access feature is focused on hashtag search endpoints and approved use cases; it is not a license to read every competitor’s arbitrary profile feed.

Use Ads Insights API only for ad accounts, campaigns, ad sets, and ads for which the authenticated business has authorization. Do not use Ads Insights data from the company’s own ad account to imply anything about a competitor’s account.

## 3. Recommended architecture

Use a maintainable full-stack TypeScript architecture unless the current project environment imposes a better supported choice. Prefer:

- Next.js or an equivalent React-based web application.
- TypeScript in strict mode.
- A server-side API layer for all Meta and Google calls.
- PostgreSQL as the production database, with a local Docker Compose setup.
- Prisma or another typed ORM with migrations.
- A background job mechanism for synchronization, retries, media processing, and AI analysis.
- A server-side session system with role-based access control.
- Tailwind CSS or an equivalent design system with Arabic RTL support.
- Object storage abstraction for downloaded media and reports. Local filesystem storage may be used in development, but storage must be replaceable by S3-compatible storage in production.

Keep providers behind interfaces so the product does not depend on one hidden connector:

```text
MetaProvider
  - OfficialGraphApiProvider
  - OptionalMcpProvider, only if explicitly configured by the company

AiProvider
  - VertexGeminiProvider

StorageProvider
  - LocalStorageProvider
  - S3CompatibleStorageProvider
```

The default production path must be the official Meta Graph/Marketing APIs and Google Cloud Vertex/Gemini integration. Do not assume that a private MCP connection available inside another environment is automatically available to this application. If an MCP adapter is implemented, it must be optional and must not prevent the direct official API provider from working.

## 4. Environment variables and secrets

Create `.env.example` with placeholders only. Never commit `.env`, real tokens, service-account JSON files, or client secrets.

Use a configuration module that validates required variables at startup and reports safe, non-secret error messages.

Include placeholders such as:

```env
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...
SESSION_SECRET=replace_me
ENCRYPTION_KEY=replace_me

META_APP_ID=replace_me
META_APP_SECRET=replace_me
META_API_VERSION=v26.0
META_CONFIG_ID=replace_me
META_REDIRECT_URI=http://localhost:3000/api/auth/meta/callback
META_GRAPH_BASE_URL=https://graph.facebook.com

GOOGLE_CLOUD_PROJECT=replace_me
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_GENAI_USE_ENTERPRISE=true
VERTEX_FAST_MODEL=replace_with_current_supported_fast_model
VERTEX_QUALITY_MODEL=replace_with_current_supported_quality_model
VERTEX_VIDEO_MODEL=replace_with_current_supported_multimodal_model

STORAGE_PROVIDER=local
STORAGE_BUCKET=replace_me
REDIS_URL=redis://localhost:6379
```

Support the current Google Gen AI SDK and current Google Cloud authentication conventions. Do not hard-code a model name that may be retired. Model IDs must be configurable. At application startup, expose the configured model IDs in an admin-only diagnostics page without exposing credentials.

For local development, document Application Default Credentials as the preferred authentication method. For deployment, document a dedicated Google service account or workload identity with only the required Vertex permissions. Never expose Google credentials in browser code.

## 5. Authentication and team model

Implement two separate permission systems:

1. **Application users and roles.** These are roles inside AdScope Intelligence: Owner, Admin, Analyst, Viewer. They control who can access workspaces, run analysis, manage connectors, and export reports.

2. **Meta authorization.** This is the OAuth/business authorization granted to the application by a Meta account or business administrator. Do not make every internal employee an Administrator or Developer of the Meta app.

For the internal first release:

- Keep one or two highly trusted Meta App Administrators.
- Add Developers only when technical team members need to change app settings.
- Add Testers only when they need to test the app while it is in development mode.
- Normal company users should be users of AdScope Intelligence, not administrators of the Meta Developer app.
- Build a “Connect Meta Business” flow based on Facebook Login for Business or the currently approved Meta business OAuth flow.
- A business or page administrator should connect the relevant business assets once. Store the resulting authorization securely server-side.
- Other internal employees should use the application’s own login and RBAC without repeatedly reconnecting Meta unless they need to authorize another business asset.
- When the product becomes SaaS, each customer business administrator should connect their own Business Portfolio, Page, Instagram professional account, or ad account. Do not share one customer’s tokens with another customer.

Never store Meta access tokens in localStorage or send them to the browser. Encrypt them at rest, restrict access to the connector service, record token expiry, refresh or reauthorization requirements, and provide a “Disconnect and delete credentials” action.

## 6. Meta connector requirements

Build a typed Meta client with:

- OAuth authorization URL generation.
- Callback code exchange performed server-to-server.
- Token validation and safe expiry handling.
- Asset discovery.
- Page discovery for authorized assets.
- Instagram professional-account discovery only where officially supported.
- Ad Library search.
- Page-content synchronization where the approved Page Public Content Access feature and permissions permit it.
- Optional first-party page/account insights only for assets the authenticated business controls.
- Request IDs, structured logs, retries for transient errors, exponential backoff, pagination, and rate-limit handling.
- A dry-run mode for development.
- A connector diagnostics endpoint that checks configuration without exposing secrets.

Use the exact API version from configuration. Do not scatter API version strings throughout the code.

### Ad Library search behavior

Build a search planner instead of making one naive request. For an industry such as Egyptian digital marketing, generate controlled query variants such as:

```text
التسويق الالكتروني
التسويق الرقمي
digital marketing
marketing agency
social media marketing
performance marketing
```

Do not silently combine every term into one query if that changes the meaning. Execute separate searches, label each result with the query that found it, normalize language and country, then deduplicate by the stable ad library identifier and page identifier.

Allow the user to choose:

- Country.
- Active, inactive, or all ads.
- Date range.
- Search terms.
- Exact phrase or unordered keyword search.
- Media type.
- Facebook, Instagram, or other supported Meta placements.
- Specific Page IDs.
- Maximum pages and maximum records for a run.

Persist the raw API response for audit/debugging in a structured record, subject to retention controls. Store normalized fields separately for reporting.

### Important ad data limitations

The UI and AI prompts must enforce these rules:

- Do not call an ad “best performing” based only on its presence in Ad Library.
- Do not call an ad “most profitable” or “highest ROAS” without authorized performance data.
- Treat `impressions` and `spend` as optional range fields with restricted availability. Never convert ranges into exact values.
- Do not invent comments, reactions, reach, spend, conversions, or audience details.
- If a field is null, absent, restricted, or not returned, show “Data not available.”
- Label every metric with its source, date, unit, and scope.
- If a date range includes the current date, label the result as partial and subject to change.

## 7. Database design

Create migrations and typed models for at least the following entities:

| Entity | Purpose |
|---|---|
| users | Internal application users. |
| workspaces | Company or future customer workspace. |
| workspace_members | User roles and access control. |
| meta_connections | Encrypted OAuth tokens, scopes, status, expiry, business identity. |
| meta_assets | Pages, Instagram professional accounts, ad accounts, and asset metadata. |
| tracked_entities | Competitors, clients, keywords, industries, countries, and tracked URLs. |
| ad_search_runs | Search parameters, status, timestamps, error summary, counts. |
| ads | Stable ad identity, page, first seen, last seen, current status, source metadata. |
| ad_snapshots | Per-run observation of copy, media, dates, platforms, and raw response reference. |
| media_assets | Images, videos, thumbnails, checksums, MIME types, storage references, retention state. |
| page_posts | Public or authorized posts with source, timestamp, text, media references, and available interaction metrics. |
| post_comments | Public/authorized comments if permitted, with text, timestamp, and moderation-safe metadata. |
| sync_jobs | Background job state, retry count, schedule, and error details. |
| analysis_runs | AI model, prompt version, input IDs, status, cost metadata if available, and timestamps. |
| analysis_results | Structured JSON analysis, confidence, evidence references, limitations, and model metadata. |
| reports | Saved reports with filters, generated content, and export status. |
| audit_logs | Security and data-access events. |
| app_settings | Non-secret settings such as model IDs, default country, language, retention, and scheduling. |

Use unique constraints and checksums to prevent duplicate ads, posts, media, and analysis runs. Preserve historical observations instead of overwriting everything with the latest value.

## 8. Page analysis specification

Create a page-analysis workflow that works only with data the connector is actually allowed to retrieve. The analysis must include the following sections when evidence exists:

### Identity and presence

Analyze page/account name, username, Page ID or account ID, category, public description, profile and cover assets if available, public CTA, website, contact information, location, verification indicators if returned, linked assets, and last observed activity.

### Content strategy

Classify posts by content type: image, video, Reel, carousel, link post, text post, live-related content, offer, testimonial, educational, promotional, announcement, behind-the-scenes, user-generated content, case study, comparison, objection handling, and community content.

Extract recurring topics, products, services, offers, pain points, benefits, claims, objections, CTAs, emotional triggers, proof elements, language, dialect, tone, reading level, and brand voice.

### Publishing behavior

Calculate observed posting frequency, active days, time gaps, content-format mix, content recency, and repeated creative themes. Make clear that these are calculated from the collected sample and are not necessarily the account’s complete historical behavior.

### Public interaction analysis

Where the source exposes the value, record reactions, comments, shares, views, and other interaction metrics. Make the denominator explicit before calculating a rate. If no valid denominator exists, do not present an engagement rate as if it were authoritative. Use “observed interactions” rather than claiming internal reach or performance.

Analyze comment themes, customer questions, objections, purchase intent signals, recurring complaints, sentiment as a model classification, response time where timestamps permit it, and frequently requested information. Do not expose or infer sensitive personal information.

### Strategic output

Produce strengths, weaknesses, opportunities, content gaps, audience questions, messaging patterns, practical tests for the user’s own brand, and a prioritized 7-day/30-day content test plan. Recommendations must cite evidence from specific posts.

## 9. Competitor ad analysis specification

For every ad or ad snapshot, extract and normalize:

- Advertiser Page ID and Page name.
- Ad Library ID.
- Search query and country that returned the result.
- Active/inactive status when returned.
- Creation time, delivery start time, delivery stop time.
- Platforms.
- Media type.
- Primary text variants.
- Link title variants.
- Link caption variants.
- Link description variants.
- CTA and destination link when available.
- Snapshot URL.
- Languages.
- Public range fields such as spend or impressions only when returned and only with their range notation and availability caveat.
- First observed and last observed timestamps in the company database.
- Number of observed creative variants.
- Whether the ad has appeared across multiple platforms or searches.

Classify each creative using a strict JSON schema:

```json
{
  "hook": {
    "type": "problem|benefit|curiosity|offer|social_proof|urgency|comparison|question|other",
    "text": "",
    "evidence": []
  },
  "offer": {
    "present": false,
    "type": "discount|free_trial|consultation|bundle|guarantee|lead_magnet|none|other",
    "details": "",
    "evidence": []
  },
  "problem_addressed": "",
  "benefit_promised": "",
  "audience_hypothesis": "",
  "cta": "",
  "funnel_stage": "awareness|consideration|conversion|retention|unclear",
  "creative_format": "image|video|carousel|text|unknown",
  "visual_analysis": {
    "scene_summary": "",
    "on_screen_text": [],
    "people_or_objects": [],
    "color_style": "",
    "brand_elements": [],
    "editing_pattern": "",
    "evidence": []
  },
  "copy_analysis": {
    "tone": "",
    "language": "",
    "dialect": "",
    "reading_level": "",
    "proof_elements": [],
    "objections_handled": [],
    "evidence": []
  },
  "compliance_flags": [],
  "confidence": 0.0,
  "limitations": []
}
```

For video creatives, when the media is available and permitted, use a multimodal Gemini request to analyze visual scenes, spoken language, on-screen text, opening hook, pacing, transitions, offer appearance, CTA appearance, and approximate timestamps. If the video cannot be downloaded or analyzed, return a partial analysis and explain why.

Create a transparent “observed creative strength” score only as a heuristic. It may combine documented signals such as persistence across sync runs, number of creative variants, platform coverage, message clarity, CTA clarity, evidence completeness, and available public indicators. Name it a heuristic score, not performance. Show the components and weights. Make the weights configurable.

## 10. Vertex AI / Gemini integration

Implement a server-side `VertexGeminiProvider` using the current Google Gen AI SDK and the current Google Cloud authentication approach. Keep all model IDs configurable.

Use a two-tier routing strategy:

- A fast multimodal model for bulk extraction, classification, OCR-like reading of ad text in images, and first-pass page/post labeling.
- A stronger configurable model for cross-competitor synthesis, final strategic reports, and difficult multimodal interpretation.

Before production deployment, verify which model IDs are available in the selected Google Cloud project and location. Do not assume that a model available in documentation is enabled in the user’s project or region. Add an admin “Test Gemini Connection” action.

Use structured JSON output validated by Zod or JSON Schema. If validation fails, retry once with a repair prompt, then store the failed response safely and mark the analysis as incomplete. Never silently convert invalid AI output into facts.

All AI prompts must include:

- The task objective.
- The exact source records.
- Observation timestamps.
- The instruction to use only supplied evidence.
- The instruction to distinguish fact, calculation, hypothesis, and recommendation.
- The instruction to return “not available” rather than guessing.
- The required JSON schema.
- The desired language and locale.

Implement prompt versioning so reports can be reproduced. Store model ID, prompt version, input record IDs, and output validation state.

Use media caching and checksums so the same image or video is not sent repeatedly unless the content changed. Enforce file-size, duration, MIME-type, and timeout limits. Delete temporary media according to the configured retention policy.

## 11. User interface

Build a clean professional Arabic RTL interface with optional English mode. The initial navigation should contain:

| Screen | Required behavior |
|---|---|
| Overview | Workspace summary, latest syncs, tracked competitors, analysis health, and data limitations. |
| Add competitor/client | Accept URL, Page ID, brand name, country, language, and notes; validate and show what can be connected. |
| Ad discovery | Search by keyword, page, country, status, date, format, and platform; display query provenance. |
| Ad library table | Search, filter, sort, compare, tag, save, and open source snapshot. |
| Ad detail | Timeline, copy variants, media, platforms, raw evidence, AI analysis, limitations, and related ads. |
| Competitor comparison | Compare themes, hooks, offers, CTAs, formats, persistence, and observed signals. |
| Page analysis | Identity, content mix, posting behavior, public interactions, comments, themes, and recommendations. |
| AI reports | Generate, save, regenerate, export, and cite evidence. |
| Sync center | Run now, schedule, status, pagination count, rate-limit state, and errors. |
| Connections | Meta connection status, authorized assets, scopes, expiry, reconnect, disconnect, and delete. |
| Settings | Country, language, timezone, retention, model IDs, score weights, and workspace preferences. |
| Admin diagnostics | Health checks without showing secrets, last API error, current API version, model connection, database, storage, and queue. |

The UI must make limitations visible. Include badges such as “Official API data,” “Public data,” “Authorized asset,” “AI interpretation,” “Heuristic,” and “Data not available.”

## 12. Background jobs and synchronization

Implement jobs for:

- Scheduled Ad Library searches.
- Re-running saved searches.
- Refreshing tracked pages where permitted.
- Downloading allowed media snapshots.
- Extracting text and media metadata.
- Running AI analysis.
- Generating reports.
- Cleaning expired temporary media.

Jobs must be idempotent, retry transient failures, stop retrying permanent permission errors, and expose status to the UI. Store a correlation ID for each run. Do not use an AI agent as a substitute for deterministic pagination, deduplication, retries, or database writes.

The scheduler must be configurable and disabled by default until the user enables it. Add a safe initial schedule such as daily or weekly, not aggressive polling. Respect Meta rate limits and the application’s storage budget.

## 13. Security and privacy

Implement:

- Server-side secret handling.
- Encrypted tokens at rest.
- Strict RBAC by workspace.
- CSRF protection where applicable.
- Secure HTTP-only cookies.
- Input validation for URLs, IDs, filters, and file uploads.
- SSRF protection for any URL fetcher.
- Allowlisted domains for Meta media and approved storage endpoints.
- File MIME and size validation.
- Safe HTML/text rendering to prevent XSS.
- Rate limits on expensive AI and sync operations.
- Audit logs for connector access, exports, and deletes.
- Data deletion workflow.
- Privacy policy and data-deletion URL placeholders.
- No logging of access tokens, client secrets, authorization codes, or private user content.

Do not collect unnecessary personal data from comments. Add configurable redaction for names, phone numbers, emails, and other sensitive strings before sending comment text to the AI model.

## 14. Testing and acceptance criteria

Create unit, integration, and end-to-end tests. Include:

- URL and Page ID parsing.
- Query planning and language variants.
- JSON encoding of array query parameters.
- Pagination through multiple API pages.
- Deduplication of the same ad across searches.
- Null and restricted metric handling.
- Token expiry and reconnect flow.
- Rate-limit and transient error handling.
- Permission-denied handling.
- AI JSON-schema validation.
- Evidence references in reports.
- Arabic RTL rendering.
- Workspace isolation.
- Secret redaction in logs.
- SSRF and file-upload protections.
- Background job idempotency.

Do not use random fake numbers in the production analysis path. Fixtures are allowed only in tests and must be clearly labeled as fixtures. The demo mode must never be confused with live data.

The Definition of Done is:

1. A new user can create or join an internal workspace.
2. A trusted business administrator can connect Meta through the documented OAuth flow.
3. The app can run a real Ad Library search from the server and paginate safely.
4. The app stores normalized ads and historical observations.
5. The app displays a transparent ad table and detail view.
6. The app can generate structured AI creative analysis using Vertex/Gemini.
7. The app can analyze authorized/public page content only where the approved API access exists.
8. The app explains unavailable data instead of fabricating it.
9. The app can schedule a daily or weekly sync.
10. The app runs locally through documented commands and is ready for deployment behind HTTPS.
11. The README includes Meta setup, Google Cloud setup, environment variables, migrations, tests, and deployment instructions.
12. The app has a capability matrix showing which features are enabled, pending review, unavailable, or limited.

## 15. Build sequence

Work in the following sequence and do not skip validation:

### Phase A — project inspection and plan

Inspect the existing repository before editing. Identify the current framework, package manager, database, authentication, and deployment assumptions. If the repository is empty, scaffold the chosen full-stack architecture. Write a short implementation plan and ask for clarification only when a decision blocks progress.

### Phase B — foundation

Create configuration validation, database schema, migrations, authentication, RBAC, layout, Arabic RTL design system, error handling, logging, and health checks.

### Phase C — Meta connector

Implement the official provider, OAuth/business login flow, encrypted token storage, asset discovery, diagnostics, permissions display, and API client tests. Do not add mock success states around real authentication.

### Phase D — Ad Library

Implement query planning, parameter validation, pagination, deduplication, normalization, historical snapshots, media metadata, filters, tables, and detail views.

### Phase E — Page/account analysis

Implement only the approved Facebook and Instagram data paths. Add capability detection and explicit incomplete states. Build deterministic content metrics before adding AI interpretation.

### Phase F — Vertex/Gemini

Implement the provider interface, ADC/service-account support, configurable model IDs, multimodal image/video handling, structured output, prompt versioning, evidence references, and retry/validation behavior.

### Phase G — jobs and reports

Implement background jobs, schedules, comparisons, report generation, exports, and audit logs.

### Phase H — security and release

Run tests, lint, typecheck, dependency audit, secret scan, migration test, local Docker test, and production build. Document deployment behind HTTPS, reverse proxy configuration, secure environment variables, backups, and monitoring.

At the end of every phase, report what was implemented, what was tested, what remains unavailable because of Meta permissions, and the exact next command or action.

## 16. First deliverables

Before writing complex UI, create:

- `README.md`.
- `.env.example`.
- Database schema and migrations.
- Provider interfaces.
- Meta API client with tests.
- Vertex/Gemini provider with a connection test.
- Capability matrix.
- Basic dashboard shell.
- A real end-to-end “search ads” path using a user-provided token/configuration at runtime.

Do not claim that the application can read all Facebook or Instagram pages. Build the product around official access, show limitations prominently, and keep the code modular so approved future access can be added without rewriting the application.

---

# Manual setup checklist before running the project

## A. Meta setup

### 1. Create or verify the business structure

Use the company’s Meta Business Portfolio. Verify that the person who will connect the company’s assets has the appropriate administrative access to the Facebook Pages, Instagram professional accounts, and ad accounts that the company owns or manages.

### 2. Create a Business-type Meta app

In Meta for Developers, create or use a **Business** app. Add the products and features that are actually required. At minimum, the coding agent should be prepared for Facebook Login for Business and the Marketing API/Ad Library path. Do not add every available product by default.

### 3. Configure OAuth

Create local and production redirect URLs, for example:

```text
http://localhost:3000/api/auth/meta/callback
https://YOUR-DOMAIN.com/api/auth/meta/callback
```

The exact route must match the application. Configure the app domain, allowed redirect URIs, privacy policy URL, data deletion URL, and terms URL before testing production login.

### 4. Decide who receives Meta app roles

Do **not** add every member of the marketing team as an App Administrator. Keep the Administrator role limited to the owner and one trusted technical backup. Add a Developer only when someone must edit technical settings. Add Testers only during development testing. Normal team members should log in to your own application and use its internal roles.

### 5. Decide the Meta connection model

For the internal version, use this model:

| User type | What they should do |
|---|---|
| Company Meta/business administrator | Connect the company’s authorized business assets once through OAuth. |
| Technical owner | Maintain the Meta app and handle App Review. |
| Marketing analyst | Use the internal tool; they do not need to be Meta App Administrators. |
| Client business administrator, in a future SaaS version | Connect that client’s own Business Portfolio and assets. |

For public competitor-ad discovery, the application can use the approved Ad Library route. For analysis of a company-owned page or account, an administrator of that asset may need to connect and authorize it.

### 6. Request only the permissions that are actually needed

The coding agent must confirm the current Meta documentation before finalizing the list. Typical candidates for controlled use cases can include `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `ads_read`, `business_management`, `instagram_basic`, and `instagram_manage_insights`, but the exact permissions and review requirements depend on the endpoints and use case.

For Facebook public page analysis, plan for Page Public Content Access, business verification, and App Review. For Instagram competitor content, do not assume that an arbitrary public profile feed is available. Meta’s documented Instagram Public Content Access path is centered on hashtag-search endpoints and approved use cases. If the desired profile analysis is not approved or not exposed by the API, the tool must show that limitation and use a compliant alternative.

### 7. Submit App Review when required

Prepare a short screencast showing:

1. A team member opens the tool.
2. The Meta login/authorization screen appears.
3. The user selects or grants the required business assets.
4. The tool displays only the approved data.
5. The user runs a page analysis or ad search.
6. The report cites the source records and shows data limitations.

Write the allowed-use explanation in plain language. Do not describe the product as a system for bypassing Meta restrictions or secretly monitoring private accounts.

### 8. What to give the coding agent about Meta

Give it these non-secret values through a local `.env` file or secure environment:

```text
META_APP_ID
META_API_VERSION
META_CONFIG_ID, if using Facebook Login for Business configuration
META_REDIRECT_URI
META_GRAPH_BASE_URL
The approved product/features and permissions
The local and production domain names
The default country and language
```

Do **not** paste `META_APP_SECRET`, access tokens, authorization codes, or client credentials into the prompt. Put them into `.env` locally, and make sure `.env` is in `.gitignore`.

## B. Google Cloud / Vertex AI setup

### 1. Create or select a Google Cloud project

Use the project connected to the Vertex/Gemini API billing and permissions. Enable the currently required Gemini/Vertex AI service according to Google Cloud’s current documentation.

### 2. Set up authentication

For local development, use Application Default Credentials where possible. For the server, use a dedicated service account or workload identity with the minimum required permissions. The coding agent must not place credentials in frontend code.

Give the agent these non-secret configuration values:

```text
GOOGLE_CLOUD_PROJECT
GOOGLE_CLOUD_LOCATION
The selected API/authentication mode
The approved fast model ID
The approved quality model ID
The approved multimodal/video model ID, if separate
```

The safest design is to keep model IDs configurable and verify them from the project/region before deployment. Google’s current documentation has moved Vertex AI material into the Gemini Enterprise Agent Platform documentation, and model availability/lifecycle can change. Do not hard-code a model throughout the application.

### 3. Test the model separately

Before integrating the full application, run a small server-side test that sends:

- A text-only analysis request.
- An image plus text request.
- A short video plus text request, if video analysis is enabled.

The expected result must be structured JSON, not a free-form answer only. Confirm that the selected model supports the required modality and that the project has permission to call it.

## C. What you should send to the coding agent

Send the following information, not secrets:

```text
1. The name of the application.
2. Confirmation that it is an internal web app first and future SaaS later.
3. Local development port and intended production domain.
4. The preferred database choice, or permission for the agent to use PostgreSQL.
5. The company’s default country, timezone, and languages.
6. The Meta App ID and configuration ID through environment variables only.
7. The list of Meta features/permissions already approved.
8. The Google Cloud project ID, location, and model IDs through environment variables only.
9. Whether local Docker is available.
10. The first three competitor pages or test keywords, preferably public and non-sensitive.
11. A sample page owned by the company for testing authorized access.
12. Whether reports should be Arabic only or Arabic plus English.
```

Do not send passwords, access tokens, app secrets, Google private keys, customer personal data, or private comment exports inside the prompt.

## D. First test plan

Start with a small controlled test:

1. One company-owned Facebook Page for authorized access.
2. One company-owned Instagram professional account if the required access path is approved.
3. Two public competitor Page IDs or names.
4. One industry keyword in Arabic and one in English.
5. One country, such as Egypt.
6. A limited date range and record limit.
7. One text-only ad and one image/video ad if available.

Validate that the application records the raw source, query, timestamp, API response status, normalized data, AI evidence, and any missing fields. Do not expand to many competitors until the first run is accurate and the App Review/access model is clear.

---

# Important implementation decision about the team

For your current internal version, the recommended model is **not** “every team member connects Facebook and everyone becomes an admin in Meta Developer.” Instead, keep the Meta app under the control of a very small number of trusted administrators, let the relevant business/page administrator authorize the business assets through OAuth, and let the rest of the team use roles inside your own application.

If the tool only analyzes public Ad Library data, there may be no reason for every analyst to connect a separate Facebook account. If the tool analyzes a client-owned Page, Instagram professional account, or ad account, an administrator of that business asset must authorize access at least once. In a future SaaS version, each customer administrator connects their own business, and your internal team does not receive the customer’s Meta credentials.

# References

[1]: [Meta Graph API — Ads Archive](https://developers.facebook.com/docs/graph-api/reference/ads_archive/) — official search parameters, page search, filters, pagination, and query behavior.

[2]: [Meta Graph API — Archived Ad](https://developers.facebook.com/docs/marketing-api/reference/archived-ad/) — official ArchivedAd fields and restrictions on impressions, spend, and audience data.

[3]: [Meta — Page Public Content Access](https://developers.facebook.com/docs/features-reference/page-public-content-access/) — public Page content, allowed analysis, business verification, and App Review requirements.

[4]: [Meta — Instagram Public Content Access](https://developers.facebook.com/docs/features-reference/instagram-public-content-access/) — Instagram hashtag-search endpoints, approved use cases, business verification, and review requirements.

[5]: [Meta — Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business) — business OAuth configuration, assets, permissions, token types, and server-side code exchange.

[6]: [Meta — App Roles](https://developers.facebook.com/documentation/development/build-and-test/app-roles) — Administrator, Developer, and Tester roles and their limitations.

[7]: [Google Cloud — Get started with Gemini Enterprise Agent Platform](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start) — current SDK, ADC recommendation, project configuration, and model requests.

[8]: [Google Cloud — Summarize a video file with audio using Gemini Multimodal](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/samples/googlegenaisdk-textgen-with-video) — official multimodal video-analysis example.

[9]: [Google Cloud — Google models](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/google-models) — current Google model catalogue and capabilities.

[10]: [Google Cloud — Model versions and lifecycle](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions) — model lifecycle and migration guidance.
