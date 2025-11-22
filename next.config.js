const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    webpack: (config) => {
        // Allow importing audio worklet files
        config.module.rules.push({
            test: /\.worklet\.js$/,
            type: 'asset/source',
        });

        return config;
    },
};

module.exports = withBundleAnalyzer(nextConfig);
