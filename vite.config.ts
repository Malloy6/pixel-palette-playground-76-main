// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  vite: {
    base: "/",
    server: {
      host: "0.0.0.0",
      // Required when the app is accessed through the production reverse proxy.
      // Keep this explicit rather than allowing arbitrary Host headers.
      allowedHosts: ["elimusphere.co.ke", "www.elimusphere.co.ke"],
      // Performance optimization
      middlewareMode: false,
    },
    preview: {
      host: "0.0.0.0",
      allowedHosts: ["elimusphere.co.ke", "www.elimusphere.co.ke"],
    },
    build: {
      chunkSizeWarningLimit: 500,
      // Keep prior fingerprinted assets available to already-open pages during deploys.
      emptyOutDir: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
    // CSS optimization
    css: {
      minify: true,
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
