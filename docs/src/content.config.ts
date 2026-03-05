import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({ base: "./src/content/docs", pattern: "**/*.md" }),
  schema: z.object({
    canonical: z.string().optional(),
    description: z.string(),
    faq: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .optional(),
    keywords: z.array(z.string()).optional(),
    sidebar: z.object({
      order: z.number(),
      label: z.string().optional(),
    }),
    tags: z.array(z.string()).optional(),
    title: z.string(),
  }),
});

export const collections = { docs };
