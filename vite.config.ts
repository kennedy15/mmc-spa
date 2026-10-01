import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The GitHub repo this build belongs to ("owner/name"): GitHub Actions sets
 * GITHUB_REPOSITORY; locally it comes from the git remote. A copy of the repo
 * (a friend's tracker) builds for its own address and its own workflows
 * without editing anything.
 */
function githubRepo(): string | null {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  try {
    const url = execSync('git config --get remote.origin.url', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1] ?? null
  } catch {
    return null
  }
}

const repo = githubRepo()
const [owner, repoName] = repo?.split('/') ?? []
// The one repo GitHub Pages serves from the root of <owner>.github.io.
const userSite = !!repoName && repoName.toLowerCase() === `${owner}.github.io`.toLowerCase()

// GitHub Pages serves a project repo from /<repo>/ and the <owner>.github.io repo from /.
// Override with VITE_BASE=/ for a local build served from the root.
export default defineConfig({
  base: process.env.VITE_BASE ?? (repoName && !userSite ? `/${repoName}/` : '/'),
  define: { __GITHUB_REPO__: JSON.stringify(repo) },
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1500 },
})
