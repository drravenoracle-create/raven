UPDATE blog_engine_settings
SET
  enabled = 1,
  auto_post_enabled = 1,
  kill_switch = 0,
  schedule_json = '{"weekdays":[0,1,2,3,4,5,6],"draft_time":"13:00","publish_time":"17:00","times":["17:00"],"max_posts_per_day":1,"max_posts_per_week":7,"minimum_interval_minutes":240,"daily_series":[{"id":"homepage-benefits","title":"占い師がホームページを持つメリット","category":"占い師がホームページを持つメリット","draft_time":"13:00","publish_time":"17:00","frequency":"daily","enabled":true}]}',
  category_ratios_json = '{"今日の運勢":15,"占術解説":20,"恋愛と人間関係":15,"意思決定と人生相談":15,"東洋占術":20,"レイヴン・ブラックウッドの世界観":5,"初心者向け解説":10}',
  guardrails_json = '{"prohibited":["恐怖訴求","依存誘導","未来の断定","誇大広告"],"principle":"占いは未来を決めつけるものではなく、未来を選ぶ助けとして扱う。"}',
  automation_levels_json = '{"analytics_collection":true,"recommendation_generation":true,"article_generation":true,"refresh_generation":false,"internal_link_application":false,"schedule_optimization":false,"auto_publish":true}',
  updated_at = CURRENT_TIMESTAMP
WHERE tenant_id = 'raven-oracle';

UPDATE blog_engine_optimization_guard
SET
  enabled = 1,
  locked_settings_json = '{"brand_principle":"占いは未来を決めつけるものではなく、未来を選ぶ助けとして扱う。","human_override":true,"approval_required_for_high_risk":true}',
  updated_at = CURRENT_TIMESTAMP
WHERE tenant_id = 'raven-oracle';
