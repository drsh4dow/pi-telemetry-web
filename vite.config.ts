import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const nitroPreset = process.env.NITRO_PRESET ?? "bun";

export default defineConfig({
	server: {
		port: Number(process.env.PORT ?? 3000),
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		tailwindcss(),
		tanstackStart({
			srcDirectory: "src",
		}),
		viteReact(),
		nitro({
			preset: nitroPreset,
			...(nitroPreset === "vercel"
				? { vercel: { functions: { runtime: "bun1.x" } } }
				: {}),
		}),
	],
});
