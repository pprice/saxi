/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, {mode = 'development'}) => ({
  entry: './src/ui.tsx',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist', 'ui')
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [{
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.web.json'
          }
        }]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.svg$/,
        use: ['file-loader'],
      },
      {
        test: /\.worker.js/,
        use: ['worker-loader'],
      },
    ]
  },
  resolve: {
    extensions: ['*', '.ts', '.tsx', '.js', '.jsx']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new webpack.DefinePlugin({
      IS_WEB: !!process.env['IS_WEB']
    }),
  ],
  devtool: mode === 'development' ? 'inline-source-map' : 'source-map',
});
