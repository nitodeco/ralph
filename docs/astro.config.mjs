import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://nitodeco.github.io",
  base: "/ralph",
  trailingSlash: "always",
  output: "static",
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
  ],
  markdown: {
    shikiConfig: {
      theme: "github-dark",
    },
  },
  vite: {
    build: {
      rollupOptions: {
        external: ["/ralph/pagefind/pagefind.js"],
      },
    },
  },
});
