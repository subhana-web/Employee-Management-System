/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ufhmdokrjjwkfnldtjqm.supabase.co',
        pathname: '/storage/v1/object/public/profile-photos/**',
      },
    ],
  },
};

module.exports = nextConfig;