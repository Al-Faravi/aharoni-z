module.exports = {
  apps: [
    {
      name: "aharoni-backend",
      script: "./server/index.js",
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "aharoni-tunnel",
      script: "cloudflared.exe",
      args: "tunnel --url http://localhost:7860",
      watch: false
    }
  ]
};