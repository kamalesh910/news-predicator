package com.ainews.prediction.operators;

import com.ainews.prediction.model.AnalyzedNewsMessage;
import com.ainews.prediction.model.BurstEvent;
import org.apache.flink.streaming.api.functions.windowing.ProcessWindowFunction;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.util.Collector;

import java.time.Instant;
import java.util.UUID;

/**
 * Flink {@link ProcessWindowFunction} that detects burst events for a given topic.
 *
 * <p>Operates on a keyed stream where the key is the topic name. For each window evaluation,
 * it counts the number of articles in the window. If the count exceeds the configured
 * {@code threshold}, a {@link BurstEvent} is emitted.
 *
 * <p>Satisfies Requirements 5.1, 5.2, 5.3
 */
public class BurstDetectionOperator
        extends ProcessWindowFunction<AnalyzedNewsMessage, BurstEvent, String, TimeWindow> {

    /** Minimum number of articles within the window required to trigger a burst event. */
    private final int threshold;

    /** Size of the sliding window in milliseconds (informational; Flink manages the window). */
    private final long windowSizeMs;

    /**
     * Constructs a {@code BurstDetectionOperator} with the given threshold and window size.
     *
     * @param threshold    minimum article count to trigger a {@link BurstEvent}
     * @param windowSizeMs sliding window size in milliseconds (used for documentation/logging)
     */
    public BurstDetectionOperator(int threshold, long windowSizeMs) {
        this.threshold = threshold;
        this.windowSizeMs = windowSizeMs;
    }

    /**
     * Evaluates a window for a given topic key. Emits a {@link BurstEvent} when the article
     * count in the window exceeds the configured threshold.
     *
     * @param topicName the topic key for this window
     * @param context   window context providing window metadata
     * @param elements  all articles in the current window
     * @param out       collector to emit {@link BurstEvent} records
     */
    @Override
    public void process(
            String topicName,
            Context context,
            Iterable<AnalyzedNewsMessage> elements,
            Collector<BurstEvent> out) {

        int count = 0;
        for (AnalyzedNewsMessage ignored : elements) {
            count++;
        }

        if (count > threshold) {
            TimeWindow window = context.window();

            String windowStart = Instant.ofEpochMilli(window.getStart())
                    .toString(); // ISO 8601 via Instant.toString()
            String windowEnd = Instant.ofEpochMilli(window.getEnd())
                    .toString();
            String detectionTimestamp = Instant.now()
                    .toString();

            BurstEvent event = new BurstEvent(
                    UUID.randomUUID().toString(),
                    topicName,
                    count,
                    windowStart,
                    windowEnd,
                    detectionTimestamp
            );

            out.collect(event);
        }
    }

    /**
     * Returns the configured burst threshold.
     *
     * @return minimum article count to trigger a burst event
     */
    public int getThreshold() {
        return threshold;
    }

    /**
     * Returns the configured window size in milliseconds.
     *
     * @return window size in milliseconds
     */
    public long getWindowSizeMs() {
        return windowSizeMs;
    }
}
