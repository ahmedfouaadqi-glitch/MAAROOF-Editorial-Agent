# Platform-native social publishing

## Objective

Generate distinct, platform-native assets from one approved editorial source. Preserve the source's verified facts, named entities, brand voice, and intended meaning while adapting structure, tone, length, CTA, hashtags, links, and media format to each selected platform.

## Two independent decisions

1. **Editorial suitability** — does the platform fit the brand, audience, geography, language, campaign objective, and available creative assets?
2. **Technical publishability** — can this workspace actually publish this content type through an authorized, implemented, currently valid adapter?

Never conflate a platform being a good fit with it being technically publishable.

## Initial platform catalogue

The initial social publishing candidates are LinkedIn, Facebook Pages, Instagram, X, Threads, TikTok, YouTube, and Pinterest. They are candidates, not claims of active integration. Their adapter status remains `adapter_not_implemented` until implementation, account authorization, platform capability checks, and end-to-end verification are complete.

Platforms such as Reddit, Quora, Stack Exchange, Wikipedia, arXiv, PubMed Central, GitHub, Common Crawl, and Hugging Face Datasets must not be treated as generic promotional social channels. They require separate, purpose-specific contribution workflows and policy checks.

## Platform-native editorial profiles

| Platform | Native content approach | Typical structure |
|---|---|---|
| LinkedIn | Professional insight and evidence-led thought leadership | Hook → context → insight/evidence → implication → professional discussion |
| Facebook Pages | Accessible community and explanatory content | Relevance → useful explanation/story → community prompt or next step |
| Instagram | Visual-first storytelling | Visual hook → concise complementary caption → context → save/share/comment CTA |
| X | Direct, timely, compact commentary | Main point → evidence/context → optional thread → focused prompt |
| Threads | Conversational, discussion-led | Observation/question → short connected thoughts → authentic invitation to reply |
| TikTok | Native short-video storytelling | Opening hook → scene/shot plan → spoken script/on-screen text → one CTA |
| YouTube | Searchable, structured video content | Viewer promise → title/thumbnail → outline/script → description/chapters → next step |
| Pinterest | Descriptive, evergreen discovery content | Clear topic/benefit → keyword-aware description → vertical creative → destination |

These are editorial defaults, not fixed algorithmic rules. The generator must use brand analytics and current platform constraints where available.

## Generation contract

For every selected platform, create a separate variant with:

- platform ID and intended placement (feed, reel, story, short, video, pin, article, thread, etc.);
- audience and objective;
- localized language and dialect choice where explicitly configured;
- platform-specific hook, body, CTA, hashtags, and link treatment;
- media requirements, aspect ratio, safe areas, thumbnail/cover, captions/subtitles, alt text, and accessibility notes;
- character/format validation against a versioned capability profile;
- provenance links to the approved source article and evidence;
- originality check against other variants to prevent repetitive cross-posting;
- approval state and publication state.

The platform adaptation must not invent facts, change numerical claims, remove material caveats, or imply endorsements. GEO entities and target phrases must be integrated naturally; no keyword stuffing or fabricated brand mentions.

## Selection and publishing gates

A platform is selectable for drafting when editorial suitability is established. A platform is selectable for direct publishing only when all are true:

1. The adapter is implemented and tested for the requested content type.
2. The account is authorized and belongs to the intended workspace/brand.
3. Current platform permissions, API access, media limits, and policy constraints are checked.
4. The user has approved the exact content and media package.
5. The publishing job has an idempotency key and a defined verification step.

Default state is draft-only. If API publishing is unavailable, present a manual handoff/export package. Browser automation is not a universal fallback: use it only when allowed by platform terms and account controls, with CAPTCHA/MFA requiring user handoff.

A click on Publish is not proof of publication. Verify the resulting platform object or public URL, persist the external ID, timestamp, final URL, and verification evidence. If verification is inconclusive, report `submitted_unverified`, not `published`.

## Media adaptation

Do not stretch one image to every placement. Preserve the original asset and generate placement-specific crops/variants. Validate safe areas and overlays for vertical video, create a distinct thumbnail/cover where required, and retain alt text/captions/subtitles. Record source, license/rights, and user approval for each asset.

## Measurement and learning

Store performance by platform, format, objective, audience, and publication window. Compare each platform against its own baseline; do not compare raw engagement rates across networks as if definitions were identical. Use measured outcomes to update brand-specific guidance, not to hard-code universal claims about algorithms.

## Alexandria / research-provider boundary

Firecrawl Alexandria, if enabled later, is an optional research-data provider behind the Research Engine. It is not a social publishing adapter, does not grant account permissions, and does not establish that a platform can be published to. Discover capabilities before execution, display capability costs, enforce admin quotas, and do not execute paid capabilities without explicit authorization.

## Current implementation status

The API can create and list draft-only platform variants for the eight social platforms using a separate, explicitly enabled OpenAI-compatible provider. Each variant carries the source draft timestamp and review limitations. Video variants may contain a script, on-screen text, shot plan and media brief. Users can upload scoped image/video files; platform adaptation receives their descriptions only and returns selected asset IDs, without sending file bytes to the model.

Media files currently live on local disk with per-file and total size limits; this is not production object storage, media analysis, or transformation. A generic user-controlled browser handoff now lets an operator declare an authorized destination, sign in through an interactive screenshot, and fill an already-approved article for manual review. This is not a platform-specific adapter or persistent account connection: it does not attach media, automate submission/publication, or verify an external result. The catalogue does not mean any social account is connected or any platform API is integrated. The application must display real adapter and authorization status rather than infer readiness from this catalogue. There is no MAAROOF AI integration or data exchange.
