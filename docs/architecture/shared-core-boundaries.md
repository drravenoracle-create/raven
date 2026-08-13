# Shared Core Boundaries

## Shared Core

- Tarot/card definitions and draw logic.
- AI prompt builder and response schema.
- Safety rules and high-risk classifier.
- Analytics event wrappers.
- Authentication and account helpers.
- STORES payment/ticket integration when approved.
- Common UI primitives.

## Site Config

- `site_id`
- `character_id`
- `site_name`
- `domain`
- `theme`
- `persona_id`
- `enabled_features`
- `free_reading_limit`
- `ai_model`
- `blog_categories`
- `line`
- `stores_product_mapping`
- `analytics`

## Raven Current Config

Raven currently uses:

- `config/personas/raven-oracle.json`
- `config/hearing-sheets/raven-oracle.json`
- `.env.example` for per-site key names