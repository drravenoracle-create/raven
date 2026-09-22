PRAGMA foreign_keys = ON;
-- Approved migration-state synchronization only; target must be new Luna D1 721248ee-92a5-4fe8-b5af-08503ece8d40.
-- Explicit source tenant: luna-starwind; target tenant: luna-oracle; source article key is intentionally not printed here.
UPDATE blog_engine_articles SET status = 'published', published_at = '2026-08-26 08:00:50' WHERE id = (SELECT CAST(target_id AS INTEGER) FROM studioos_import_ledger WHERE source_table = 'blog_engine_articles' AND source_id = 'b67a6bd3-f3a5-4bce-ad49-67a7b23942f4' AND source_tenant_id = 'luna-starwind' AND target_tenant_id = 'luna-oracle') AND tenant_id = 'luna-oracle' AND status = 'scheduled';
UPDATE studioos_import_ledger SET status = 'status_sync_published' WHERE source_table = 'blog_engine_articles' AND source_id = 'b67a6bd3-f3a5-4bce-ad49-67a7b23942f4' AND source_tenant_id = 'luna-starwind' AND target_tenant_id = 'luna-oracle' AND status = 'imported';
-- Re-running this file is a no-op because the target predicate requires status='scheduled' and ledger status='imported'.
