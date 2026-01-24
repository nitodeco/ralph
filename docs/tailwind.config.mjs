import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand)",
          hover: "var(--color-brand-hover)",
          subtle: "var(--color-brand-subtle)",
        },
        bg: {
          DEFAULT: "var(--color-bg)",
          elevated: "var(--color-bg-elevated)",
          subtle: "var(--color-bg-subtle)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          muted: "var(--color-text-muted)",
          subtle: "var(--color-text-subtle)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          subtle: "var(--color-border-subtle)",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      typography: ({ theme }) => ({
        invert: {
          css: {
            "--tw-prose-body": theme("colors.text.DEFAULT"),
            "--tw-prose-headings": theme("colors.text.DEFAULT"),
            "--tw-prose-lead": theme("colors.text.muted"),
            "--tw-prose-links": theme("colors.brand.DEFAULT"),
            "--tw-prose-bold": theme("colors.text.DEFAULT"),
            "--tw-prose-counters": theme("colors.text.muted"),
            "--tw-prose-bullets": theme("colors.text.subtle"),
            "--tw-prose-hr": theme("colors.border.DEFAULT"),
            "--tw-prose-quotes": theme("colors.text.DEFAULT"),
            "--tw-prose-quote-borders": theme("colors.border.DEFAULT"),
            "--tw-prose-captions": theme("colors.text.muted"),
            "--tw-prose-code": theme("colors.text.DEFAULT"),
            "--tw-prose-pre-code": theme("colors.text.DEFAULT"),
            "--tw-prose-pre-bg": theme("colors.bg.elevated"),
            "--tw-prose-th-borders": theme("colors.border.DEFAULT"),
            "--tw-prose-td-borders": theme("colors.border.subtle"),
          },
        },
        cyan: {
          css: {
            "--tw-prose-links": theme("colors.brand.DEFAULT"),
            a: {
              "&:hover": {
                color: theme("colors.brand.hover"),
              },
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
};
