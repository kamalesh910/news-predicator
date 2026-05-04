# =============================================================================
# prediction-service — Multi-stage Dockerfile
# Stage 1: Build fat JAR with Maven
# Stage 2: Minimal JRE 17 runtime
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------------------------
FROM maven:3.9.7-eclipse-temurin-17 AS build

WORKDIR /build

# Copy POM first — Docker caches this layer so deps are only re-downloaded
# when pom.xml changes. Using 'package' with an empty src to warm the cache.
COPY pom.xml .
RUN mvn dependency:resolve -q --no-transfer-progress

# Copy source and build fat JAR (Maven Shade plugin produces the shaded jar)
COPY src ./src
RUN mvn package -DskipTests -q --no-transfer-progress

# ---------------------------------------------------------------------------
# Stage 2: Runtime
# ---------------------------------------------------------------------------
FROM eclipse-temurin:17-jre-alpine AS runtime

# Create non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy the fat JAR from the build stage
COPY --from=build /build/target/prediction-service-*.jar prediction-service.jar

RUN chown appuser:appgroup prediction-service.jar

USER appuser

EXPOSE 8080

CMD ["java", \
     "--add-opens", "java.base/java.util=ALL-UNNAMED", \
     "--add-opens", "java.base/java.lang=ALL-UNNAMED", \
     "--add-opens", "java.base/java.lang.reflect=ALL-UNNAMED", \
     "--add-opens", "java.base/java.io=ALL-UNNAMED", \
     "-jar", "/app/prediction-service.jar"]
