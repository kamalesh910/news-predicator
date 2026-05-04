package com.ainews.prediction.operators;

import com.ainews.prediction.model.AnalyzedNewsMessage;
import com.ainews.prediction.model.TrendForecast;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.streaming.api.functions.windowing.ProcessWindowFunction;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.util.Collector;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Flink {@link ProcessWindowFunction} that produces {@link TrendForecast} records.
 *
 * <p>For each window evaluation, computes:
 * <ul>
 *   <li>{@code platform} — source name from articles in the window</li>
 *   <li>{@code avgBiasScore} — mean bias score across articles with a non-null score</li>
 *   <li>{@code trendDirection} — "↑", "↓", or "→" vs the previous window's volume</li>
 *   <li>{@code predictedVolume} — current window count (persistence-of-volume forecast)</li>
 *   <li>{@code confidenceScore} — linear scale relative to baselineVolume, capped at 1.0</li>
 * </ul>
 *
 * <p>One forecast is always emitted per window per key, regardless of volume.
 * The previous window volume is stored in Flink keyed state.
 *
 * <p>Satisfies Requirements 5.4, 6.2
 */
public class TrendForecastOperator
        extends ProcessWindowFunction<AnalyzedNewsMessage, TrendForecast, String, TimeWindow> {

    private static final long serialVersionUID = 1L;

    /**
     * Baseline article count used to normalise the confidence score.
     * A window count at or above this value yields a confidence of 1.0.
     */
    private final int baselineVolume;

    /** Keyed state: article count from the previous window for this topic+platform key. */
    private transient ValueState<Integer> previousVolumeState;

    public TrendForecastOperator(int baselineVolume) {
        this.baselineVolume = baselineVolume;
    }

    @Override
    public void open(Configuration parameters) throws Exception {
        ValueStateDescriptor<Integer> descriptor =
                new ValueStateDescriptor<>("forecast-prev-volume", Integer.class);
        previousVolumeState = getRuntimeContext().getState(descriptor);
    }

    /**
     * Evaluates a window and emits a {@link TrendForecast}.
     *
     * @param compositeKey "topicName|platform" composite key
     * @param context      window context
     * @param elements     all articles in the current window
     * @param out          collector for {@link TrendForecast} records
     */
    @Override
    public void process(
            String compositeKey,
            Context context,
            Iterable<AnalyzedNewsMessage> elements,
            Collector<TrendForecast> out) throws Exception {

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

        // Compute average bias score
        Double avgBiasScore = biasCount > 0 ? biasSum / biasCount : null;

        // Compute trend direction vs previous window
        Integer prevVolume = previousVolumeState.value();
        String trendDirection;
        if (prevVolume == null) {
            trendDirection = "→";
        } else if (count > prevVolume * 1.05) {
            trendDirection = "↑";
        } else if (count < prevVolume * 0.95) {
            trendDirection = "↓";
        } else {
            trendDirection = "→";
        }
        previousVolumeState.update(count);

        // Confidence heuristic: scales linearly with observed volume up to baselineVolume
        double confidenceScore;
        if (baselineVolume <= 0) {
            confidenceScore = count > 0 ? 1.0 : 0.0;
        } else {
            confidenceScore = Math.min(1.0, (double) count / baselineVolume);
        }

        // Forecast horizon: one hour after the window end
        TimeWindow window = context.window();
        String forecastHorizon = Instant.ofEpochMilli(window.getEnd())
                .plus(1, ChronoUnit.HOURS)
                .toString();

        // Extract topicName from composite key (format: "topicName|platform")
        String topicName = compositeKey.contains("|")
                ? compositeKey.substring(0, compositeKey.indexOf('|'))
                : compositeKey;

        TrendForecast forecast = new TrendForecast(
                UUID.randomUUID().toString(),
                topicName,
                platform,
                count,
                confidenceScore,
                avgBiasScore,
                trendDirection,
                forecastHorizon
        );

        out.collect(forecast);
    }

    public int getBaselineVolume() {
        return baselineVolume;
    }
}
