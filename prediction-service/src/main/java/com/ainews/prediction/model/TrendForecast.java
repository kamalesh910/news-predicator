package com.ainews.prediction.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents a predicted future trend derived from historical article volume patterns.
 *
 * <p>Published to the {@code predictions} Kafka topic by the Prediction_Service after
 * analysing historical article volume patterns for a given topic.
 *
 * <p>Satisfies Requirements 5.4, 6.2
 */
public class TrendForecast {

    /** Unique identifier for this forecast (UUID). */
    @JsonProperty("forecastId")
    private String forecastId;

    /** The topic name for which the forecast was produced. */
    @JsonProperty("topicName")
    private String topicName;

    /** Predicted number of articles expected within the forecast horizon. */
    @JsonProperty("predictedVolume")
    private int predictedVolume;

    /** Confidence score for this forecast in the range [0.0, 1.0]. */
    @JsonProperty("confidenceScore")
    private double confidenceScore;

    /** ISO 8601 timestamp representing the end of the forecast horizon. */
    @JsonProperty("forecastHorizon")
    private String forecastHorizon;

    /** No-arg constructor required for Jackson deserialization. */
    public TrendForecast() {
    }

    /**
     * All-args constructor.
     *
     * @param forecastId      unique identifier for this forecast
     * @param topicName       topic for which the forecast was produced
     * @param predictedVolume predicted article volume within the forecast horizon
     * @param confidenceScore confidence score in [0.0, 1.0]
     * @param forecastHorizon ISO 8601 timestamp of the forecast horizon end
     */
    public TrendForecast(
            String forecastId,
            String topicName,
            int predictedVolume,
            double confidenceScore,
            String forecastHorizon) {
        this.forecastId = forecastId;
        this.topicName = topicName;
        this.predictedVolume = predictedVolume;
        this.confidenceScore = confidenceScore;
        this.forecastHorizon = forecastHorizon;
    }

    // -------------------------------------------------------------------------
    // Getters and setters
    // -------------------------------------------------------------------------

    public String getForecastId() {
        return forecastId;
    }

    public void setForecastId(String forecastId) {
        this.forecastId = forecastId;
    }

    public String getTopicName() {
        return topicName;
    }

    public void setTopicName(String topicName) {
        this.topicName = topicName;
    }

    public int getPredictedVolume() {
        return predictedVolume;
    }

    public void setPredictedVolume(int predictedVolume) {
        this.predictedVolume = predictedVolume;
    }

    public double getConfidenceScore() {
        return confidenceScore;
    }

    public void setConfidenceScore(double confidenceScore) {
        this.confidenceScore = confidenceScore;
    }

    public String getForecastHorizon() {
        return forecastHorizon;
    }

    public void setForecastHorizon(String forecastHorizon) {
        this.forecastHorizon = forecastHorizon;
    }

    @Override
    public String toString() {
        return "TrendForecast{"
                + "forecastId='" + forecastId + '\''
                + ", topicName='" + topicName + '\''
                + ", predictedVolume=" + predictedVolume
                + ", confidenceScore=" + confidenceScore
                + ", forecastHorizon='" + forecastHorizon + '\''
                + '}';
    }
}
