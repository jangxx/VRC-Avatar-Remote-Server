const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: "/build",
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
        target: "http://127.0.0.1:8080/",
      },
      "/i": {
        target: "http://127.0.0.1:8080/",
      },
      "/socket.io": {
        target: "http://127.0.0.1:8080/",
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
