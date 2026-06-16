/** @type {import('next').NextConfig} */
const appUrlHost = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).host : null;
  } catch {
    return null;
  }
})();

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
      // Allow server actions when the app is accessed through a custom domain and/or
      // an Elastic Beanstalk CNAME (reverse proxy / forwarded host scenarios).
      allowedOrigins: Array.from(
        new Set(
          [
            "builder.housingpa.com",
            "builder-housingpa-live.us-east-2.elasticbeanstalk.com",
            appUrlHost
          ].filter(Boolean)
        )
      )
    }
  }
};

module.exports = nextConfig;
