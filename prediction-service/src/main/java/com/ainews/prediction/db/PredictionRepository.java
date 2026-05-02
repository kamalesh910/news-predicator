package com.ainews.prediction.db;

import com.ainews.prediction.model.BurstEvent;
import com.ainews.prediction.model.TrendForecast;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * JDBC-based repository for persisting {@link BurstEvent} and {@link TrendForecast} records
 * to PostgreSQL.
 *
 * <p>Both write methods implement a manual retry loop with exponential backoff:
 * up to 3 retries (4 total attempts). After all retries are exhausted, a persistent
 * failure is logged and the exception is re-thrown so the caller can decide how to handle it.
 *
 * <p>All SQL uses parameterized {@link PreparedStatement}s — no string interpolation —
 * to prevent SQL injection.
 *
 * <p>Satisfies Requirements 5.5, 10.2, 10.5
 */
public class PredictionRepository {

    private static final Logger LOGGER = Logger.getLogger(PredictionRepository.class.getName());

    /** Maximum number of retry attempts after the initial failure. */
    private static final int MAX_RETRIES = 3;

    /** Base delay in milliseconds for exponential backoff (doubles each retry). */
    private static final long BASE_BACKOFF_MS = 200L;

    // -------------------------------------------------------------------------
    // SQL statements
    // -------------------------------------------------------------------------

    /**
     * INSERT for the {@code burst_events} table.
     * Columns: event_id, topic_name, article_count, window_start, window_end,
     *          detection_timestamp
     */
    private static final String INSERT_BURST_EVENT = """
            INSERT INTO burst_events
                (event_id, topic_name, article_count, window_start, window_end, detection_timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (event_id) DO NOTHING
            """;

    /**
     * INSERT for the {@code trend_forecasts} table.
     * Columns: forecast_id, topic_name, predicted_volume, confidence_score, forecast_horizon
     */
    private static final String INSERT_TREND_FORECAST = """
            INSERT INTO trend_forecasts
                (forecast_id, topic_name, predicted_volume, confidence_score, forecast_horizon)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (forecast_id) DO NOTHING
            """;

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /** JDBC connection URL (e.g. {@code jdbc:postgresql://postgres:5432/ainews}). */
    private final String jdbcUrl;

    /** PostgreSQL username. */
    private final String username;

    /** PostgreSQL password. */
    private final String password;

    /**
     * Constructs a {@code PredictionRepository} with the given JDBC connection parameters.
     *
     * @param jdbcUrl  JDBC connection URL for the PostgreSQL database
     * @param username database username
     * @param password database password
     */
    public PredictionRepository(String jdbcUrl, String username, String password) {
        this.jdbcUrl = jdbcUrl;
        this.username = username;
        this.password = password;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Persists a {@link BurstEvent} to the {@code burst_events} table.
     *
     * <p>Retries up to {@value #MAX_RETRIES} times with exponential backoff on transient
     * {@link SQLException}s. Logs a persistent failure warning after all retries are
     * exhausted and re-throws the last exception.
     *
     * @param event the burst event to persist; must not be {@code null}
     * @throws SQLException      if all retry attempts fail
     * @throws RuntimeException  if the retry sleep is interrupted
     */
    public void saveBurstEvent(BurstEvent event) throws SQLException {
        if (event == null) {
            throw new IllegalArgumentException("BurstEvent must not be null");
        }

        SQLException lastException = null;

        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                long backoffMs = BASE_BACKOFF_MS * (1L << (attempt - 1)); // 200, 400, 800 ms
                LOGGER.warning(String.format(
                        "Retrying saveBurstEvent for eventId=%s (attempt %d/%d) after %d ms",
                        event.getEventId(), attempt, MAX_RETRIES, backoffMs));
                sleep(backoffMs);
            }

            try (Connection conn = openConnection();
                 PreparedStatement ps = conn.prepareStatement(INSERT_BURST_EVENT)) {

                ps.setObject(1, parseUuid(event.getEventId()));
                ps.setString(2, event.getTopicName());
                ps.setInt(3, event.getArticleCount());
                ps.setTimestamp(4, parseTimestamp(event.getWindowStart()));
                ps.setTimestamp(5, parseTimestamp(event.getWindowEnd()));
                ps.setTimestamp(6, parseTimestamp(event.getDetectionTimestamp()));

                ps.executeUpdate();

                LOGGER.fine(String.format(
                        "Persisted BurstEvent: eventId=%s, topic=%s",
                        event.getEventId(), event.getTopicName()));
                return; // success — exit retry loop

            } catch (SQLException e) {
                lastException = e;
                LOGGER.log(Level.WARNING,
                        String.format("saveBurstEvent attempt %d failed for eventId=%s: %s",
                                attempt + 1, event.getEventId(), e.getMessage()), e);
            }
        }

        // All retries exhausted
        LOGGER.log(Level.SEVERE,
                String.format(
                        "Persistent failure: saveBurstEvent exhausted all %d retries for eventId=%s",
                        MAX_RETRIES, event.getEventId()),
                lastException);
        throw lastException;
    }

    /**
     * Persists a {@link TrendForecast} to the {@code trend_forecasts} table.
     *
     * <p>Retries up to {@value #MAX_RETRIES} times with exponential backoff on transient
     * {@link SQLException}s. Logs a persistent failure warning after all retries are
     * exhausted and re-throws the last exception.
     *
     * @param forecast the trend forecast to persist; must not be {@code null}
     * @throws SQLException      if all retry attempts fail
     * @throws RuntimeException  if the retry sleep is interrupted
     */
    public void saveTrendForecast(TrendForecast forecast) throws SQLException {
        if (forecast == null) {
            throw new IllegalArgumentException("TrendForecast must not be null");
        }

        SQLException lastException = null;

        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                long backoffMs = BASE_BACKOFF_MS * (1L << (attempt - 1)); // 200, 400, 800 ms
                LOGGER.warning(String.format(
                        "Retrying saveTrendForecast for forecastId=%s (attempt %d/%d) after %d ms",
                        forecast.getForecastId(), attempt, MAX_RETRIES, backoffMs));
                sleep(backoffMs);
            }

            try (Connection conn = openConnection();
                 PreparedStatement ps = conn.prepareStatement(INSERT_TREND_FORECAST)) {

                ps.setObject(1, parseUuid(forecast.getForecastId()));
                ps.setString(2, forecast.getTopicName());
                ps.setDouble(3, forecast.getPredictedVolume());
                ps.setDouble(4, forecast.getConfidenceScore());
                ps.setTimestamp(5, parseTimestamp(forecast.getForecastHorizon()));

                ps.executeUpdate();

                LOGGER.fine(String.format(
                        "Persisted TrendForecast: forecastId=%s, topic=%s",
                        forecast.getForecastId(), forecast.getTopicName()));
                return; // success — exit retry loop

            } catch (SQLException e) {
                lastException = e;
                LOGGER.log(Level.WARNING,
                        String.format("saveTrendForecast attempt %d failed for forecastId=%s: %s",
                                attempt + 1, forecast.getForecastId(), e.getMessage()), e);
            }
        }

        // All retries exhausted
        LOGGER.log(Level.SEVERE,
                String.format(
                        "Persistent failure: saveTrendForecast exhausted all %d retries for forecastId=%s",
                        MAX_RETRIES, forecast.getForecastId()),
                lastException);
        throw lastException;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Opens a new JDBC connection using the configured URL, username, and password.
     *
     * @return an open {@link Connection}
     * @throws SQLException if the connection cannot be established
     */
    private Connection openConnection() throws SQLException {
        return DriverManager.getConnection(jdbcUrl, username, password);
    }

    /**
     * Parses an ISO 8601 timestamp string into a {@link Timestamp} suitable for JDBC.
     *
     * @param iso8601 ISO 8601 timestamp string (e.g. {@code "2024-01-15T10:30:00Z"})
     * @return corresponding {@link Timestamp}
     * @throws IllegalArgumentException if the string cannot be parsed
     */
    private static Timestamp parseTimestamp(String iso8601) {
        if (iso8601 == null || iso8601.isBlank()) {
            throw new IllegalArgumentException("Timestamp string must not be null or blank");
        }
        return Timestamp.from(Instant.parse(iso8601));
    }

    /**
     * Parses a UUID string into a {@link java.util.UUID} for use with JDBC's
     * {@link PreparedStatement#setObject(int, Object)}.
     *
     * @param uuidString UUID string (e.g. {@code "550e8400-e29b-41d4-a716-446655440000"})
     * @return parsed {@link java.util.UUID}
     * @throws IllegalArgumentException if the string is not a valid UUID
     */
    private static java.util.UUID parseUuid(String uuidString) {
        if (uuidString == null || uuidString.isBlank()) {
            throw new IllegalArgumentException("UUID string must not be null or blank");
        }
        return java.util.UUID.fromString(uuidString);
    }

    /**
     * Sleeps for the given number of milliseconds, wrapping {@link InterruptedException}
     * in a {@link RuntimeException} and restoring the interrupt flag.
     *
     * @param millis duration to sleep in milliseconds
     */
    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Retry sleep interrupted", ie);
        }
    }
}
