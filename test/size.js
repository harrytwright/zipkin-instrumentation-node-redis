#!/usr/bin/env node

const { mkdirSync, rmSync, writeFileSync } = require('fs')
const { execSync } = require('child_process')
const { join } = require('path')

function getSize (lib) {
  const testDir = join(__dirname, 'size-test')
  mkdirSync(testDir)
  writeFileSync(join(testDir, 'package.json'), '{"private":true}')
  execSync(`yarn add ${lib}`, { cwd: testDir })
  const out = execSync('du -sh node_modules/', { cwd: testDir }).toString()
  rmSync(testDir, { recursive: true, force: true })
  if (out.includes('M')) {
    return String(parseFloat(out.match(/^(\d+\.?\d*)M/)[1]) * 1024)
  } else {
    return out.match(/^(\d+)K/)[1]
  }
}

function benchmark (lib) {
  process.stdout.write(
    lib.padEnd('zipkin-instrumentation-node-redis@legacy  '.length) +
    getSize(lib).padStart(4) +
    ' KB\n'
  )
}

benchmark('redis@next')
benchmark('zipkin-instrumentation-node-redis')
benchmark('zipkin-instrumentation-node-redis@legacy')
benchmark('zipkin-instrumentation-redis')
