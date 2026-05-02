package com.ainews.prediction.health;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Lightweight HTTP health-check server for the Prediction_Service.
 *
 * <p>Uses Java's built-in {@link HttpServer} (no external dependencies) to expose a
 * single endpoint:
 *
 * <pre>
 *   GET /health  →  HTTP 200
 *                   Content-Type: application/json
 *                   {"status": "ok", "service": "prediction-service", "timestamp": "<ISO 8601>"}
 * </pre>
 *
 * <p>The server is intended to be started in a daemon background thread before the Flink
 * job is submitted, so that container orchestrators (Docker, Kubernetes) can probe liveness
 * from the moment the JVM is ready.
 *
 * <p>Usage:
 * <pre>{@code
 *   HealthServer server = new HealthServer(8080);
 *   server.start();
 *   // ... run Flink job ...
 *   server.stop();
 * }</pre>
 *
 * <p>Satisfies Requirements 5.7, 12.3
 */
public class HealthServer {

    private static final Logger LOGGER = Logger.getLogger(HealthServer.class.getName());

    /** HTTP path handled by this server. */
    private static final String HEALTH_PATH = "/health";

    /** Content-Type header value for JSON responses. */
    private static final String CONTENT_TYPE_JSON = "application/json";

    /** Service name embedded in the health response body. */
    private static final String SERVICE_NAME = "prediction-service";

    /** Port on which the HTTP server listens. */
    private final int port;

    /** Underlying Java HTTP server instance; {@code null} until {@link #start()} is called. */
    private HttpServer httpServer;

    /**
     * Constructs a {@code HealthServer} that will listen on the given port.
     *
     * @param port TCP port to bind (e.g. {@code 8080})
     */
    public HealthServer(int port) {
        this.port = port;
    }

    /**
     * Starts the HTTP server and registers the {@code /health} handler.
     *
     * <p>This method blocks until the server is fully bound and ready to accept connections.
     * It is safe to call from a background thread.
     *
     * @throws IOException if the server cannot bind to the configured port
     */
    public void start() throws IOException {
        httpServer = HttpServer.create(new InetSocketAddress(port), /* backlog */ 0);
        httpServer.createContext(HEALTH_PATH, new HealthHandler());
        // Use the default executor (single-threaded) — health checks are lightweight
        httpServer.setExecutor(null);
        httpServer.start();

        LOGGER.info(String.format(
                "{\"event\":\"health-server-started\",\"service\":\"%s\",\"port\":%d,\"path\":\"%s\"}",
                SERVICE_NAME, port, HEALTH_PATH));
    }

    /**
     * Stops the HTTP server, waiting up to 1 second for in-flight requests to complete.
     *
     * <p>Safe to call even if {@link #start()} was never invoked (no-op in that case).
     */
    public void stop() {
        if (httpServer != null) {
            httpServer.stop(/* delay seconds */ 1);
            LOGGER.info(String.format(
                    "{\"event\":\"health-server-stopped\",\"service\":\"%s\",\"port\":%d}",
                    SERVICE_NAME, port));
        }
    }

    /**
     * Returns the port this server is (or will be) listening on.
     *
     * @return configured TCP port
     */
    public int getPort() {
        return port;
    }

    // -------------------------------------------------------------------------
    // Inner class: HTTP handler
    // -------------------------------------------------------------------------

    /**
     * Handles {@code GET /health} requests.
     *
     * <p>Returns HTTP 200 with a JSON body:
     * <pre>
     *   {"status": "ok", "service": "prediction-service", "timestamp": "2024-01-15T10:30:00Z"}
     * </pre>
     *
     * <p>Any other HTTP method receives HTTP 405 Method Not Allowed.
     */
    private static class HealthHandler implements HttpHandler {

        private static final Logger HANDLER_LOGGER =
                Logger.getLogger(HealthHandler.class.getName());

        /**
         * Handles an incoming HTTP exchange.
         *
         * @param exchange the HTTP exchange to handle
         * @throws IOException if writing the response fails
         */
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                String method = exchange.getRequestMethod();

                if (!"GET".equalsIgnoreCase(method)) {
                    // Method not allowed
                    byte[] body = "Method Not Allowed".getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "text/plain");
                    exchange.sendResponseHeaders(405, body.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(body);
                    }
                    return;
                }

                // Build JSON response with current ISO 8601 timestamp
                String timestamp = Instant.now().toString();
                String json = String.format(
                        "{\"status\":\"ok\",\"service\":\"%s\",\"timestamp\":\"%s\"}",
                        SERVICE_NAME, timestamp);

                byte[] responseBytes = json.getBytes(StandardCharsets.UTF_8);

                exchange.getResponseHeaders().set("Content-Type", CONTENT_TYPE_JSON);
                exchange.sendResponseHeaders(200, responseBytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(responseBytes);
                }

            } catch (Exception e) {
                HANDLER_LOGGER.log(Level.WARNING,
                        "Error handling health request: " + e.getMessage(), e);
                // Attempt to send a 500 if headers haven't been sent yet
                try {
                    byte[] errBody = "Internal Server Error".getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "text/plain");
                    exchange.sendResponseHeaders(500, errBody.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(errBody);
                    }
                } catch (IOException ignored) {
                    // Headers may already be committed; nothing more we can do
                }
            }
        }
    }
}
