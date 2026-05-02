package com.ainews.prediction.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Mirrors the {@code analyzed-news} Kafka topic message schema produced by the Analysis_Service.
 *
 * <p>Contains all fields from the original {@code raw-news} message plus bias analysis
 * annotations added by the BERT-based caste-bias classifier.
 *
 * <p>Satisfies Requirements 4.1, 5.1
 */
public class AnalyzedNewsMessage {

    // -------------------------------------------------------------------------
    // Fields inherited from RawNewsMessage (raw-news schema)
    // -------------------------------------------------------------------------

    /** UUID v4 unique identifier assigned by the ingestion service. */
    @JsonProperty("articleId")
    private String articleId;

    /** URL of the original article or post. */
    @JsonProperty("sourceUrl")
    private String sourceUrl;

    /** Headline or title of the article. */
    @JsonProperty("title")
    private String title;

    /** Full body text of the article. */
    @JsonProperty("body")
    private String body;

    /** Name of the news source or social media platform. */
    @JsonProperty("sourceName")
    private String sourceName;

    /** Publication timestamp in ISO 8601 format (e.g. "2024-01-15T10:30:00.000Z"). */
    @JsonProperty("publishedAt")
    private String publishedAt;

    /** Schema version for forward compatibility (e.g. "1.0"). */
    @JsonProperty("schemaVersion")
    private String schemaVersion;

    // -------------------------------------------------------------------------
    // Bias analysis annotations added by the Analysis_Service
    // -------------------------------------------------------------------------

    /**
     * Probability of caste-bias in the range [0.0, 1.0].
     * Nullable — will be {@code null} when BERT inference failed ({@code errorFlag} is {@code true}).
     */
    @JsonProperty("biasScore")
    private Double biasScore;

    /** Human-readable bias classification label (e.g. "biased", "neutral"). */
    @JsonProperty("biasLabel")
    private String biasLabel;

    /** ISO 8601 timestamp of when the analysis was performed. */
    @JsonProperty("analysisTimestamp")
    private String analysisTimestamp;

    /**
     * {@code true} when BERT inference failed; {@code biasScore} will be {@code null}
     * in that case. Defaults to {@code false}.
     */
    @JsonProperty("errorFlag")
    private boolean errorFlag;

    /** No-arg constructor required for Jackson deserialization. */
    public AnalyzedNewsMessage() {
    }

    /**
     * All-args constructor.
     *
     * @param articleId         unique article identifier
     * @param sourceUrl         URL of the original article
     * @param title             article headline
     * @param body              full body text
     * @param sourceName        name of the news source
     * @param publishedAt       ISO 8601 publication timestamp
     * @param schemaVersion     schema version string
     * @param biasScore         caste-bias probability [0.0, 1.0], or {@code null} on error
     * @param biasLabel         human-readable bias classification label
     * @param analysisTimestamp ISO 8601 timestamp of analysis
     * @param errorFlag         {@code true} if BERT inference failed
     */
    public AnalyzedNewsMessage(
            String articleId,
            String sourceUrl,
            String title,
            String body,
            String sourceName,
            String publishedAt,
            String schemaVersion,
            Double biasScore,
            String biasLabel,
            String analysisTimestamp,
            boolean errorFlag) {
        this.articleId = articleId;
        this.sourceUrl = sourceUrl;
        this.title = title;
        this.body = body;
        this.sourceName = sourceName;
        this.publishedAt = publishedAt;
        this.schemaVersion = schemaVersion;
        this.biasScore = biasScore;
        this.biasLabel = biasLabel;
        this.analysisTimestamp = analysisTimestamp;
        this.errorFlag = errorFlag;
    }

    // -------------------------------------------------------------------------
    // Getters and setters
    // -------------------------------------------------------------------------

    public String getArticleId() {
        return articleId;
    }

    public void setArticleId(String articleId) {
        this.articleId = articleId;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getSourceName() {
        return sourceName;
    }

    public void setSourceName(String sourceName) {
        this.sourceName = sourceName;
    }

    public String getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(String publishedAt) {
        this.publishedAt = publishedAt;
    }

    public String getSchemaVersion() {
        return schemaVersion;
    }

    public void setSchemaVersion(String schemaVersion) {
        this.schemaVersion = schemaVersion;
    }

    public Double getBiasScore() {
        return biasScore;
    }

    public void setBiasScore(Double biasScore) {
        this.biasScore = biasScore;
    }

    public String getBiasLabel() {
        return biasLabel;
    }

    public void setBiasLabel(String biasLabel) {
        this.biasLabel = biasLabel;
    }

    public String getAnalysisTimestamp() {
        return analysisTimestamp;
    }

    public void setAnalysisTimestamp(String analysisTimestamp) {
        this.analysisTimestamp = analysisTimestamp;
    }

    public boolean isErrorFlag() {
        return errorFlag;
    }

    public void setErrorFlag(boolean errorFlag) {
        this.errorFlag = errorFlag;
    }

    @Override
    public String toString() {
        return "AnalyzedNewsMessage{"
                + "articleId='" + articleId + '\''
                + ", sourceUrl='" + sourceUrl + '\''
                + ", title='" + title + '\''
                + ", sourceName='" + sourceName + '\''
                + ", publishedAt='" + publishedAt + '\''
                + ", schemaVersion='" + schemaVersion + '\''
                + ", biasScore=" + biasScore
                + ", biasLabel='" + biasLabel + '\''
                + ", analysisTimestamp='" + analysisTimestamp + '\''
                + ", errorFlag=" + errorFlag
                + '}';
    }
}
