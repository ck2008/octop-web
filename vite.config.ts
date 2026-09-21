import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * GitHub Pages project sites are served from https://<user>.github.io/<repo>/,
 * so the bundle needs a matching base path. Order of precedence:
 *
 *   1. VITE_BASE_PATH        - explicit override (workflow input / local preview)
 *   2. GITHUB_REPOSITORY     - derived automatically inside GitHub Actions
 *   3. '/'                   - local dev and user/organisation pages
 *
 * Deriving from GITHUB_REPOSITORY means a fork never has to edit source code.
 */
function resolveBase(): string {
  const explicit = process.env.VITE_BASE_PATH?.trim()
  if (explicit) {
    return explicit.endsWith('/') ? explicit : `${explicit}/`
  }

  const repository = process.env.GITHUB_REPOSITORY?.trim()
  if (process.env.GITHUB_ACTIONS === 'true' && repository) {
    const [owner, name] = repository.split('/')
    // <user>.github.io is served from the domain root, not a sub path.
    if (name && name.toLowerCase() !== `${owner.toLowerCase()}.github.io`) {
      return `/${name}/`
    }
  }

  return '/'
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
})
