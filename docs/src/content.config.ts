import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		sidebar: z.object({
			order: z.number(),
			label: z.string().optional(),
		}),
		tags: z.array(z.string()).optional(),
		keywords: z.array(z.string()).optional(),
		canonical: z.string().optional(),
	}),
});

export const collections = { docs };
