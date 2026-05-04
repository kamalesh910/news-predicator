-- =============================================================================
-- init-db/02_seed.sql
-- =============================================================================
-- Seeds 5 realistic articles + bias records + burst events + trend forecasts
-- so the dashboard has data to display immediately on first start.
--
-- This file is auto-executed by the postgres Docker image after 01_schema.sql
-- (files in /docker-entrypoint-initdb.d/ run in alphabetical order).
--
-- All UUIDs are fixed so re-running is idempotent (ON CONFLICT DO NOTHING).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Seed articles
-- ---------------------------------------------------------------------------
INSERT INTO articles (article_id, source_url, title, body, source_name, published_at, schema_version)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'https://example.com/energy-policy-reform',
    'Energy Policy Reform Gains Momentum Across South Asia',
    'Governments across South Asia are accelerating energy policy reforms, with India and Pakistan announcing joint renewable energy targets. Analysts say the shift could reduce regional carbon emissions by 30% over the next decade. Critics argue implementation timelines remain unrealistic.',
    'NewsAPI',
    NOW() - INTERVAL '10 minutes',
    '1.0'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'https://example.com/regional-conflict',
    'Regional Conflict Escalation Raises Diplomatic Concerns',
    'Tensions along the eastern border have escalated following a series of skirmishes, prompting emergency diplomatic talks. International observers warn that without immediate de-escalation, the situation could destabilise regional trade routes. Military analysts are monitoring troop movements closely.',
    'SocialStream',
    NOW() - INTERVAL '8 minutes',
    '1.0'
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'https://example.com/tech-layoffs',
    'Tech Sector Layoff Rumors Spark Market Volatility',
    'Unconfirmed reports of large-scale layoffs at several major technology firms have triggered a sell-off in tech stocks. Industry insiders suggest the cuts are part of a broader restructuring driven by AI automation. Employee unions are calling for transparency from company leadership.',
    'NewsAPI',
    NOW() - INTERVAL '6 minutes',
    '1.0'
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'https://example.com/climate-infrastructure',
    'Climate Infrastructure Investment Reaches Record High',
    'Global investment in climate-resilient infrastructure surpassed $2 trillion for the first time, according to a new report from the International Energy Agency. Solar and wind projects account for the majority of spending, with grid modernisation emerging as the fastest-growing segment.',
    'NewsAPI',
    NOW() - INTERVAL '4 minutes',
    '1.0'
  ),
  (
    'a1000000-0000-0000-0000-000000000005',
    'https://example.com/cyber-threat-alert',
    'Cyber Threat Actors Target Critical Infrastructure Networks',
    'Security researchers have identified a coordinated campaign targeting power grid control systems across multiple countries. The attacks, attributed to a state-sponsored group, exploited zero-day vulnerabilities in industrial control software. Affected nations have raised their cyber alert levels to critical.',
    'SocialStream',
    NOW() - INTERVAL '2 minutes',
    '1.0'
  )
ON CONFLICT (article_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed bias records (one per article)
-- ---------------------------------------------------------------------------
INSERT INTO bias_records (record_id, article_id, bias_score, bias_label, error_flag)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 0.38, 'elevated', false),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 0.74, 'biased',   false),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 0.21, 'neutral',  false),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 0.15, 'neutral',  false),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 0.82, 'biased',   false)
ON CONFLICT (record_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed burst events (one per topic+platform pair)
-- ---------------------------------------------------------------------------
INSERT INTO burst_events
  (event_id, topic_name, platform, article_count, avg_bias_score, trend_direction,
   window_start, window_end, detection_timestamp)
VALUES
  (
    'e1000000-0000-0000-0000-000000000001',
    'Energy Policy Reform', 'NewsAPI', 12, 0.38, '↑',
    NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'Regional Conflict Escalation', 'SocialStream', 27, 0.74, '↑',
    NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'Tech Layoff Rumors', 'NewsAPI', 8, 0.21, '→',
    NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'Climate Infrastructure Investment', 'NewsAPI', 19, 0.15, '↑',
    NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'
  ),
  (
    'e1000000-0000-0000-0000-000000000005',
    'Cyber Threat Alert', 'SocialStream', 34, 0.82, '↑',
    NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'
  )
ON CONFLICT (event_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed trend forecasts (one per topic+platform pair)
-- ---------------------------------------------------------------------------
INSERT INTO trend_forecasts
  (forecast_id, topic_name, platform, predicted_volume, confidence_score,
   avg_bias_score, trend_direction, forecast_horizon)
VALUES
  (
    'f1000000-0000-0000-0000-000000000001',
    'Energy Policy Reform', 'NewsAPI', 14, 0.72, 0.38, '↑',
    NOW() + INTERVAL '1 hour'
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'Regional Conflict Escalation', 'SocialStream', 31, 0.91, 0.74, '↑',
    NOW() + INTERVAL '1 hour'
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'Tech Layoff Rumors', 'NewsAPI', 8, 0.48, 0.21, '→',
    NOW() + INTERVAL '1 hour'
  ),
  (
    'f1000000-0000-0000-0000-000000000004',
    'Climate Infrastructure Investment', 'NewsAPI', 22, 0.85, 0.15, '↑',
    NOW() + INTERVAL '1 hour'
  ),
  (
    'f1000000-0000-0000-0000-000000000005',
    'Cyber Threat Alert', 'SocialStream', 40, 0.95, 0.82, '↑',
    NOW() + INTERVAL '1 hour'
  )
ON CONFLICT (forecast_id) DO NOTHING;
