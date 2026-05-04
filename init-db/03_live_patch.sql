-- Live patch: create trending_topics view and seed data
-- Run this against a running postgres container:
--   docker exec -i postgres psql -U ainews_user -d ainews -f /tmp/03_live_patch.sql

CREATE OR REPLACE VIEW trending_topics AS
SELECT
    topic_name,
    platform,
    article_count AS volume,
    avg_bias_score,
    trend_direction,
    CASE
        WHEN avg_bias_score IS NULL  THEN 'stable'
        WHEN avg_bias_score > 0.6    THEN 'critical'
        WHEN avg_bias_score > 0.3    THEN 'elevated'
        ELSE                              'stable'
    END AS risk_level,
    detection_timestamp AS updated_at
FROM (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY topic_name, platform
               ORDER BY detection_timestamp DESC
           ) AS rn
    FROM burst_events
) ranked
WHERE rn = 1

UNION ALL

SELECT
    ranked2.topic_name,
    ranked2.platform,
    CAST(ranked2.predicted_volume AS INT) AS volume,
    ranked2.avg_bias_score,
    ranked2.trend_direction,
    CASE
        WHEN ranked2.avg_bias_score IS NULL THEN 'stable'
        WHEN ranked2.avg_bias_score > 0.6   THEN 'critical'
        WHEN ranked2.avg_bias_score > 0.3   THEN 'elevated'
        ELSE                                     'stable'
    END AS risk_level,
    ranked2.created_at AS updated_at
FROM (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY topic_name, platform
               ORDER BY created_at DESC
           ) AS rn
    FROM trend_forecasts
) ranked2
WHERE ranked2.rn = 1
  AND NOT EXISTS (
      SELECT 1 FROM burst_events be
      WHERE be.topic_name = ranked2.topic_name
        AND be.platform   = ranked2.platform
  );

-- Seed 5 burst events (idempotent)
INSERT INTO burst_events
    (event_id, topic_name, platform, article_count, avg_bias_score, trend_direction,
     window_start, window_end, detection_timestamp)
VALUES
  ('e1000000-0000-0000-0000-000000000001','Energy Policy Reform','NewsAPI',12,0.38,'↑',NOW()-INTERVAL '15 minutes',NOW()-INTERVAL '5 minutes',NOW()-INTERVAL '5 minutes'),
  ('e1000000-0000-0000-0000-000000000002','Regional Conflict Escalation','SocialStream',27,0.74,'↑',NOW()-INTERVAL '15 minutes',NOW()-INTERVAL '5 minutes',NOW()-INTERVAL '5 minutes'),
  ('e1000000-0000-0000-0000-000000000003','Tech Layoff Rumors','NewsAPI',8,0.21,'→',NOW()-INTERVAL '15 minutes',NOW()-INTERVAL '5 minutes',NOW()-INTERVAL '5 minutes'),
  ('e1000000-0000-0000-0000-000000000004','Climate Infrastructure Investment','NewsAPI',19,0.15,'↑',NOW()-INTERVAL '15 minutes',NOW()-INTERVAL '5 minutes',NOW()-INTERVAL '5 minutes'),
  ('e1000000-0000-0000-0000-000000000005','Cyber Threat Alert','SocialStream',34,0.82,'↑',NOW()-INTERVAL '15 minutes',NOW()-INTERVAL '5 minutes',NOW()-INTERVAL '5 minutes')
ON CONFLICT (event_id) DO NOTHING;

-- Seed 5 trend forecasts (idempotent)
INSERT INTO trend_forecasts
    (forecast_id, topic_name, platform, predicted_volume, confidence_score,
     avg_bias_score, trend_direction, forecast_horizon)
VALUES
  ('f1000000-0000-0000-0000-000000000001','Energy Policy Reform','NewsAPI',14,0.72,0.38,'↑',NOW()+INTERVAL '1 hour'),
  ('f1000000-0000-0000-0000-000000000002','Regional Conflict Escalation','SocialStream',31,0.91,0.74,'↑',NOW()+INTERVAL '1 hour'),
  ('f1000000-0000-0000-0000-000000000003','Tech Layoff Rumors','NewsAPI',8,0.48,0.21,'→',NOW()+INTERVAL '1 hour'),
  ('f1000000-0000-0000-0000-000000000004','Climate Infrastructure Investment','NewsAPI',22,0.85,0.15,'↑',NOW()+INTERVAL '1 hour'),
  ('f1000000-0000-0000-0000-000000000005','Cyber Threat Alert','SocialStream',40,0.95,0.82,'↑',NOW()+INTERVAL '1 hour')
ON CONFLICT (forecast_id) DO NOTHING;
