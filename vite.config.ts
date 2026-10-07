/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./", // relative paths: works on any host/subpath (same as GreenMacros)
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest,woff2}"],
        navigateFallback: "index.html",
        // Exercise images are not precached (15 MB); each is cached the first time it is seen.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/ex/") && url.pathname.endsWith(".webp"),
            handler: "CacheFirst",
            options: { cacheName: "exercise-images", expiration: { maxEntries: 2000 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      manifest: {
        name: "GreenCoach",
        short_name: "GreenCoach",
        description: "Free training tracker with a smart coach. No accounts, no tracking, works offline.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#0b0f14",
        theme_color: "#0b0f14",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: { environment: "node", include: ["src/**/*.test.ts"], setupFiles: ["src/test-setup.ts"] },
});
