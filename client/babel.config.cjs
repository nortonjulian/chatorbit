module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  // If you ever add more packages, this keeps per-package .babelrcs working.
  babelrcRoots: ['.', './client'],
};
