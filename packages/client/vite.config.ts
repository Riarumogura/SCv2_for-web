import { lingui as linguiSolidPlugin } from "@lingui-solid/vite-plugin";
import devtools from "@solid-devtools/transform";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import babelMacrosPlugin from "vite-plugin-babel-macros";
import Inspect from "vite-plugin-inspect";
import { VitePWA } from "vite-plugin-pwa";
import solidPlugin from "vite-plugin-solid";
import solidSvg from "vite-plugin-solid-svg";

import codegenPlugin from "./codegen.plugin";

const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    Inspect(),
    devtools(),
    codegenPlugin(),
    babelMacrosPlugin(),
    linguiSolidPlugin(),
    solidPlugin(),
    solidSvg({
      defaultAsComponent: false,
    }),
    VitePWA({
      srcDir: "src",
      registerType: "autoUpdate",
      filename: "serviceWorker.ts",
      strategies: "injectManifest",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4000000,
        // ffmpeg-core.wasm(32.2MB)はプリキャッシュ上限を大幅に超えるため対象から除外する
        // (動画処理用に必要時だけfetchされる想定のアセットで、事前キャッシュは不要)
        globIgnores: ["**/ffmpeg/**"],
      },
      manifest: {
        name: "Stoat",
        short_name: "Stoat",
        description: "User-first open source chat platform.",
        categories: ["communication", "chat", "messaging"],
        start_url: base,
        orientation: "portrait",
        display_override: ["window-controls-overlay"],
        display: "standalone",
        background_color: "#101823",
        theme_color: "#101823",
        icons: [
          {
            src: `${base}assets/web/android-chrome-192x192.png`,
            type: "image/png",
            sizes: "192x192",
          },
          {
            src: `${base}assets/web/android-chrome-512x512.png`,
            type: "image/png",
            sizes: "512x512",
          },
          {
            src: `${base}assets/web/monochrome.svg`,
            type: "image/svg+xml",
            sizes: "48x48 72x72 96x96 128x128 256x256",
            purpose: "monochrome",
          },
          {
            src: `${base}assets/web/masking-512x512.png`,
            type: "image/png",
            sizes: "512x512",
            purpose: "maskable",
          },
        ],
        // TODO: take advantage of shortcuts
      },
    }),
  ],
  build: {
    target: "esnext",
    rollupOptions: {
      external: ["hast"],
      output: {
        manualChunks: {
          markdown: [
            "lowlight",
            "rehype-highlight",
            "rehype-katex",
            "remark-breaks",
            "remark-gfm",
            "remark-math",
            "remark-parse",
            "remark-rehype",
            "vfile",
          ],
        },
      },
    },
    sourcemap: true,
  },
  optimizeDeps: {
    // CUSTOM: @ffmpeg/ffmpegは内部で `new Worker(new URL("./worker.js", import.meta.url))`
    // を使ってWorkerを生成している。esbuildのdep prebundleにかけるとこの相対URL解決が
    // 壊れ、ffmpeg.load()がworkerからの応答を永遠に待ち続けてハングする
    // (スタンプ作成で変換が終わらない不具合の原因)。除外してVite自身のworker検出付き
    // transformを通す。
    exclude: ["hast", "@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  resolve: {
    alias: {
      "styled-system": resolve(__dirname, "styled-system"),
      ...readdirSync(resolve(__dirname, "components")).reduce(
        (p, f) => ({
          ...p,
          [`@revolt/${f}`]: resolve(__dirname, "components", f),
        }),
        {},
      ),
    },
  },
});
