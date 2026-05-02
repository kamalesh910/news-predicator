package com.ainews.prediction.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.connector.base.DeliveryGuarantee;
import org.apache.flink.connector.kafka.sink.KafkaRecordSerializationSchema;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.kafka.clients.producer.ProducerRecord;

import java.nio.charset.StandardCharsets;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Factory for the Flink Kafka sink that publishes prediction messages to the
 * {@code predictions} topic.
 *
 * <p>Accepts any {@link Object} (typically a {@link com.ainews.prediction.model.BurstEvent}
 * or {@link com.ainews.prediction.model.TrendForecast}), serializes it to a JSON string
 * via Jackson, and writes the UTF-8 bytes to Kafka.
 *
 * <p>Configurable broker list is provided via the constructor. The sink uses
 * {@link DeliveryGuarantee#AT_LEAST_ONCE} to ensure no prediction messages are silently
 * dropped on transient broker failures.
 *
 * <p>Satisfies Requirements 5.3, 6.3, 11.3
 */
public class KafkaSinkConfig {

    private static final Logger LOGGER = Logger.getLogger(KafkaSinkConfig.class.getName());

    /** Kafka topic to which prediction messages are published. */
    public static final String PREDICTIONS_TOPIC = "predictions";

    /** Comma-separated list of Kafka broker addresses (e.g. {@code "kafka:9092"}). */
    private final String bootstrapServers;

    /**
     * Constructs a {@code KafkaSinkConfig} with the given broker list.
     *
     * @param bootstrapServers comma-separated Kafka broker addresses
     */
    public KafkaSinkConfig(String bootstrapServers) {
        this.bootstrapServers = bootstrapServers;
    }

    /**
     * Builds and returns a configured {@link KafkaSink} that serializes objects to JSON
     * strings before writing to the {@code predictions} topic.
     *
     * @return a ready-to-use {@link KafkaSink} instance
     */
    public KafkaSink<Object> build() {
        LOGGER.info(String.format(
                "Building KafkaSink: topic=%s, brokers=%s",
                PREDICTIONS_TOPIC, bootstrapServers));

        return KafkaSink.<Object>builder()
                .setBootstrapServers(bootstrapServers)
                .setRecordSerializer(new PredictionJsonSerializationSchema(PREDICTIONS_TOPIC))
                .setDeliveryGuarantee(DeliveryGuarantee.AT_LEAST_ONCE)
                .build();
    }

    // -------------------------------------------------------------------------
    // Inner class: KafkaRecordSerializationSchema
    // -------------------------------------------------------------------------

    /**
     * Jackson-based {@link KafkaRecordSerializationSchema} that serializes any object
     * to a UTF-8 JSON byte array and wraps it in a {@link ProducerRecord}.
     *
     * <p>If serialization fails (e.g. due to a non-serializable field), the error is
     * logged and {@code null} is returned so that Flink skips the record rather than
     * crashing the job.
     */
    public static class PredictionJsonSerializationSchema
            implements KafkaRecordSerializationSchema<Object> {

        private static final Logger SCHEMA_LOGGER =
                Logger.getLogger(PredictionJsonSerializationSchema.class.getName());

        /** Shared, thread-safe Jackson ObjectMapper. */
        private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

        /** Target Kafka topic. */
        private final String topic;

        /**
         * Constructs a {@code PredictionJsonSerializationSchema} for the given topic.
         *
         * @param topic Kafka topic to publish records to
         */
        public PredictionJsonSerializationSchema(String topic) {
            this.topic = topic;
        }

        /**
         * Serializes the given element to a JSON {@link ProducerRecord}.
         *
         * @param element   the object to serialize (BurstEvent or TrendForecast)
         * @param context   Flink sink context (unused)
         * @param timestamp record timestamp (unused; Kafka will assign its own)
         * @return a {@link ProducerRecord} with the JSON payload, or {@code null} on error
         */
        @Override
        public ProducerRecord<byte[], byte[]> serialize(
                Object element,
                KafkaSinkContext context,
                Long timestamp) {

            if (element == null) {
                SCHEMA_LOGGER.warning("Attempted to serialize null element; skipping.");
                return null;
            }

            try {
                byte[] valueBytes = OBJECT_MAPPER.writeValueAsString(element)
                        .getBytes(StandardCharsets.UTF_8);
                return new ProducerRecord<>(topic, valueBytes);
            } catch (JsonProcessingException e) {
                SCHEMA_LOGGER.log(Level.WARNING,
                        "Failed to serialize prediction message to JSON: " + e.getMessage(), e);
                return null;
            }
        }
    }
}
