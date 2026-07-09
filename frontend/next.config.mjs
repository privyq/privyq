/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server build so the Docker image can run `node server.js`
  // without copying node_modules (see Dockerfile).
  output: "standalone",
};

export default nextConfig;
