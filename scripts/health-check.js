#!/usr/bin/env node

const http = require('http')

const host = process.env.HOST || 'localhost'
const port = process.env.PORT || 3000
const path = '/api/health'

const options = {
  hostname: host,
  port: port,
  path: path,
  method: 'GET',
  timeout: 10000,
}

console.log(`Checking health at http://${host}:${port}${path}`)

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    try {
      const health = JSON.parse(data)
      console.log('\n=== Health Check Results ===')
      console.log(`Status: ${health.status}`)
      console.log(`Timestamp: ${health.timestamp}`)
      console.log(`Version: ${health.version}`)
      console.log(`Uptime: ${Math.round(health.uptime)}s`)
      console.log(`Environment: ${health.environment}`)

      console.log('\nServices:')
      Object.entries(health.services).forEach(([name, status]) => {
        const icon = status.status === 'healthy' ? '[OK]' : status.status === 'degraded' ? '[WARN]' : '[ERROR]'
        const latency = status.latency ? ` (${status.latency}ms)` : ''
        const error = status.error ? ` - ${status.error}` : ''
        console.log(`  ${icon} ${name}: ${status.status}${latency}${error}`)
      })

      if (res.statusCode === 200) {
        console.log('\n[HEALTHY] Application is running correctly')
        process.exit(0)
      } else if (res.statusCode === 503) {
        console.log('\n[UNHEALTHY] Application has issues')
        process.exit(1)
      } else {
        console.log(`\n[UNKNOWN] Unexpected status code: ${res.statusCode}`)
        process.exit(1)
      }
    } catch (e) {
      console.error('Failed to parse health check response:', e.message)
      process.exit(1)
    }
  })
})

req.on('error', (error) => {
  console.error(`Health check failed: ${error.message}`)
  process.exit(1)
})

req.on('timeout', () => {
  console.error('Health check timed out')
  req.destroy()
  process.exit(1)
})

req.end()
