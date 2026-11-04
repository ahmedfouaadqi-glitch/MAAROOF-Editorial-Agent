# AI Visibility, Indexing, Citation and Training Evidence

## Core principle

MAAROOF must never collapse four different events into one "AI visibility" score:

1. **Crawler fetch / technical read** — an identified bot requested a URL. This proves a request only, not indexing, citation, or training.
2. **Search indexing / discovery** — a search product or webmaster inspection tool provides evidence that the URL is indexed or eligible. A crawl is not proof of indexing.
3. **Citation / answer inclusion** — a captured AI/search answer links to the article or names it as a source. A crawler visit or indexed URL is not proof of citation.
4. **Training use** — only an explicit provider statement or verifiable provider-level attestation can support this claim. A training crawler visit is not proof that this specific article entered a training set or was used to update a model.

The dashboard stores evidence events, not assumptions. Verified counts include only events marked verified and, for indexing/citation/training, accompanied by an evidence URL and verification note.

## Crawler purpose registry (initial, provider-documented distinctions)

| Provider | Agent/token | Documented purpose | What an observed request proves |
|---|---|---|---|
| OpenAI | GPTBot | Content that may be used for foundation-model training | A crawler request, not actual article-level training use |
| OpenAI | OAI-SearchBot | ChatGPT search discovery and surfacing | A search crawler request, not a citation |
| OpenAI | ChatGPT-User | User-initiated retrieval | A user-triggered fetch, not automatic indexing |
| Google | Googlebot | Google Search crawling | A fetch; use Search Console/URL Inspection for indexing evidence |
| Google | Google-Extended | robots.txt control token for certain Gemini training/grounding use; not a separate HTTP user agent | A policy control, not a crawler visit |
| Anthropic | ClaudeBot | Content that may contribute to model training | A fetch, not article-level training confirmation |
| Anthropic | Claude-SearchBot | Search crawling | A fetch, not citation |
| Anthropic | Claude-User | User-directed retrieval | A user-triggered fetch |
| Perplexity | PerplexityBot | Search crawler | A fetch, not proof of index inclusion or citation |
| Perplexity | Perplexity-User | User-directed retrieval | A user-triggered fetch |

Official documentation:
- OpenAI crawlers: https://developers.openai.com/api/docs/bots
- OpenAI publisher FAQ: https://help.openai.com/en/articles/12627856-publishers-and-developers-faq
- Google common crawlers / Google-Extended: https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
- Google AI features: https://developers.google.com/search/docs/appearance/ai-features
- Anthropic crawler controls: https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- Perplexity crawler guidance: https://docs.perplexity.ai/guides/bots

## What can be measured

### A. Crawler access

For domains the workspace controls:
- ingest web server/CDN access logs;
- identify bots using user-agent plus provider-published IP verification where available;
- record requested URL, response status, timestamp, user-agent, verified IP, bytes, and response latency;
- deduplicate retries and distinguish 2xx/3xx/4xx/5xx;
- never trust a user-agent string alone because it can be spoofed.

For third-party magazines or publishing platforms:
- the system cannot inspect their server logs unless the publisher grants log/analytics access;
- record only evidence supplied by the user or a connected authorized analytics/log source;
- do not show "read by AI" without an observed and attributable request.

### B. Search indexing

Evidence sources may include:
- Google Search Console URL Inspection / indexing status;
- Bing Webmaster Tools URL inspection or search performance;
- public search results captured with timestamp, query, URL, and result evidence;
- platform-specific webmaster/search tools where available.

Search result appearance is not equivalent to every LLM having indexed the article. Search engines may power only some answer experiences.

### C. AI citation

Capture a dated answer or search result showing the URL as a cited source:
- provider/product and interface/mode;
- query used;
- timestamp and locale;
- exact cited URL and visible source label;
- screenshot or archived evidence where legally and technically permitted;
- whether the citation is direct, syndicated, or points to a canonical source.

A citation test is an observation for one query and one product/mode at one time. It is not a universal citation guarantee.

### D. Training

Do not infer training from:
- GPTBot, ClaudeBot, or other training-related crawler visits;
- search indexing;
- an AI citation;
- traffic or referral analytics.

Record training use only if the provider explicitly confirms the specific content or an auditable content-level dataset inclusion. Otherwise the dashboard must show **Unknown / Not verifiable**, not "trained".

## Publisher controls and platform dependencies

- On a domain controlled by the user, robots.txt and platform-specific controls can express crawl/training preferences. They do not force a provider to cite or train on content.
- OpenAI separates OAI-SearchBot from GPTBot.
- Google separates Googlebot search crawling from Google-Extended training/grounding controls; Google-Extended is not an HTTP crawler.
- Third-party magazine/CMS hosts control their own robots.txt, CDN logs, indexing directives, and platform-level restrictions. MAAROOF cannot override those settings from an author account.
- An article submitted to a magazine is not guaranteed to be accepted, published, indexed, or cited by AI systems.

## Admin dashboard and API

The admin dashboard provides four separate counters and an event history:
- crawler fetches observed;
- verified indexed URLs;
- verified citations;
- explicit training attestations.

API:
- `GET /api/v1/admin/ai-visibility?workspaceId=...`
- `POST /api/v1/admin/ai-visibility/events`

The current implementation supports evidence event recording and workspace-scoped listing. The UI can record manual observations. It does **not yet** connect to server/CDN logs, Google Search Console, Bing Webmaster Tools, or live AI answer monitoring. Those require authorized provider connections and should be implemented as separate adapters.

## Evidence event schema

- `workspaceId`, optional `articleId`, `url`
- `eventType`: `crawler_fetch | search_index_verified | citation_verified | training_attestation | referral_visit`
- `provider`, `botName`, `botPurpose`
- `observedAt`, `source`
- `evidenceUrl`, `evidenceNote`
- `verified`, `verificationMethod`

Workspace scope is enforced. Only verified indexing/citation/training records with evidence are counted as verified.

## Remaining implementation

1. Connect logs for user-owned publication domains and validate bot IPs.
2. Add Google Search Console OAuth integration and URL Inspection adapter.
3. Add Bing Webmaster integration if API access is available.
4. Add controlled AI citation sampling with saved query, answer, source URL, timestamp, and screenshot.
5. Add per-publication access ownership and connection status; third-party magazines remain manual unless they grant access.
6. Add a data-retention and evidence review policy.
7. Add alerting for crawler errors, de-indexing, citation loss, and canonical/robots regressions.
8. Add reporting by article, domain, publication, provider, language, and date range.

No paid search/citation sampling or external account connection is performed without explicit approval.
