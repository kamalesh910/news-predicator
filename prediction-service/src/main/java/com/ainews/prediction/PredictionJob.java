package com.ainews.prediction;

import com.ainews.prediction.db.PredictionRepository;
import com.ainews.prediction.health.HealthServer;
import com.ainews.prediction.kafka.KafkaSinkConfig;
import com.ainews.prediction.kafka.KafkaSourceConfig;
import com.ainews.prediction.model.AnalyzedNewsMessage;
import com.ainews.prediction.model.BurstEvent;
import com.ainews.prediction.model.TrendForecast;
import com.ainews.prediction.operators.BurstDetectionOperator;
import com.ainews.prediction.operators.TrendForecastOperator;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.datastream.SingleOutputStreamOperator;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.sink.SinkFunction;
import org.apache.flink.streaming.api.windowing.assigners.TumblingProcessingTimeWindows;
import org.apache.flink.streaming.api.windowing.time.Time;

import java.sql.SQLException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Main entry point for the Prediction_Service Apache Flink job.
 *
 * <p>Wires the full streaming pipeline:
 * <ol>
 *   <li>Reads {@link AnalyzedNewsMessage} records from the {@code analyzed-news} Kafka topic.</li>
 *   <li>Filters out null records (malformed / deserialization failures).</li>
 *   <li>Keys by {@code topicName} and applies a tumbling processing-time window.</li>
 *   <li>Runs {@link BurstDetectionOperator} → publishes {@link BurstEvent} to Kafka and
 *       persists to PostgreSQL.</li>
 *   <li>Runs {@link TrendForecastOperator} → publishes {@link TrendForecast} to Kafka and
 *       persists to PostgreSQL.</li>
 * </ol>
 *
 * <p>A lightweight {@link HealthServer} is started in a background thread before the Flink
 * job is submitted, exposing {@code GET /health} on the configured port.
 *
 * <p>All configuration is read from environment variables:
 * <ul>
 *   <li>{@code KAFKA_BROKERS} — comma-separated Kafka broker addresses</li>
 *   <li>{@code POSTGRES_HOST} — PostgreSQL hostname</li>
 *   <li>{@code POSTGRES_PORT} — PostgreSQL port (default {@code 5432})</li>
 *   <li>{@code POSTGRES_DB}   — PostgreSQL database name</li>
 *   <li>{@code POSTGRES_USER} — PostgreSQL username</li>
 *   <li>{@code POSTGRES_PASSWORD} — PostgreSQL password</li>
 *   <li>{@code BURST_THRESHOLD} — article count threshold for burst detection (default {@code 50})</li>
 *   <li>{@code BURST_WINDOW_MS} — window size in milliseconds (default {@code 60000})</li>
 *   <li>{@code HEALTH_PORT} — HTTP health server port (default {@code 8080})</li>
 * </ul>
 *
 * <p>Satisfies Requirements 5.7, 12.3, 12.6, 12.7
 */
public class PredictionJob {

    private static final Logger LOGGER = Logger.getLogger(PredictionJob.class.getName());

    // -------------------------------------------------------------------------
    // Environment variable names
    // -------------------------------------------------------------------------

    private static final String ENV_KAFKA_BROKERS      = "KAFKA_BROKERS";
    private static final String ENV_POSTGRES_HOST      = "POSTGRES_HOST";
    private static final String ENV_POSTGRES_PORT      = "POSTGRES_PORT";
    private static final String ENV_POSTGRES_DB        = "POSTGRES_DB";
    private static final String ENV_POSTGRES_USER      = "POSTGRES_USER";
    private static final String ENV_POSTGRES_PASSWORD  = "POSTGRES_PASSWORD";
    private static final String ENV_BURST_THRESHOLD    = "BURST_THRESHOLD";
    private static final String ENV_BURST_WINDOW_MS    = "BURST_WINDOW_MS";
    private static final String ENV_HEALTH_PORT        = "HEALTH_PORT";

    // -------------------------------------------------------------------------
    // Defaults
    // -------------------------------------------------------------------------

    private static final String DEFAULT_KAFKA_BROKERS   = "kafka:9092";
    private static final String DEFAULT_POSTGRES_HOST   = "postgres";
    private static final String DEFAULT_POSTGRES_PORT   = "5432";
    private static final String DEFAULT_POSTGRES_DB     = "ainews";
    private static final String DEFAULT_POSTGRES_USER   = "ainews";
    private static final String DEFAULT_POSTGRES_PASSWORD = "ainews";
    private static final int    DEFAULT_BURST_THRESHOLD = 50;
    private static final long   DEFAULT_BURST_WINDOW_MS = 60_000L;
    private static final int    DEFAULT_HEALTH_PORT     = 8080;

    // -------------------------------------------------------------------------
    // Entry point
    // -------------------------------------------------------------------------

    /**
     * Application entry point.
     *
     * @param args command-line arguments (unused; all config via environment variables)
     * @throws Exception if the Flink job fails to start or execute
     */
    public static void main(String[] args) throws Exception {

        // ------------------------------------------------------------------
        // 1. Read configuration from environment variables
        // ------------------------------------------------------------------
        String kafkaBrokers = getEnv(ENV_KAFKA_BROKERS, DEFAULT_KAFKA_BROKERS);
        String postgresHost = getEnv(ENV_POSTGRES_HOST, DEFAULT_POSTGRES_HOST);
        int    postgresPort = getEnvInt(ENV_POSTGRES_PORT, Integer.parseInt(DEFAULT_POSTGRES_PORT));
        String postgresDb   = getEnv(ENV_POSTGRES_DB, DEFAULT_POSTGRES_DB);
        String postgresUser = getEnv(ENV_POSTGRES_USER, DEFAULT_POSTGRES_USER);
        String postgresPass = getEnv(ENV_POSTGRES_PASSWORD, DEFAULT_POSTGRES_PASSWORD);
        int    burstThreshold = getEnvInt(ENV_BURST_THRESHOLD, DEFAULT_BURST_THRESHOLD);
        long   burstWindowMs  = getEnvLong(ENV_BURST_WINDOW_MS, DEFAULT_BURST_WINDOW_MS);
        int    healthPort     = getEnvInt(ENV_HEALTH_PORT, DEFAULT_HEALTH_PORT);

        // ------------------------------------------------------------------
        // 2. Build JDBC URL and repository
        // ------------------------------------------------------------------
        String jdbcUrl = String.format(
                "jdbc:postgresql://%s:%d/%s", postgresHost, postgresPort, postgresDb);

        // ------------------------------------------------------------------
        // 3. Start health server in a background thread (Req 5.7, 12.3)
        // ------------------------------------------------------------------
        HealthServer healthServer = new HealthServer(healthPort);
        Thread healthThread = new Thread(() -> {
            try {
                healthServer.start();
            } catch (Exception e) {
                LOGGER.log(Level.SEVERE, "HealthServer failed to start: " + e.getMessage(), e);
            }
        }, "health-server-thread");
        healthThread.setDaemon(true);
        healthThread.start();

        // ------------------------------------------------------------------
        // 4. Emit structured startup log (Req 12.7)
        // ------------------------------------------------------------------
        LOGGER.info(String.format(
                "{\"event\":\"startup\",\"service\":\"prediction-service\","
                + "\"kafkaBrokers\":\"%s\",\"postgresHost\":\"%s\",\"postgresPort\":%d,"
                + "\"postgresDb\":\"%s\",\"burstThreshold\":%d,\"burstWindowMs\":%d,"
                + "\"healthPort\":%d}",
                kafkaBrokers, postgresHost, postgresPort, postgresDb,
                burstThreshold, burstWindowMs, healthPort));

        // ------------------------------------------------------------------
        // 5. Build Flink StreamExecutionEnvironment
        // ------------------------------------------------------------------
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // ------------------------------------------------------------------
        // 6. Build Kafka source and sink
        // ------------------------------------------------------------------
        KafkaSource<AnalyzedNewsMessage> kafkaSource =
                new KafkaSourceConfig(kafkaBrokers, "prediction-service-group").build();

        KafkaSink<Object> kafkaSink =
                new KafkaSinkConfig(kafkaBrokers).build();

        // ------------------------------------------------------------------
        // 7. Ingest stream: read from Kafka, filter nulls, key by topicName
        // ------------------------------------------------------------------
        DataStream<AnalyzedNewsMessage> analyzedStream = env
                .fromSource(kafkaSource, WatermarkStrategy.noWatermarks(), "analyzed-news-source")
                .filter(msg -> msg != null)
                .name("filter-nulls");

        // Window size derived from BURST_WINDOW_MS (converted to seconds, minimum 1s)
        long windowSeconds = Math.max(1L, burstWindowMs / 1000L);

        // ------------------------------------------------------------------
        // 8. Burst detection pipeline
        //    KafkaSource → filter → keyBy topicName → window → BurstDetectionOperator
        //    → KafkaSink + PostgreSQL sink
        // ------------------------------------------------------------------
        SingleOutputStreamOperator<BurstEvent> burstStream = analyzedStream
                .keyBy(AnalyzedNewsMessage::getSourceName)
                .window(TumblingProcessingTimeWindows.of(Time.seconds(windowSeconds)))
                .process(new BurstDetectionOperator(burstThreshold, burstWindowMs))
                .name("burst-detection");

        // Publish BurstEvents to Kafka predictions topic
        burstStream
                .map(event -> (Object) event)
                .name("burst-to-object")
                .sinkTo(kafkaSink)
                .name("burst-kafka-sink");

        // Persist BurstEvents to PostgreSQL
        burstStream.addSink(new BurstEventSink(jdbcUrl, postgresUser, postgresPass))
                .name("burst-postgres-sink");

        // ------------------------------------------------------------------
        // 9. Trend forecast pipeline
        //    KafkaSource → filter → keyBy topicName → window → TrendForecastOperator
        //    → KafkaSink + PostgreSQL sink
        // ------------------------------------------------------------------
        // Baseline volume: same as burst threshold (reasonable default)
        SingleOutputStreamOperator<TrendForecast> forecastStream = analyzedStream
                .keyBy(AnalyzedNewsMessage::getSourceName)
                .window(TumblingProcessingTimeWindows.of(Time.seconds(windowSeconds)))
                .process(new TrendForecastOperator(burstThreshold))
                .name("trend-forecast");

        // Publish TrendForecasts to Kafka predictions topic
        forecastStream
                .map(forecast -> (Object) forecast)
                .name("forecast-to-object")
                .sinkTo(kafkaSink)
                .name("forecast-kafka-sink");

        // Persist TrendForecasts to PostgreSQL
        forecastStream.addSink(new TrendForecastSink(jdbcUrl, postgresUser, postgresPass))
                .name("forecast-postgres-sink");

        // ------------------------------------------------------------------
        // 10. Execute the Flink job (blocking call)
        // ------------------------------------------------------------------
        LOGGER.info("{\"event\":\"flink-job-submit\",\"service\":\"prediction-service\","
                + "\"jobName\":\"prediction-service\"}");

        env.execute("prediction-service");
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Reads an environment variable, returning {@code defaultValue} if not set or blank.
     *
     * @param name         environment variable name
     * @param defaultValue fallback value
     * @return the environment variable value, or {@code defaultValue}
     */
    private static String getEnv(String name, String defaultValue) {
        String value = System.getenv(name);
        return (value != null && !value.isBlank()) ? value : defaultValue;
    }

    /**
     * Reads an environment variable as an {@code int}, returning {@code defaultValue}
     * if not set, blank, or not parseable.
     *
     * @param name         environment variable name
     * @param defaultValue fallback value
     * @return the parsed integer value, or {@code defaultValue}
     */
    private static int getEnvInt(String name, int defaultValue) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            LOGGER.warning(String.format(
                    "Invalid integer value for env var %s='%s'; using default %d",
                    name, value, defaultValue));
            return defaultValue;
        }
    }

    /**
     * Reads an environment variable as a {@code long}, returning {@code defaultValue}
     * if not set, blank, or not parseable.
     *
     * @param name         environment variable name
     * @param defaultValue fallback value
     * @return the parsed long value, or {@code defaultValue}
     */
    private static long getEnvLong(String name, long defaultValue) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            LOGGER.warning(String.format(
                    "Invalid long value for env var %s='%s'; using default %d",
                    name, value, defaultValue));
            return defaultValue;
        }
    }

    // -------------------------------------------------------------------------
    // Serializable Flink sink functions for PostgreSQL persistence
    // -------------------------------------------------------------------------

    /** Serializable Flink SinkFunction that persists BurstEvent records to PostgreSQL. */
    private static final class BurstEventSink implements SinkFunction<BurstEvent>, java.io.Serializable {
        private static final long serialVersionUID = 1L;
        private final String jdbcUrl;
        private final String user;
        private final String password;

        BurstEventSink(String jdbcUrl, String user, String password) {
            this.jdbcUrl = jdbcUrl;
            this.user = user;
            this.password = password;
        }

        @Override
        public void invoke(BurstEvent event, Context context) {
            try {
                new PredictionRepository(jdbcUrl, user, password).saveBurstEvent(event);
            } catch (Exception e) {
                LOGGER.log(Level.SEVERE,
                        String.format("{\"event\":\"error\",\"service\":\"prediction-service\","
                                + "\"errorType\":\"%s\",\"errorMessage\":\"%s\",\"eventId\":\"%s\"}",
                                e.getClass().getSimpleName(), e.getMessage(), event.getEventId()), e);
            }
        }
    }

    /** Serializable Flink SinkFunction that persists TrendForecast records to PostgreSQL. */
    private static final class TrendForecastSink implements SinkFunction<TrendForecast>, java.io.Serializable {
        private static final long serialVersionUID = 1L;
        private final String jdbcUrl;
        private final String user;
        private final String password;

        TrendForecastSink(String jdbcUrl, String user, String password) {
            this.jdbcUrl = jdbcUrl;
            this.user = user;
            this.password = password;
        }

        @Override
        public void invoke(TrendForecast forecast, Context context) {
            try {
                new PredictionRepository(jdbcUrl, user, password).saveTrendForecast(forecast);
            } catch (Exception e) {
                LOGGER.log(Level.SEVERE,
                        String.format("{\"event\":\"error\",\"service\":\"prediction-service\","
                                + "\"errorType\":\"%s\",\"errorMessage\":\"%s\",\"forecastId\":\"%s\"}",
                                e.getClass().getSimpleName(), e.getMessage(), forecast.getForecastId()), e);
            }
        }
    }
}
