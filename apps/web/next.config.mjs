/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@claire/api", "@claire/auth", "@claire/db", "@claire/jobs", "@claire/ai", "@claire/config", "@claire/ui"],
};
export default nextConfig;
