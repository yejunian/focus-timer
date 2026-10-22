import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

// GitHub Pages project site is served from https://<user>.github.io/<repo>/,
// so the app needs to know its base path in production builds.
const base = "/focus-timer";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },

      // Fully static output for GitHub Pages. `fallback` makes GitHub Pages serve
      // the SPA shell for any path that was not prerendered.
      // See https://svelte.dev/docs/kit/adapter-static
      adapter: adapter({ fallback: "404.html" }),

      paths: {
        base: command === "build" ? base : "",
      },
    }),
  ],
}));
