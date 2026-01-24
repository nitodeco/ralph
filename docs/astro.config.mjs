import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import compress from "astro-compress";

export default defineConfig({
  site: "https://nitodeco.github.io",
  base: "/ralph",
  trailingSlash: "always",
  output: "static",
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
    compress({
      CSS: true,
      HTML: {
        "html-minifier-terser": {
          removeComments: true,
          collapseWhitespace: true,
          removeAttributeQuotes: true,
          minifyCSS: true,
          minifyJS: true,
        },
      },
      Image: false,
      JavaScript: true,
      SVG: true,
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: "github-dark",
    },
  },
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    build: {
      cssMinify: true,
      rollupOptions: {
        external: ["/ralph/pagefind/pagefind.js"],
      },
    },
  },
});
