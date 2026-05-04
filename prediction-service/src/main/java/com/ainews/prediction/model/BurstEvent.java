package com.ainews.prediction.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents a detected surge in article volume for a given topic within a time window.
 *
 * <p>Published to the {@code predictions} Kafka topic when the Prediction_Service detects
 * that article volume for a topic exceeds the configured threshold within a sliding window.
 *
 * <p>Satisfies Requirements 5.3, 6.1
 */
public class BurstEvent {

    /** Unique identifier for this burst event (UUID). */
    @JsonProperty("eventId")
    private String eventId;

    /** The topic name for which the burst was detected. */
    @JsonProperty("topicName")
    private String topicName;

    /** The platform (source name) from which the articles originated. */
    @JsonProperty("platform")
    private String platform;

    /** Number of articles observed within the detection window. */
    @JsonProperty("articleCount")
    private int articleCount;

    /** Average bias score of articles in the window, in [0.0, 1.0]. Null if no scores available. */
    @JsonProperty("avgBiasScore")
    private Double avgBiasScore;

    /**
     * Trend direction compared to the previous window for this topic+platform.
     * One of: "↑" (increasing), "↓" (decreasing), "→" (stable).
     */
    @JsonProperty("trendDirection")
    private String trendDirection;

    /** ISO 8601 timestamp marking the start of the detection window. */
    @JsonProperty("windowStart")
    private String windowStart;

    /** ISO 8601 timestamp marking the end of the detection window. */
    @JsonProperty("windowEnd")
    private String windowEnd;

    /** ISO 8601 timestamp of when this burst event was detected and emitted. */
    @JsonProperty("detectionTimestamp")
    private String detectionTimestamp;

    /** No-arg constructor required for Jackson deserialization. */
    public BurstEvent() {
    }

    /**
     * All-args constructor.
     *
     * @param eventId            unique identifier for this burst event
     * @param topicName          topic for which the burst was detected
     * @param platform           source platform (e.g. "NewsAPI", "Twitter")
     * @param articleCount       number of articles in the detection window
     * @param avgBiasScore       average bias score of articles in the window, or null
     * @param trendDirection     "↑", "↓", or "→" vs previous window
     * @param windowStart        ISO 8601 start of the detection window
     * @param windowEnd          ISO 8601 end of the detection window
     * @param detectionTimestamp ISO 8601 timestamp when the event was detected
     */
    public BurstEvent(
            String eventId,
            String topicName,
            String platform,
            int articleCount,
            Double avgBiasScore,
            String trendDirection,
            String windowStart,
            String windowEnd,
            String detectionTimestamp) {
        this.eventId = eventId;
        this.topicName = topicName;
        this.platform = platform;
        this.articleCount = articleCount;
        this.avgBiasScore = avgBiasScore;
        this.trendDirection = trendDirection;
        this.windowStart = windowStart;
        this.windowEnd = windowEnd;
        this.detectionTimestamp = detectionTimestamp;
    }

    // -------------------------------------------------------------------------
    // Getters and setters
    // -------------------------------------------------------------------------

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getTopicName() {
        return topicName;
    }

    public void setTopicName(String topicName) {
        this.topicName = topicName;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public int getArticleCount() {
        return articleCount;
    }

    public void setArticleCount(int articleCount) {
        this.articleCount = articleCount;
    }

    public Double getAvgBiasScore() {
        return avgBiasScore;
    }

    public void setAvgBiasScore(Double avgBiasScore) {
        this.avgBiasScore = avgBiasScore;
    }

    public String getTrendDirection() {
        return trendDirection;
    }

    public void setTrendDirection(String trendDirection) {
        this.trendDirection = trendDirection;
    }

    public String getWindowStart() {
        return windowStart;
    }

    public void setWindowStart(String windowStart) {
        this.windowStart = windowStart;
    }

    public String getWindowEnd() {
        return windowEnd;
    }

    public void setWindowEnd(String windowEnd) {
        this.windowEnd = windowEnd;
    }

    public String getDetectionTimestamp() {
        return detectionTimestamp;
    }

    public void setDetectionTimestamp(String detectionTimestamp) {
        this.detectionTimestamp = detectionTimestamp;
    }

    @Override
    public String toString() {
        return "BurstEvent{"
                + "eventId='" + eventId + '\''
                + ", topicName='" + topicName + '\''
                + ", platform='" + platform + '\''
                + ", articleCount=" + articleCount
                + ", avgBiasScore=" + avgBiasScore
                + ", trendDirection='" + trendDirection + '\''
                + ", windowStart='" + windowStart + '\''
                + ", windowEnd='" + windowEnd + '\''
                + ", detectionTimestamp='" + detectionTimestamp + '\''
                + '}';
    }
}
