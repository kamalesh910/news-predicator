/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment.
  // This bundles the server and its dependencies into .next/standalone,
  // allowing the container to run with just `node server.js`.
  output: 'standalone',
};

module.exports = nextConfig;
