import { defineConfig } from "tinacms";

// Your hosting provider likely exposes this as an environment variable
const branch = process.env.HEAD || process.env.VERCEL_GIT_COMMIT_REF || "main";

export default defineConfig({
  branch,
  clientId: "b0a13e67-4209-4424-a294-a09054d1021b", // Get this from tina.io
  token: "041e163004e3ec77849d20c0242d39aa21931411", // Get this from tina.io

  build: {
    outputFolder: "admin",
    publicFolder: "./",
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
