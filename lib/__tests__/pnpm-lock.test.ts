import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../')
const LOCKFILE_PATH = resolve(ROOT, 'pnpm-lock.yaml')
const PACKAGE_JSON_PATH = resolve(ROOT, 'package.json')

function readLockfile(): string {
  return readFileSync(LOCKFILE_PATH, 'utf-8')
}

function readPackageJson(): {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  packageManager?: string
  pnpm?: { overrides?: Record<string, string> }
} {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'))
}

describe('pnpm-lock.yaml integrity', () => {
  it('should exist at the project root', () => {
    expect(existsSync(LOCKFILE_PATH)).toBe(true)
  })

  it('should not be empty', () => {
    const content = readLockfile()
    expect(content.trim().length).toBeGreaterThan(0)
  })

  it('should use lockfile version 9.0', () => {
    const content = readLockfile()
    expect(content).toMatch(/^lockfileVersion:\s+['"]?9\.0['"]?/m)
  })

  it('should have autoInstallPeers enabled', () => {
    const content = readLockfile()
    expect(content).toMatch(/autoInstallPeers:\s+true/)
  })

  it('should contain all production dependencies from package.json', () => {
    const lockContent = readLockfile()
    const pkg = readPackageJson()

    const missing: string[] = []
    for (const dep of Object.keys(pkg.dependencies)) {
      // In pnpm-lock.yaml v9, deps appear under importers > . > dependencies
      // The package name appears as a key (possibly quoted for scoped packages)
      const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`['"]?${escaped}['"]?:`)
      if (!pattern.test(lockContent)) {
        missing.push(dep)
      }
    }

    expect(missing).toEqual([])
  })

  it('should contain all dev dependencies from package.json', () => {
    const lockContent = readLockfile()
    const pkg = readPackageJson()

    const missing: string[] = []
    for (const dep of Object.keys(pkg.devDependencies)) {
      const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`['"]?${escaped}['"]?:`)
      if (!pattern.test(lockContent)) {
        missing.push(dep)
      }
    }

    expect(missing).toEqual([])
  })

  it('should reflect all pnpm overrides', () => {
    const lockContent = readLockfile()
    const pkg = readPackageJson()
    const overrides = pkg.pnpm?.overrides ?? {}

    const missing: string[] = []
    for (const [name, version] of Object.entries(overrides)) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const versionEscaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`['"]?${escaped}['"]?:\\s+['"]?${versionEscaped}['"]?`)
      if (!pattern.test(lockContent)) {
        missing.push(`${name}@${version}`)
      }
    }

    expect(missing).toEqual([])
  })

  it('should not contain npm or yarn lockfiles', () => {
    expect(existsSync(resolve(ROOT, 'package-lock.json'))).toBe(false)
    expect(existsSync(resolve(ROOT, 'yarn.lock'))).toBe(false)
  })

  it('should specify pnpm as the packageManager in package.json', () => {
    const pkg = readPackageJson()
    expect(pkg.packageManager).toBeDefined()
    expect(pkg.packageManager).toMatch(/^pnpm@/)
  })

  it('should not contain integrity hash mismatches (no merge conflict markers)', () => {
    const content = readLockfile()
    expect(content).not.toMatch(/^<{7}/m)
    expect(content).not.toMatch(/^>{7}/m)
    expect(content).not.toMatch(/^={7}/m)
  })

  it('should be valid YAML (no tabs for indentation)', () => {
    const content = readLockfile()
    const lines = content.split('\n')
    const tabLines: number[] = []

    for (let i = 0; i < lines.length; i++) {
      if (/^\t/.test(lines[i])) {
        tabLines.push(i + 1)
      }
    }

    expect(tabLines).toEqual([])
  })

  it('should have a packages section', () => {
    const content = readLockfile()
    expect(content).toMatch(/^packages:/m)
  })

  it('should have a snapshots section', () => {
    const content = readLockfile()
    expect(content).toMatch(/^snapshots:/m)
  })
})
