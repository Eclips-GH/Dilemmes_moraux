// Fichier seulement préparé : aucun service PM2 n'est lancé par les corrections.
module.exports = {
  apps: [{
    name: "dilemmes",
    script: "server.js",
    cwd: __dirname,
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_memory_restart: "256M",
    exp_backoff_restart_delay: 1000,
    kill_timeout: 5000,
    env: {
      NODE_ENV: "development", HOST: "127.0.0.1", PORT: "8000", TRUST_PROXY: "false",
    },
    env_production: {
      NODE_ENV: "production", HOST: "127.0.0.1", PORT: "8000", TRUST_PROXY: "loopback",
      PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || "",
    },
  }],
};
