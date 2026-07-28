// vite.config.ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "file:///C:/Users/siltn/Documents/StudentJob/loamaCopy/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/Users/siltn/Documents/StudentJob/loamaCopy/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import vueDevTools from "file:///C:/Users/siltn/Documents/StudentJob/loamaCopy/node_modules/vite-plugin-vue-devtools/dist/vite.mjs";
import svgLoader from "file:///C:/Users/siltn/Documents/StudentJob/loamaCopy/node_modules/vite-svg-loader/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/siltn/Documents/StudentJob/loamaCopy/loama/vite.config.ts";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const config = {
    plugins: [
      vue(),
      vueDevTools(),
      svgLoader()
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
      }
    },
    // available in app as import.meta.env.BASE_URL
    base: env.VITE_BASE || "/"
  };
  return config;
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzaWx0blxcXFxEb2N1bWVudHNcXFxcU3R1ZGVudEpvYlxcXFxsb2FtYUNvcHlcXFxcbG9hbWFcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHNpbHRuXFxcXERvY3VtZW50c1xcXFxTdHVkZW50Sm9iXFxcXGxvYW1hQ29weVxcXFxsb2FtYVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvc2lsdG4vRG9jdW1lbnRzL1N0dWRlbnRKb2IvbG9hbWFDb3B5L2xvYW1hL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSAnbm9kZTp1cmwnXHJcblxyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xyXG5pbXBvcnQgdnVlIGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZSdcclxuaW1wb3J0IHZ1ZURldlRvb2xzIGZyb20gJ3ZpdGUtcGx1Z2luLXZ1ZS1kZXZ0b29scydcclxuaW1wb3J0IHN2Z0xvYWRlciBmcm9tICd2aXRlLXN2Zy1sb2FkZXInXHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCkpO1xyXG4gICAgY29uc3QgY29uZmlnID0ge1xyXG4gICAgICAgIHBsdWdpbnM6IFtcclxuICAgICAgICAgICAgdnVlKCksXHJcbiAgICAgICAgICAgIHZ1ZURldlRvb2xzKCksXHJcbiAgICAgICAgICAgIHN2Z0xvYWRlcigpXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvbHZlOiB7XHJcbiAgICAgICAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgICAgICAgICAnQCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvLyBhdmFpbGFibGUgaW4gYXBwIGFzIGltcG9ydC5tZXRhLmVudi5CQVNFX1VSTFxyXG4gICAgICAgIGJhc2U6IGVudi5WSVRFX0JBU0UgfHwgJy8nXHJcbiAgICB9XHJcbiAgICByZXR1cm4gY29uZmlnO1xyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlWLFNBQVMsZUFBZSxXQUFXO0FBRTVYLFNBQVMsY0FBYyxlQUFlO0FBQ3RDLE9BQU8sU0FBUztBQUNoQixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLGVBQWU7QUFMcU0sSUFBTSwyQ0FBMkM7QUFRNVEsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDdEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksQ0FBQztBQUN2QyxRQUFNLFNBQVM7QUFBQSxJQUNYLFNBQVM7QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxJQUNkO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDTCxPQUFPO0FBQUEsUUFDSCxLQUFLLGNBQWMsSUFBSSxJQUFJLFNBQVMsd0NBQWUsQ0FBQztBQUFBLE1BQ3hEO0FBQUEsSUFDSjtBQUFBO0FBQUEsSUFFQSxNQUFNLElBQUksYUFBYTtBQUFBLEVBQzNCO0FBQ0EsU0FBTztBQUNYLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
