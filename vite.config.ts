import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Inlines the production JS and CSS into dist/index.html.
 * Chrome blocks external module scripts on file:// pages (origin "null"), which used to leave
 * a white page when dist/index.html was opened by double-click. Inline code needs no request,
 * so the built file works from disk, from any sub-path and from any static server.
 */
function inlineBuildAssets(): Plugin {
  return {
    name: 'promptrouter-inline-build-assets',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html']
      if (!html || html.type !== 'asset') return
      let source = String(html.source)
      for (const file of Object.values(bundle)) {
        const name = file.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const script = new RegExp(`<script type="module" crossorigin src="[./]*${name}"></script>`)
        if (file.type === 'chunk' && script.test(source)) {
          // "</script" inside the code would end the inline element early; "<\/script" is equivalent JS.
          const code = file.code.replaceAll('</script', '<\\/script')
          source = source.replace(script, () => `<script type="module">${code}</script>`)
          delete bundle[file.fileName]
        }
        const style = new RegExp(`<link rel="stylesheet" crossorigin href="[./]*${name}">`)
        if (file.type === 'asset' && style.test(source)) {
          source = source.replace(style, () => `<style>${String(file.source)}</style>`)
          delete bundle[file.fileName]
        }
      }
      html.source = source
    },
  }
}

export default defineConfig({
  // index.html lives in src/ so the project folder holds no page that only works with the dev server.
  root: 'src',
  // Relative paths keep any remaining asset references valid outside the server root.
  base: './',
  plugins: [react(), inlineBuildAssets()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
  },
})
