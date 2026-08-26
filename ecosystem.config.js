module.exports = {
  apps: [
    {
      name: 'prayer-wall',
      script: 'server/index.js',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
