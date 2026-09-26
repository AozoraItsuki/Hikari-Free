module.exports = {
  apps: [
    {
      name: 'hikari',
      script: 'main.js',
      interpreter: 'node',
      node_args: '--expose-gc --import tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        FORCE_COLOR: '1',
        NODE_ENV: 'production',
      },
    },
  ],
};
