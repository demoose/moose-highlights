import { defineConfig } from "tinacms";

// Your hosting provider likely exposes this as an environment variable
const branch =
  process.env.HEAD || process.env.VERCEL_GIT_COMMIT_REF || "master";

export default defineConfig({
  branch,
  clientId: process.env.TINA_PUBLIC_CLIENT_ID, // Get this from tina.io
  token: process.env.TINA_TOKEN, // Get this from tina.io

  build: {
    outputFolder: "admin",
    publicFolder: "/_site",
  },
  media: {
    tina: {
      mediaRoot: "/assets/images/covers",
      publicFolder: "./",
    },
  },
  schema: {
    collections: [
      {
        name: "post",
        label: "Books",
        path: "posts",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "book",
            label: "Book Slug",
            required: true,
          },
          {
            type: "string",
            name: "author",
            label: "Author",
            required: true,
          },
          {
            type: "datetime",
            name: "date",
            label: "Date",
            required: true,
          },
          {
            type: "number",
            name: "rating",
            label: "Rating",
            required: true,
          },
          {
            type: "string",
            name: "progress",
            label: "Progress",
            required: true,
          },
          {
            type: "number",
            name: "bookshop",
            label: "Bookshop ID",
            required: true,
          },
        ],
      },
      {
        name: "notes",
        label: "Notes",
        path: "_data/books",
        format: "yaml",
        fields: [
          {
            label: "Notes",
            name: "notes",
            type: "object",
            list: true,
            ui: {
              itemProps: (item) => {
                return { label: `${item?.recipe}` };
              },
            },
            fields: [
              {
                type: "string",
                name: "text",
                label: "Note",
                required: true,
              },
              {
                type: "string",
                name: "recipe",
                label: "Recipe",
                required: true,
              },
              {
                type: "string",
                name: "rating",
                label: "Rating",
                required: true,
              },
            ],
          },
        ],
      },
    ],
  },
});
