let ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin')
let StyleExtHtmlWebpackPlugin = require('style-ext-html-webpack-plugin')
let OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
let MiniCssExtractPlugin = require('mini-css-extract-plugin')
let HtmlWebpackPlugin = require('html-webpack-plugin')
let CopyPlugin = require('copy-webpack-plugin')
let webpack = require('webpack')
let path = require('path')

const HTML_MINIFY = {
  removeScriptTypeAttributes: true,
  sortAttributes: true,
  sortClassName: true
}

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  context: path.join(__dirname),
  devtool: 'cheap-module-source-map',
  output: {
    sourceMapFilename: '[file].map',
    filename: '[name].js',
    publicPath: '/'
  },
  module: {
    rules: [
      { test: /\.pug$/, use: 'pug-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    }),
    new HtmlWebpackPlugin({
      template: './ru.pug',
      filename: 'ru/index.html',
      minify: HTML_MINIFY
    }),
    new HtmlWebpackPlugin({
      template: './en.pug',
      filename: 'en/index.html',
      templateParameters: { langRedirect: false },
      minify: HTML_MINIFY
    }),
    new HtmlWebpackPlugin({
      template: './en.pug',
      filename: 'index.html',
      templateParameters: { langRedirect: true },
      minify: HTML_MINIFY
    }),
    new CopyPlugin([{ from: 'public/' }]),
    new webpack.optimize.ModuleConcatenationPlugin()
  ],
  devServer: {
    contentBase: path.join(__dirname, '..', 'public'),
    overlay: true,
    stats: 'errors-only',
    port: 8081,
    open: true
  }
}

if (process.env.NODE_ENV === 'production') {
  module.exports.mode = 'production'
  module.exports.devtool = false

  module.exports.module.rules[1].use[0] = MiniCssExtractPlugin.loader
  module.exports.plugins.push(new MiniCssExtractPlugin())
  module.exports.plugins.push(new StyleExtHtmlWebpackPlugin())
  module.exports.plugins.push(new ScriptExtHtmlWebpackPlugin({
    inline: 'main'
  }))
  module.exports.plugins.push(new OptimizeCssAssetsPlugin({
    cssProcessorPluginOptions: {
      preset: [
        'default',
        { discardComments: { removeAll: true } }
      ]
    }
  }))
}
