import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const books = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    date: z.coerce.date(),
    rating: z.union([z.number(), z.string()]).optional(),
    progress: z.string().optional(),
    bookshop: z.union([z.number(), z.string()]).optional(),
    spoilers: z.boolean().optional(),
    coffee: z.boolean().optional(),
    png: z.string(),
    webp: z.string(),
    notes: z
      .array(
        z.object({
          recipe: z.string(),
          rating: z.union([z.string(), z.number()]).optional(),
          text: z.string().optional(),
          attribution: z.string().optional(),
        })
      )
      .default([]),
  }),
});

export const collections = { books };
