module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    // Converts `import.meta.env.VITE_*` to `process.env.VITE_*` so Jest can parse it
    'babel-plugin-transform-vite-meta-env',
  ],
  // If you ever add per-package .babelrc files, this allows resolving them.
  babelrcRoots: ['.', './client'],
};
