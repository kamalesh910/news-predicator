package com.ainews.prediction.operators;

import com.ainews.prediction.model.AnalyzedNewsMessage;
import com.ainews.prediction.model.BurstEvent;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.streaming.api.functions.windowing.ProcessWindowFunction;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.util.Collector;

import java.time.Instant;
import java.util.UUID;

/**
 * Flink {@link ProcessWindowFunction} that detects burst events for a given topic+platform key.
 *
 * <p>For each window evaluation, counts articles and computes:
 * <ul>
 *   <li>{@code platform} — the source name shared by all articles in the window</li>
 *   <li>{@code avgBiasScore} — mean bias score across articles with a non-null score</li>
 *   <li>{@code trendDirection} — "↑", "↓", or "→" compared to the previous window's count</li>
 * </ul>
 *
 * <p>A {@link BurstEvent} is emitted only when the article count exceeds the configured
 * {@code threshold}. The previous window count is stored in Flink keyed state so trend
 * direction can be computed across consecutive windows.
 *
 * <p>Satisfies Requirements 5.1, 5.2, 5.3
 */
public class BurstDetectionOperator
        extends ProcessWindowFunction<AnalyzedNewsMessage, BurstEvent, String, TimeWindow> {

    private static final long serialVersionUID = 1L;

    /** Minimum number of articles within the window required to trigger a burst event. */
    private final int threshold;

    /** Size of the window in milliseconds (informational). */
    private final long windowSizeMs;

    /** Keyed state: article count from the previous window for this topic+platform key. */
    private transient ValueState<Integer> previousCountState;

    public BurstDetectionOperator(int threshold, long windowSizeMs) {
        this.threshold = threshold;
        this.windowSizeMs = windowSizeMs;
    }

    @Override
    public void open(Configuration parameters) throws Exception {
        ValueStateDescriptor<Integer> descriptor =
                new ValueStateDescriptor<>("burst-prev-count", Integer.class);
        previousCountState = getRuntimeContext().getState(descriptor);
    }

    /**
     * Evaluates a window. Emits a {@link BurstEvent} when article count exceeds threshold.
     *
     * @param compositeKey "topicName|platform" composite key
     * @param context      window context
     * @param elements     all articles in the current window
     * @param out          collector for {@link BurstEvent} records
     */
    @Override
    public void process(
            String compositeKey,
            Context context,
            Iterable<AnalyzedNewsMessage> elements,
            Collector<BurstEvent> out) throws Exception {

        int count = 0;
        double biasSum = 0.0;
        int biasCount = 0;
        String platform = "Unknown";

        for (AnalyzedNewsMessage msg : elements) {
            count++;
            if (msg.getSourceName() != null && !msg.getSourceName().isBlank()) {
                platform = msg.getSourceName();
            }
            if (msg.getBiasScore() != null) {
                biasSum += msg.getBiasScore();
                biasCount++;
            }
        }

        if (count <= threshold) {
            // Update state even when below threshold so trend direction is accurate next window
            previousCountState.update(count);
            return;
        }

        // Compute average bias score
        Double avgBiasScore = biasCount > 0 ? biasSum / biasCount : null;

        // Compute trend direction vs previous window
        Integer prevCount = previousCountState.value();
        String trendDirection;
        if (prevCount == null) {
            trendDirection = "→";
        } else if (count > prevCount * 1.05) {
            trendDirection = "↑";
        } else if (count < prevCount * 0.95) {
            trendDirection = "↓";
        } else {
            trendDirection = "→";
        }
        previousCountState.update(count);

        // Extract topicName from composite key (format: "topicName|platform")
        String topicName = compositeKey.contains("|")
                ? compositeKey.substring(0, compositeKey.indexOf('|'))
                : compositeKey;

        TimeWindow window = context.window();
        String windowStart = Instant.ofEpochMilli(window.getStart()).toString();
        String windowEnd   = Instant.ofEpochMilli(window.getEnd()).toString();
        String detectionTs = Instant.now().toString();

        BurstEvent event = new BurstEvent(
                UUID.randomUUID().toString(),
                topicName,
                platform,
                count,
                avgBiasScore,
                trendDirection,
                windowStart,
                windowEnd,
                detectionTs
        );

        out.collect(event);
    }

    public int getThreshold() {
        return threshold;
    }

    public long getWindowSizeMs() {
        return windowSizeMs;
    }
}
