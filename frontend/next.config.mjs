import path from 'path';
import { fileURLToPath } from 'url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const nextConfig = {
  // reactStrictMode: false, // to avoid multiple components mount in dev mode, remove the comment
  output: 'standalone',
  pageExtensions: ['jsx', 'js'],
  images: {
    domains: ['fakeimg.pl'],
  },
  compiler: {
    styledComponents: true,
  },
  webpack(config) {
    const conf = config;
    conf.module.rules.push({
      test: /\.custom\.scss$/,
      use: ['style-loader', 'css-loader', 'sass-loader'],
    });
    conf.resolve.alias['#components'] = path.join(dirname, 'assets/components');
    conf.resolve.alias['#img'] = path.join(dirname, 'assets/img');
    conf.resolve.alias['#js'] = path.join(dirname, 'assets/js');
    conf.resolve.alias['#modules'] = path.join(dirname, 'assets/modules');
    conf.resolve.alias['#scss'] = path.join(dirname, 'assets/scss');
    conf.resolve.alias['#config'] = path.join(dirname, 'config');

    return conf;
  },
};

export default nextConfig;
