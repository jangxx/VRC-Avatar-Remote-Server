const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  pages: {
    index: {
      entry: "src/main.js",
      template: "public/index.html",
      filename: "index.html",
    },
    admin: {
      entry: "src/admin.js",
      template: "public/admin.html",
      filename: "admin.html",
    },
  },
  devServer: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8080/",
      },
      "/socket.io": {
        target: "http://localhost:8080/",
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
