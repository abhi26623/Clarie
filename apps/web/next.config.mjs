/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@shipflow/api", "@shipflow/auth", "@shipflow/db", "@shipflow/jobs", "@shipflow/ai", "@shipflow/config", "@shipflow/ui"],
};
export default nextConfig;
