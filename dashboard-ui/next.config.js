/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment.
  // This bundles the server and its dependencies into .next/standalone,
  // allowing the container to run with just `node server.js`.
  output: 'standalone',

  // Proxy /api/* to the API Gateway so the browser never needs to know
  // the gateway's host — it always calls the same origin as the dashboard.
  // The destination uses API_GATEWAY_URL (server-side only, safe for Docker).
  async rewrites() {
    const apiGatewayUrl =
      process.env.API_GATEWAY_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiGatewayUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
