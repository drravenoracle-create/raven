ALTER TABLE sns_automation_settings ADD COLUMN schedule_json TEXT NOT NULL DEFAULT '{"windows":[{"start":"01:00","end":"07:00"},{"start":"13:00","end":"17:00"}],"timezone":"Asia/Tokyo"}';

UPDATE sns_automation_settings
SET schedule_json = '{"windows":[{"start":"01:00","end":"07:00"},{"start":"13:00","end":"17:00"}],"timezone":"Asia/Tokyo"}',
    automation_level = 1,
    emergency_stop_all = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE tenant_id = 'raven-oracle';

-- Rollback / recovery:
-- SQLite/D1 cannot drop columns safely without rebuilding the table.
-- To disable scheduled SNS automation, set automation_level = 0 or emergency_stop_all = 1.
