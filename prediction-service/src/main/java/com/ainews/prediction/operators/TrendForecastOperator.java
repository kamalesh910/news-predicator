package com.ainews.prediction.operators;

import com.ainews.prediction.model.AnalyzedNewsMessage;
import com.ainews.prediction.model.TrendForecast;
import org.apache.flink.streaming.api.functions.windowing.ProcessWindowFunction;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.util.Collector;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Flink {@link ProcessWindowFunction} that produces {@link TrendForecast} records from
 * the article volume observed in each window.
 *
 * <p>For each window evaluation, the operator counts the articles for the given topic and
 * produces a forecast whose {@code predictedVolume} is derived from the current window's
 * article count. The {@code forecastHorizon} is set to one hour after the window end.
 * The {@code confidenceScore} is computed as a simple heuristic based on the observed
 * volume relative to the configured baseline.
 *
 * <p>Satisfies Requirements 5.4, 6.2
 */
public class TrendForecastOperator
        extends ProcessWindowFunction<AnalyzedNewsMessage, TrendForecast, String, TimeWindow> {

    /**
     * Baseline article count used to normalise the confidence score.
     * A window count at or above this value yields a confidence of 1.0.
     */
    private final int baselineVolume;

    /**
     * Constructs a {@code TrendForecastOperator} with the given baseline volume.
     *
     * @param baselineVolume expected "normal" article count per window; used to derive
     *                       the confidence score heuristic
     */
    public TrendForecastOperator(int baselineVolume) {
        this.baselineVolume = baselineVolume;
    }

    /**
     * Evaluates a window for a given topic key and emits a {@link TrendForecast}.
     *
     * <p>The forecast is always emitted (one per window per topic), regardless of volume.
     * The {@code predictedVolume} is set to the current window's article count as a simple
     * persistence-of-volume forecast. The {@code confidenceScore} is capped at 1.0 and
     * scales linearly with the observed count relative to {@code baselineVolume}.
     *
     * @param topicName the topic key for this window
     * @param context   window context providing window metadata
     * @param elements  all articles in the current window
     * @param out       collector to emit {@link TrendForecast} records
     */
    @Override
    public void process(
            String topicName,
            Context context,
            Iterable<AnalyzedNewsMessage> elements,
            Collector<TrendForecast> out) {

        int count = 0;
        for (AnalyzedNewsMessage ignored : elements) {
            count++;
        }

        // Simple persistence-of-volume forecast: predict the same volume for the next horizon.
        int predictedVolume = count;

        // Confidence heuristic: scales linearly with observed volume up to baselineVolume.
        // More data in the window → higher confidence, capped at 1.0.
        double confidenceScore;
        if (baselineVolume <= 0) {
            confidenceScore = count > 0 ? 1.0 : 0.0;
        } else {
            confidenceScore = Math.min(1.0, (double) count / baselineVolume);
        }

        // Forecast horizon: one hour after the window end.
        TimeWindow window = context.window();
        String forecastHorizon = Instant.ofEpochMilli(window.getEnd())
                .plus(1, ChronoUnit.HOURS)
                .toString(); // ISO 8601 via Instant.toString()

        TrendForecast forecast = new TrendForecast(
                UUID.randomUUID().toString(),
                topicName,
                predictedVolume,
                confidenceScore,
                forecastHorizon
        );

        out.collect(forecast);
    }

    /**
     * Returns the configured baseline volume used for confidence score computation.
     *
     * @return baseline article count per window
     */
    public int getBaselineVolume() {
        return baselineVolume;
    }
}
