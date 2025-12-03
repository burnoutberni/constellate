#!/usr/bin/env node
/**
 * Dependency Checker
 * Ensures all dependencies are installed and up to date before starting dev
 */

import { existsSync, statSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

function checkDependencies(dir, name) {
    const packageJson = join(dir, 'package.json')
    const packageLock = join(dir, 'package-lock.json')
    const nodeModules = join(dir, 'node_modules')

    if (!existsSync(packageJson)) {
        console.log(`⚠️  ${name}: package.json not found, skipping...`)
        return false
    }

    // Check if node_modules exists
    if (!existsSync(nodeModules)) {
        console.log(`📦 ${name}: Installing dependencies (node_modules missing)...`)
        execSync('npm ci', { cwd: dir, stdio: 'inherit' })
        return true
    }

    // Check if node_modules is empty
    try {
        const files = execSync('ls -A node_modules 2>/dev/null | head -1', { 
            cwd: dir, 
            encoding: 'utf-8',
            stdio: 'pipe'
        }).trim()
        
        if (!files) {
            console.log(`📦 ${name}: Installing dependencies (node_modules empty)...`)
            execSync('npm ci', { cwd: dir, stdio: 'inherit' })
            return true
        }
    } catch (e) {
        // If command fails, node_modules might be empty
        console.log(`📦 ${name}: Installing dependencies (node_modules check failed)...`)
        execSync('npm ci', { cwd: dir, stdio: 'inherit' })
        return true
    }

    // Check if package files are newer than node_modules
    if (existsSync(packageLock)) {
        const packageJsonTime = statSync(packageJson).mtime
        const packageLockTime = statSync(packageLock).mtime
        const nodeModulesTime = statSync(nodeModules).mtime
        
        const newestPackageTime = packageJsonTime > packageLockTime ? packageJsonTime : packageLockTime
        
        if (newestPackageTime > nodeModulesTime) {
            console.log(`📦 ${name}: Updating dependencies (package files changed)...`)
            execSync('npm ci', { cwd: dir, stdio: 'inherit' })
            return true
        }
    } else {
        // No lock file, check if package.json changed
        const packageJsonTime = statSync(packageJson).mtime
        const nodeModulesTime = statSync(nodeModules).mtime
        
        if (packageJsonTime > nodeModulesTime) {
            console.log(`📦 ${name}: Installing dependencies (no lock file, package.json changed)...`)
            execSync('npm install', { cwd: dir, stdio: 'inherit' })
            return true
        }
    }

    console.log(`✅ ${name}: Dependencies are up to date`)
    return false
}

// Detect if we're running in Docker
// Docker containers typically have /.dockerenv file
// Also check for common Docker environment indicators
const isDocker = existsSync('/.dockerenv') || 
                 process.env.DOCKER === 'true' || 
                 process.env.IN_DOCKER === 'true' ||
                 // Check if we're in a containerized environment (Docker container IDs are 12 hex chars)
                 (process.env.HOSTNAME && /^[a-f0-9]{12}$/.test(process.env.HOSTNAME))

// Only run in non-Docker environments (Docker uses dev-entrypoint.sh)
// Also skip if explicitly disabled or in CI
if (!isDocker && process.env.SKIP_DEPS_CHECK !== 'true' && !process.env.CI) {
    console.log('🔄 Checking dependencies...\n')
    
    const serverUpdated = checkDependencies(rootDir, 'Server')
    const clientUpdated = checkDependencies(join(rootDir, 'client'), 'Client')
    
    if (serverUpdated || clientUpdated) {
        console.log('\n✅ Dependencies updated successfully!')
    } else {
        console.log('\n✅ All dependencies are up to date!')
    }
} else {
    if (isDocker) {
        console.log('ℹ️  Running in Docker - dependency check handled by dev-entrypoint.sh')
    } else {
        console.log('ℹ️  Skipping dependency check (CI or SKIP_DEPS_CHECK=true)')
    }
}

