#!/usr/bin/env node

/**
 * System Health Check Script
 * Diagnóstico completo do sistema Kingston Chat App
 */

// Usar fetch nativo do Node.js 18+
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkBackendHealth() {
  log('\n🔍 Checking Backend Health...', 'cyan');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    const health = await response.json();
    
    log(`\n📊 Overall Status: ${health.status.toUpperCase()}`, 
        health.status === 'healthy' ? 'green' : 
        health.status === 'degraded' ? 'yellow' : 'red');
    
    log('\n📈 Component Status:', 'blue');
    
    // Claude Code SDK
    const claude = health.checks.claude_code_sdk;
    log(`  • Claude Code SDK: ${claude.status}`, 
        claude.status === 'healthy' ? 'green' : 'red');
    if (claude.isLimitReached) {
      log(`    ⏰ Reset time: ${claude.resetTime}`, 'yellow');
    }
    
    // MCP Neo4j
    const mcp = health.checks.mcp_neo4j;
    log(`  • MCP Neo4j: ${mcp.status}`, 
        mcp.status === 'healthy' ? 'green' : 'red');
    if (!mcp.connected) {
      log(`    ❌ Connection attempts: ${mcp.connectionAttempts}/${mcp.maxRetries}`, 'red');
    }
    
    // AI SDK v5
    const aiSdk = health.checks.ai_sdk_v5;
    log(`  • AI SDK v5: ${aiSdk.status}`, 
        aiSdk.status === 'healthy' ? 'green' : 
        aiSdk.status === 'disabled' ? 'yellow' : 'red');
    
    // A2A Agents
    const a2a = health.checks.a2a_agents;
    log(`  • A2A Agents: ${a2a.status} (${a2a.availableAgents} available)`, 
        a2a.status === 'healthy' ? 'green' : 'yellow');
    
    // Socket.IO
    const socketio = health.checks['socket.io'];
    log(`  • Socket.IO: ${socketio.status} (${socketio.connectedClients} clients)`, 
        socketio.status === 'healthy' ? 'green' : 'yellow');
    
    // System Memory
    const memory = health.checks.system_memory;
    log(`  • Memory: ${memory.status} (${memory.system.usagePercent}% used)`, 
        memory.status === 'healthy' ? 'green' : 'yellow');
    
    return health;
  } catch (error) {
    log(`❌ Backend health check failed: ${error.message}`, 'red');
    return null;
  }
}

async function checkProcesses() {
  log('\n🔍 Checking System Processes...', 'cyan');
  
  const processes = [
    { name: 'Node.js Backend', command: 'lsof -i :8080' },
    { name: 'React Frontend', command: 'lsof -i :3000' },
    { name: 'Neo4j Database', command: 'ps aux | grep neo4j | grep -v grep' },
    { name: 'Claude Process', command: 'ps aux | grep -i claude | grep -v grep' }
  ];
  
  for (const proc of processes) {
    try {
      const { stdout } = await execAsync(proc.command);
      const isRunning = stdout.trim().length > 0;
      log(`  • ${proc.name}: ${isRunning ? '✅ Running' : '❌ Not running'}`, 
          isRunning ? 'green' : 'red');
    } catch (error) {
      log(`  • ${proc.name}: ❌ Not running`, 'red');
    }
  }
}

async function checkPorts() {
  log('\n🔍 Checking Network Ports...', 'cyan');
  
  const ports = [
    { port: 8080, service: 'Backend API' },
    { port: 3000, service: 'Frontend Dev Server' },
    { port: 7474, service: 'Neo4j Browser' },
    { port: 7687, service: 'Neo4j Bolt' }
  ];
  
  for (const { port, service } of ports) {
    try {
      const { stdout } = await execAsync(`lsof -i :${port} | grep LISTEN`);
      const isOpen = stdout.trim().length > 0;
      log(`  • Port ${port} (${service}): ${isOpen ? '✅ Open' : '⚠️ Closed'}`, 
          isOpen ? 'green' : 'yellow');
    } catch (error) {
      log(`  • Port ${port} (${service}): ⚠️ Closed`, 'yellow');
    }
  }
}

async function checkEnvironment() {
  log('\n🔍 Checking Environment Variables...', 'cyan');
  
  const requiredVars = [
    'USE_AI_SDK_V5',
    'NEO4J_URI',
    'NEO4J_USER',
    'CLAUDE_API_KEY'
  ];
  
  const missingVars = [];
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      log(`  • ${varName}: ✅ Set`, 'green');
    } else {
      log(`  • ${varName}: ❌ Missing`, 'red');
      missingVars.push(varName);
    }
  }
  
  return missingVars;
}

async function generateReport(healthData) {
  log('\n📋 DIAGNOSTIC REPORT', 'magenta');
  log('═══════════════════════════════════════', 'magenta');
  
  const timestamp = new Date().toISOString();
  log(`\n📅 Timestamp: ${timestamp}`, 'blue');
  
  if (healthData) {
    log(`\n🏥 System Health: ${healthData.status.toUpperCase()}`, 
        healthData.status === 'healthy' ? 'green' : 
        healthData.status === 'degraded' ? 'yellow' : 'red');
    
    log(`\n📊 Summary:`, 'blue');
    log(`  • Total checks: ${healthData.summary.total}`);
    log(`  • Healthy: ${healthData.summary.healthy}`, 'green');
    log(`  • Unhealthy: ${healthData.summary.unhealthy}`, 'red');
    log(`  • Errors: ${healthData.summary.errors}`, 'red');
    log(`  • Warnings: ${healthData.summary.warnings}`, 'yellow');
  }
  
  log('\n🔧 Recommendations:', 'yellow');
  
  if (!healthData || healthData.status === 'unhealthy') {
    log('  1. Check if backend server is running: npm start', 'yellow');
    log('  2. Verify Neo4j connection settings', 'yellow');
    log('  3. Check Claude API key and limits', 'yellow');
    log('  4. Review error logs: tail -f logs/error.log', 'yellow');
  } else if (healthData && healthData.status === 'degraded') {
    log('  1. Monitor degraded components', 'yellow');
    log('  2. Check system resources', 'yellow');
    log('  3. Consider restarting affected services', 'yellow');
  } else {
    log('  ✅ System is healthy - no immediate actions required', 'green');
  }
  
  log('\n═══════════════════════════════════════', 'magenta');
}

async function main() {
  log('\n🚀 Kingston Chat App - System Diagnostics', 'cyan');
  log('═══════════════════════════════════════', 'cyan');
  
  // 1. Check backend health
  const healthData = await checkBackendHealth();
  
  // 2. Check system processes
  await checkProcesses();
  
  // 3. Check network ports
  await checkPorts();
  
  // 4. Check environment
  const missingVars = await checkEnvironment();
  
  // 5. Generate report
  await generateReport(healthData);
  
  // Exit code based on health
  if (!healthData || healthData.status === 'unhealthy') {
    process.exit(1);
  } else if (healthData.status === 'degraded') {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, 'red');
  process.exit(1);
});

// Run diagnostics
main().catch(error => {
  log(`\n❌ Diagnostic failed: ${error.message}`, 'red');
  process.exit(1);
});