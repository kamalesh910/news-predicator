package com.ainews.prediction.kafka;

import com.ainews.prediction.model.AnalyzedNewsMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.api.common.serialization.DeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;

import java.io.IOException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Factory for the Flink Kafka source that consumes from the {@code analyzed-news} topic.
 *
 * <p>Configures a {@link KafkaSource} with:
 * <ul>
 *   <li>Committed-offset resume on restart ({@link OffsetsInitializer#committedOffsets()}),
 *       satisfying Requirement 5.6 (no data loss on reconnect).</li>
 *   <li>JSON deserialization via Jackson {@link ObjectMapper}.</li>
 *   <li>Configurable broker list and consumer group ID.</li>
 * </ul>
 *
 * <p>Satisfies Requirements 5.1, 5.6, 11.3
 */
public class KafkaSourceConfig {

    private static final Logger LOGGER = Logger.getLogger(KafkaSourceConfig.class.getName());

    /** Kafka topic consumed by the Prediction_Service. */
    public static final String ANALYZED_NEWS_TOPIC = "analyzed-news";

    /** Comma-separated list of Kafka broker addresses (e.g. {@code "kafka:9092"}). */
    private final String bootstrapServers;

    /** Kafka consumer group ID for offset tracking. */
    private final String groupId;

    /**
     * Constructs a {@code KafkaSourceConfig} with the given broker list and group ID.
     *
     * @param bootstrapServers comma-separated Kafka broker addresses
     * @param groupId          consumer group ID used for committed-offset tracking
     */
    public KafkaSourceConfig(String bootstrapServers, String groupId) {
        this.bootstrapServers = bootstrapServers;
        this.groupId = groupId;
    }

    /**
     * Builds and returns a configured {@link KafkaSource} for {@link AnalyzedNewsMessage}.
     *
     * <p>The source resumes from the last committed offset on restart, ensuring no messages
     * are skipped after a transient {@code analyzed-news} topic outage.
     *
     * @return a ready-to-use {@link KafkaSource} instance
     */
    public KafkaSource<AnalyzedNewsMessage> build() {
        LOGGER.info(String.format(
                "Building KafkaSource: topic=%s, brokers=%s, groupId=%s",
                ANALYZED_NEWS_TOPIC, bootstrapServers, groupId));

        return KafkaSource.<AnalyzedNewsMessage>builder()
                .setBootstrapServers(bootstrapServers)
                .setTopics(ANALYZED_NEWS_TOPIC)
                .setGroupId(groupId)
                // Use earliest() as fallback when no committed offset exists (first run)
                // then resume from committed offset on subsequent restarts
                .setStartingOffsets(OffsetsInitializer.committedOffsets(
                        org.apache.kafka.clients.consumer.OffsetResetStrategy.EARLIEST))
                .setValueOnlyDeserializer(new AnalyzedNewsDeserializationSchema())
                .build();
    }

    // -------------------------------------------------------------------------
    // Inner class: DeserializationSchema
    // -------------------------------------------------------------------------

    /**
     * Jackson-based {@link DeserializationSchema} for {@link AnalyzedNewsMessage}.
     *
     * <p>Deserializes raw Kafka record bytes (UTF-8 JSON) into {@link AnalyzedNewsMessage}
     * instances. Malformed records are logged and result in a {@code null} return so that
     * the Flink job can handle or skip them gracefully.
     */
    public static class AnalyzedNewsDeserializationSchema
            implements DeserializationSchema<AnalyzedNewsMessage> {

        private static final Logger SCHEMA_LOGGER =
                Logger.getLogger(AnalyzedNewsDeserializationSchema.class.getName());

        /** Shared, thread-safe Jackson ObjectMapper. */
        private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

        /**
         * Deserializes a Kafka record's value bytes into an {@link AnalyzedNewsMessage}.
         *
         * @param message raw bytes from the Kafka record value
         * @return deserialized {@link AnalyzedNewsMessage}, or {@code null} on parse failure
         * @throws IOException never thrown; parse errors are caught and logged
         */
        @Override
        public AnalyzedNewsMessage deserialize(byte[] message) throws IOException {
            if (message == null || message.length == 0) {
                SCHEMA_LOGGER.warning("Received null or empty Kafka record; skipping.");
                return null;
            }
            try {
                return OBJECT_MAPPER.readValue(message, AnalyzedNewsMessage.class);
            } catch (IOException e) {
                SCHEMA_LOGGER.log(Level.WARNING,
                        "Failed to deserialize AnalyzedNewsMessage from Kafka record: "
                                + e.getMessage(), e);
                // Return null so Flink can filter/handle the bad record downstream
                return null;
            }
        }

        /**
         * Signals end-of-stream. Kafka sources are unbounded, so this always returns
         * {@code false}.
         *
         * @param nextElement the deserialized element (unused)
         * @return {@code false} — stream is never considered finished
         */
        @Override
        public boolean isEndOfStream(AnalyzedNewsMessage nextElement) {
            return false;
        }

        /**
         * Returns the {@link TypeInformation} for {@link AnalyzedNewsMessage}.
         *
         * @return Flink type information for the output type
         */
        @Override
        public TypeInformation<AnalyzedNewsMessage> getProducedType() {
            return TypeInformation.of(AnalyzedNewsMessage.class);
        }
    }
}
