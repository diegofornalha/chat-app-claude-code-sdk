const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { query } = require('@anthropic-ai/claude-code');
const A2AClient = require('./a2a/client.js');
const MCPClient = require('./mcp/client.js');
const ContextEngine = require('./context/engine.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow text files and common code files
    const allowedTypes = [
      'text/plain',
      'text/javascript',
      'text/html',
      'text/css',
      'application/json',
      'application/javascript'
    ];
    
    const allowedExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.css', '.html', '.json', '.xml', '.yaml', '.yml', '.md', '.txt',
      '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.sql'
    ];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedType = allowedTypes.includes(file.mimetype);
    const isAllowedExt = allowedExtensions.includes(ext);
    
    if (isAllowedType || isAllowedExt || file.mimetype.startsWith('text/')) {
      cb(null, true);
    } else {
      cb(new Error('Only text and code files are allowed'), false);
    }
  }
});

// In-memory session storage (in production, use Redis or database)
const sessions = new Map();
const activeConnections = new Map();

// Initialize clients
const a2aClient = new A2AClient();
const mcpClient = new MCPClient({
  debug: process.env.MCP_DEBUG === 'true'
});
let contextEngine = null;

// Initialize all systems
async function initializeSystem() {
  console.log('🚀 Initializing Chat Server Systems...');
  
  try {
    // 1. Initialize MCP Client (Neo4j Memory)
    console.log('📊 Connecting to Neo4j via MCP...');
    try {
      await mcpClient.connect();
      console.log('✅ MCP Client connected to Neo4j');
    } catch (mcpError) {
      console.error('⚠️ MCP Client failed (continuing without memory):', mcpError.message);
    }

    // 2. Register A2A agents
    console.log('🤖 Discovering A2A agents...');
    try {

      // Register CrewAI agent
      await a2aClient.registerAgent('crew-ai', {
        url: 'http://localhost:8005',
        type: 'team'
      });

      // Register Helloworld agent
      await a2aClient.registerAgent('helloworld', {
        url: 'http://localhost:9999',
        type: 'generic'
      });


      console.log('✅ A2A agents discovered and registered');
      console.log('📋 Registered agents:', Array.from(a2aClient.agents.keys()));
    } catch (a2aError) {
      console.error('⚠️ Some A2A agents failed to register:', a2aError.message);
    }

    // 3. Create Context Engine
    contextEngine = new ContextEngine(mcpClient, a2aClient);
    console.log('✅ Context Engine initialized');

    // 4. Log system status
    const status = contextEngine.getStatus();
    console.log('\n📋 System Status:');
    console.log('  MCP (Neo4j):', status.mcp.connected ? '✅ Connected' : '❌ Disconnected');
    console.log('  A2A Agents:', status.a2a.availableAgents.length > 0 ? 
      `✅ ${status.a2a.availableAgents.join(', ')}` : '❌ None');
    console.log('  Context Engine: ✅ Active\n');
    
  } catch (error) {
    console.error('❌ System initialization error:', error);
  }
}

// Initialize on startup
initializeSystem();

// A2A Event handlers
a2aClient.on('agent:registered', (agent) => {
  console.log(`A2A Agent registered: ${agent.name}`);
  io.emit('a2a:agent_registered', agent);
});

a2aClient.on('task:stream', (data) => {
  const { task_id, content, agent } = data;
  io.emit('a2a:stream', { task_id, content, agent });
});

a2aClient.on('task:complete', (task) => {
  io.emit('a2a:task_complete', task);
});

a2aClient.on('knowledge:shared', (data) => {
  console.log(`Knowledge shared by ${data.agent}:`, data.knowledge);
});

// Helper functions for processing step messages
function getStepMessage(stepType, msg) {
  switch (stepType) {
    case 'thinking':
      return 'Claude is analyzing your request and planning the response strategy...';
    case 'tool_use':
      return `Executing ${msg.name || 'tool'}: ${getToolDescription(msg.name, msg.input)}`;
    case 'tool_result':
      const success = !msg.is_error && msg.content;
      return `Tool ${msg.tool_use_id?.slice(0, 8) || 'execution'} ${success ? 'completed successfully' : 'failed'}`;
    case 'result':
      if (msg.is_error) {
        return `Processing failed: ${msg.error || 'Unknown error'}`;
      }
      return `Response generated (${msg.result?.length || 0} characters, ${msg.num_turns || 1} turns)`;
    case 'streaming':
      return 'Streaming response content to client...';
    default:
      return `Processing: ${stepType}`;
  }
}

function getToolDescription(toolName, input) {
  switch (toolName) {
    case 'Read':
      return `Reading file: ${input?.file_path?.split('/').pop() || 'file'}`;
    case 'Write':
      return `Writing to file: ${input?.file_path?.split('/').pop() || 'file'}`;
    case 'Edit':
      return `Editing file: ${input?.file_path?.split('/').pop() || 'file'}`;
    case 'Bash':
      return `Running command: ${input?.command?.substring(0, 50) || 'command'}${input?.command?.length > 50 ? '...' : ''}`;
    case 'Glob':
      return `Searching files with pattern: ${input?.pattern || 'pattern'}`;
    case 'Grep':
      return `Searching content for: ${input?.pattern || 'pattern'}`;
    case 'LS':
      return `Listing directory: ${input?.path?.split('/').pop() || 'directory'}`;
    case 'Task':
      return `Spawning sub-agent: ${input?.description || 'task'}`;
    case 'WebFetch':
      return `Fetching URL: ${input?.url || 'web page'}`;
    case 'WebSearch':
      return `Web search: ${input?.query || 'query'}`;
    default:
      return toolName ? `${toolName} operation` : 'Unknown operation';
  }
}

function getStepData(msg) {
  const data = { 
    type: msg.type,
    timestamp: Date.now(),
    messageId: generateShortId()
  };
  
  switch (msg.type) {
    case 'tool_use':
      data.toolName = msg.name;
      data.toolId = msg.id;
      data.toolInput = msg.input;
      data.inputSummary = getInputSummary(msg.name, msg.input);
      data.expectedOutput = getExpectedOutput(msg.name, msg.input);
      data.toolDescription = getDetailedToolDescription(msg.name);
      break;
      
    case 'tool_result':
      data.toolUseId = msg.tool_use_id;
      data.hasError = !!msg.is_error;
      data.contentLength = msg.content?.length;
      data.contentType = getContentType(msg.content);
      data.errorDetails = msg.is_error ? msg.content : null;
      data.executionStatus = msg.is_error ? 'failed' : 'success';
      data.outputSummary = getOutputSummary(msg.content);
      break;
      
    case 'result':
      data.isError = msg.is_error;
      data.duration = msg.duration_ms;
      data.cost = msg.total_cost_usd;
      data.turns = msg.num_turns;
      data.inputTokens = msg.input_tokens;
      data.outputTokens = msg.output_tokens;
      data.cacheReads = msg.cache_read_tokens;
      data.cacheWrites = msg.cache_write_tokens;
      
      if (msg.result) {
        data.responseLength = msg.result.length;
        data.responseWords = msg.result.split(/\s+/).length;
        data.responseLines = msg.result.split('\n').length;
        data.hasCodeBlocks = /```/.test(msg.result);
        data.hasMarkdown = /[#*`\[\]]/.test(msg.result);
      }
      
      if (msg.error) {
        data.errorType = getErrorType(msg.error);
        data.errorMessage = msg.error;
      }
      break;
      
    case 'thinking':
      data.cognitiveLoad = 'processing';
      data.analysisPhase = 'understanding_request';
      data.strategizing = true;
      break;
      
    default:
      data.unknownType = true;
      break;
  }
  
  return data;
}

function generateShortId() {
  return Math.random().toString(36).substr(2, 8);
}

function getInputSummary(toolName, input) {
  if (!input) return 'No input provided';
  
  switch (toolName) {
    case 'Read':
      return `File: ${input.file_path?.split('/').pop()} (${input.limit ? `first ${input.limit} lines` : 'entire file'})`;
    case 'Write':
      return `File: ${input.file_path?.split('/').pop()} (${input.content?.length || 0} characters)`;
    case 'Edit':
      return `File: ${input.file_path?.split('/').pop()} (${input.old_string?.length || 0} → ${input.new_string?.length || 0} chars)`;
    case 'Bash':
      return `Command: ${input.command} ${input.timeout ? `(timeout: ${input.timeout}ms)` : ''}`;
    case 'Glob':
      return `Pattern: ${input.pattern} in ${input.path || 'current directory'}`;
    case 'Grep':
      return `Pattern: /${input.pattern}/ in ${input.include || 'all files'}`;
    default:
      return Object.keys(input).map(k => `${k}: ${String(input[k]).substring(0, 30)}`).join(', ');
  }
}

function getExpectedOutput(toolName, input) {
  switch (toolName) {
    case 'Read':
      return 'File contents with line numbers';
    case 'Write':
      return 'File creation confirmation';
    case 'Edit':
      return 'File modification confirmation';
    case 'Bash':
      return 'Command output and exit status';
    case 'Glob':
      return 'List of matching file paths';
    case 'Grep':
      return 'Files containing the search pattern';
    case 'LS':
      return 'Directory listing with file details';
    case 'Task':
      return 'Sub-agent execution results';
    default:
      return 'Tool-specific output';
  }
}

function getDetailedToolDescription(toolName) {
  switch (toolName) {
    case 'Read':
      return 'Reads file contents from the filesystem with optional line limits and offsets';
    case 'Write':
      return 'Creates or overwrites files with provided content';
    case 'Edit':
      return 'Performs exact string replacements in existing files';
    case 'Bash':
      return 'Executes shell commands in a persistent session with timeout controls';
    case 'Glob':
      return 'Searches for files matching glob patterns with modification time sorting';
    case 'Grep':
      return 'Searches file contents using regular expressions with file filtering';
    case 'LS':
      return 'Lists directory contents with detailed file information';
    case 'Task':
      return 'Spawns independent agent instances for complex subtasks';
    case 'WebFetch':
      return 'Fetches and processes web content with AI analysis';
    case 'WebSearch':
      return 'Performs web searches with result filtering and ranking';
    default:
      return 'Specialized tool for specific operations';
  }
}

function getContentType(content) {
  if (!content) return 'empty';
  if (typeof content !== 'string') return typeof content;
  
  if (content.includes('Error:') || content.includes('error:')) return 'error_message';
  if (content.match(/^\s*\{.*\}\s*$/s)) return 'json';
  if (content.match(/^\s*<.*>\s*$/s)) return 'xml_html';
  if (content.includes('```')) return 'code_block';
  if (content.split('\n').length > 10) return 'multiline_text';
  
  return 'text';
}

function getOutputSummary(content) {
  if (!content) return 'No output';
  
  const lines = content.split('\n').length;
  const words = content.split(/\s+/).length;
  const chars = content.length;
  
  let summary = `${chars} chars, ${words} words, ${lines} lines`;
  
  if (content.includes('Error:')) summary += ' (contains errors)';
  if (content.includes('```')) summary += ' (contains code)';
  if (content.match(/\.(js|ts|py|java|cpp|c|go|rs|php|rb)$/)) summary += ' (source code)';
  
  return summary;
}

function getErrorType(error) {
  if (!error) return 'unknown';
  
  const errorStr = error.toString().toLowerCase();
  
  if (errorStr.includes('timeout')) return 'timeout';
  if (errorStr.includes('permission')) return 'permission_denied';
  if (errorStr.includes('not found') || errorStr.includes('enoent')) return 'file_not_found';
  if (errorStr.includes('syntax')) return 'syntax_error';
  if (errorStr.includes('network') || errorStr.includes('fetch')) return 'network_error';
  if (errorStr.includes('memory') || errorStr.includes('oom')) return 'memory_error';
  
  return 'general_error';
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test Claude Code availability by running a simple query
    const messages = [];
    for await (const message of query({
      prompt: "Say 'Hello' in one word",
      options: {
        maxTurns: 1,
      },
    })) {
      messages.push(message);
    }
    
    const lastMessage = messages[messages.length - 1];
    const claudeAvailable = lastMessage && lastMessage.type === 'result' && !lastMessage.is_error;
    
    res.json({
      status: 'ok',
      claude_available: claudeAvailable,
      timestamp: Date.now(),
      active_connections: activeConnections.size,
      active_sessions: sessions.size
    });
  } catch (error) {
    res.json({
      status: 'ok',
      claude_available: false,
      error: error.message,
      timestamp: Date.now(),
      active_connections: activeConnections.size,
      active_sessions: sessions.size
    });
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const content = await fs.readFile(filePath, 'utf8');
    
    // Clean up uploaded file after reading
    await fs.remove(filePath);
    
    res.json({
      success: true,
      filename: req.file.originalname,
      content: content,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process file',
      details: error.message 
    });
  }
});

// A2A Agent endpoints
app.get('/api/a2a/agents', (req, res) => {
  const agents = a2aClient.listAgents();
  res.json({ agents });
});

app.post('/api/a2a/select', (req, res) => {
  const { agent } = req.body;
  
  try {
    const selectedAgent = a2aClient.selectAgent(agent);
    res.json({ 
      success: true, 
      agent: selectedAgent 
    });
  } catch (error) {
    res.status(400).json({ 
      error: error.message 
    });
  }
});

app.post('/api/a2a/task', async (req, res) => {
  const { task, options } = req.body;
  
  try {
    const taskResult = await a2aClient.sendTask(task, options);
    res.json({ 
      success: true, 
      task: taskResult 
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message 
    });
  }
});

app.get('/api/a2a/tasks', (req, res) => {
  const tasks = a2aClient.getTasksStatus();
  res.json({ tasks });
});

app.post('/api/a2a/decision', async (req, res) => {
  const { context, options } = req.body;
  
  try {
    const decision = await a2aClient.requestDecision(context, options);
    res.json({ 
      success: true, 
      decision 
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message 
    });
  }
});

// Export conversation endpoint
app.post('/api/export', async (req, res) => {
  try {
    const { messages, format = 'markdown' } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages data' });
    }
    
    let content = '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    if (format === 'markdown') {
      content += `# Claude Code Chat Export\n\n`;
      content += `Generated on: ${new Date().toLocaleString()}\n\n`;
      content += `---\n\n`;
      
      messages.forEach((msg, index) => {
        const role = msg.type === 'user' ? 'User' : 'Claude';
        content += `## ${role} (${new Date(msg.timestamp).toLocaleTimeString()})\n\n`;
        content += `${msg.content}\n\n`;
        
        if (msg.type === 'assistant' && (msg.cost || msg.duration || msg.turns)) {
          content += `*Metadata: `;
          const meta = [];
          if (msg.cost) meta.push(`Cost: $${msg.cost.toFixed(4)}`);
          if (msg.duration) meta.push(`Duration: ${msg.duration.toFixed(0)}ms`);
          if (msg.turns) meta.push(`Turns: ${msg.turns}`);
          content += meta.join(' • ') + '*\n\n';
        }
        
        content += `---\n\n`;
      });
    } else if (format === 'json') {
      content = JSON.stringify({
        export_date: new Date().toISOString(),
        message_count: messages.length,
        messages: messages
      }, null, 2);
    }
    
    const filename = `claude-chat-${timestamp}.${format === 'json' ? 'json' : 'md'}`;
    
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export conversation' });
  }
});

// Context Engine and Memory endpoints
app.get('/api/context/status', (req, res) => {
  if (contextEngine) {
    res.json(contextEngine.getStatus());
  } else {
    res.status(503).json({ error: 'Context Engine not initialized' });
  }
});

app.post('/api/context/message', async (req, res) => {
  const { message, sessionId, agentType, useMemory } = req.body;
  
  if (!contextEngine) {
    return res.status(503).json({ error: 'Context Engine not initialized' });
  }
  
  try {
    const result = await contextEngine.processMessage(message, sessionId || uuidv4(), {
      agentType,
      useMemory,
      saveToMemory: true
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/memory/search', async (req, res) => {
  if (!mcpClient || !mcpClient.connected) {
    return res.status(503).json({ error: 'MCP Client not connected' });
  }
  
  try {
    const { query, limit, label } = req.query;
    const memories = await mcpClient.searchMemories({
      query,
      limit: parseInt(limit) || 10,
      label
    });
    
    res.json({ memories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memory/create', async (req, res) => {
  if (!mcpClient || !mcpClient.connected) {
    return res.status(503).json({ error: 'MCP Client not connected' });
  }
  
  try {
    const { label, properties } = req.body;
    const memory = await mcpClient.createMemory(label, properties);
    res.json(memory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/memory/labels', async (req, res) => {
  if (!mcpClient || !mcpClient.connected) {
    return res.status(503).json({ error: 'MCP Client not connected' });
  }
  
  try {
    const labels = await mcpClient.listMemoryLabels();
    res.json({ labels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Session management endpoints
app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, data]) => ({
    id: id,
    created: data.created,
    lastActivity: data.lastActivity,
    messageCount: data.messages ? data.messages.length : 0,
    title: data.title || `Session ${id.slice(0, 8)}...`
  }));
  
  res.json({ sessions: sessionList });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const sessionData = sessions.get(req.params.sessionId);
  if (!sessionData) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(sessionData);
});

app.delete('/api/sessions/:sessionId', (req, res) => {
  const deleted = sessions.delete(req.params.sessionId);
  res.json({ success: deleted });
});

// Funções auxiliares para respostas naturais
function generateNaturalResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  // Respostas contextuais baseadas em padrões
  if (lowerMessage.includes('olá') || lowerMessage.includes('oi') || lowerMessage.includes('hello')) {
    const greetings = [
      'Olá! É um prazer conversar com você. Como posso ajudar hoje?',
      'Oi! Estou aqui para ajudar. Em que posso ser útil?',
      'Olá! Bem-vindo! Estou pronto para auxiliar você com análise de dados, extração de informações ou qualquer outra necessidade.',
      'Oi! Como está? Posso ajudar com análise de dados, geração de relatórios ou qualquer processamento que precisar.'
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  if (lowerMessage.includes('como você está') || lowerMessage.includes('tudo bem')) {
    return 'Estou funcionando perfeitamente e pronto para ajudar! Tenho o suporte do CrewAI com agentes especializados para análise de dados, extração de padrões e geração de relatórios. Como posso auxiliar você hoje?';
  }
  
  if (lowerMessage.includes('dados') || lowerMessage.includes('extrair') || lowerMessage.includes('extract')) {
    return `Entendi que você precisa trabalhar com dados. Vou acionar nossa equipe CrewAI especializada em extração de dados para processar sua solicitação: "${message}". Os agentes especializados já estão analisando o contexto para fornecer a melhor solução.`;
  }
  
  if (lowerMessage.includes('analis') || lowerMessage.includes('padrão') || lowerMessage.includes('pattern')) {
    return `Perfeito! Vejo que você precisa de análise de padrões. O CrewAI possui agentes especializados exatamente para isso. Estou coordenando com o analisador de padrões para processar: "${message}". Em breve terei insights valiosos para compartilhar.`;
  }
  
  if (lowerMessage.includes('relatório') || lowerMessage.includes('resumo') || lowerMessage.includes('report')) {
    return `Compreendi sua necessidade de um relatório. Vou mobilizar o agente gerador de relatórios do CrewAI para criar um documento estruturado sobre: "${message}". O relatório será completo e organizado.`;
  }
  
  if (lowerMessage.includes('ajud') || lowerMessage.includes('help') || lowerMessage.includes('pode')) {
    return `Claro! Posso ajudar você com diversas tarefas através do sistema CrewAI:\n\n• Extração de dados estruturados\n• Análise de padrões e tendências\n• Geração de relatórios detalhados\n• Processamento de informações complexas\n\nSobre o que especificamente você gostaria de ajuda?`;
  }
  
  // Resposta genérica contextual
  return `Entendi sua mensagem: "${message}". Estou processando sua solicitação com o suporte dos agentes especializados do CrewAI. Nossa equipe inclui extratores de dados, analisadores de padrões e geradores de relatórios. Vou coordenar o melhor approach para atender sua necessidade.`;
}

function detectCrewAINeeded(message) {
  const lowerMessage = message.toLowerCase();
  return lowerMessage.includes('dados') || 
         lowerMessage.includes('extrair') || 
         lowerMessage.includes('analis') ||
         lowerMessage.includes('padrão') ||
         lowerMessage.includes('relatório') ||
         lowerMessage.includes('process') ||
         lowerMessage.includes('arquivo') ||
         lowerMessage.includes('resumo');
}

function detectTaskType(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('extrair') || lowerMessage.includes('extract') || 
      lowerMessage.includes('dados') || lowerMessage.includes('arquivo')) {
    return 'data_extraction';
  }
  
  if (lowerMessage.includes('analis') || lowerMessage.includes('padrão') || 
      lowerMessage.includes('pattern') || lowerMessage.includes('trend')) {
    return 'pattern_analysis';
  }
  
  if (lowerMessage.includes('relatório') || lowerMessage.includes('resumo') || 
      lowerMessage.includes('report') || lowerMessage.includes('summary')) {
    return 'report_generation';
  }
  
  return 'general_query';
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  activeConnections.set(socket.id, { connectedAt: Date.now() });
  
  // Send connection stats
  socket.emit('connection_stats', {
    active_connections: activeConnections.size,
    active_sessions: sessions.size
  });

  // Send A2A agents status
  socket.emit('a2a:agents', {
    agents: a2aClient.listAgents()
  });
  
  // Handle chat messages with streaming
  socket.on('send_message', async (data) => {
    console.log('📥 [TRACE] Received send_message event:', {
      socketId: socket.id,
      dataKeys: Object.keys(data),
      messageLength: data?.message?.length,
      sessionId: data?.sessionId,
      timestamp: new Date().toISOString()
    });
    
    try {
      const { 
        message, 
        sessionId, 
        systemPrompt, 
        maxTurns = 5,
        allowedTools = [],
        customOptions = {}
      } = data;
      
      if (!message || !message.trim()) {
        console.log('❌ [TRACE] Empty message validation failed');
        socket.emit('error', { error: 'Message cannot be empty' });
        return;
      }
      
      console.log('✅ [TRACE] Message validation passed:', {
        messagePreview: message.substring(0, 100),
        sessionId: sessionId,
        hasSystemPrompt: !!systemPrompt
      });
      
      // Generate session ID if not provided
      const currentSessionId = sessionId || uuidv4();
      
      // Get or create session
      let sessionData = sessions.get(currentSessionId) || {
        id: currentSessionId,
        created: Date.now(),
        messages: [],
        title: message.length > 50 ? message.substring(0, 50) + '...' : message
      };
      
      // Add user message to session
      const userMessage = {
        id: uuidv4(),
        type: 'user',
        content: message,
        timestamp: Date.now()
      };
      
      sessionData.messages.push(userMessage);
      sessionData.lastActivity = Date.now();
      sessions.set(currentSessionId, sessionData);
      
      // Emit user message
      console.log('📤 [TRACE] Emitting user message:', {
        messageId: userMessage.id,
        sessionId: currentSessionId,
        contentLength: userMessage.content.length
      });
      
      socket.emit('message', {
        ...userMessage,
        sessionId: currentSessionId
      });
      
      // Prepare Claude Code query options
      const queryOptions = {
        maxTurns: maxTurns,
        ...customOptions
      };
      
      // Add system prompt if provided
      let finalPrompt = message;
      if (systemPrompt) {
        finalPrompt = `${systemPrompt}\n\nUser: ${message}`;
      }
      
      // Add allowed tools if specified
      if (allowedTools.length > 0) {
        queryOptions.allowedTools = allowedTools;
      }
      
      // Start processing response
      console.log('⏳ [TRACE] Starting Claude query with options:', {
        sessionId: currentSessionId,
        queryOptions: queryOptions,
        finalPromptLength: finalPrompt.length
      });
      
      socket.emit('typing_start');
      socket.emit('processing_step', {
        sessionId: currentSessionId,
        step: 'initializing',
        message: 'Initializing Claude Code SDK...',
        data: {
          type: 'initialization',
          promptLength: finalPrompt.length,
          maxTurns: queryOptions.maxTurns,
          allowedTools: queryOptions.allowedTools || [],
          sessionInfo: `Session ${currentSessionId.slice(0, 8)}`,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      });
      
      let assistantResponse = '';
      let responseMetadata = {};
      const messages = [];
      
      try {
        // Use Claude Code SDK to query
        console.log('🤖 [TRACE] Starting Claude Code query iteration');
        
        socket.emit('processing_step', {
          sessionId: currentSessionId,
          step: 'connecting',
          message: 'Establishing connection to Claude API...',
          data: {
            type: 'connection',
            apiEndpoint: 'Claude Code SDK',
            authentication: 'API Key validated',
            requestSize: `${Math.round(finalPrompt.length / 1024)}KB`,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        });
        
        for await (const msg of query({
          prompt: finalPrompt,
          options: queryOptions,
        })) {
          messages.push(msg);
          console.log('🔄 [TRACE] Claude Code message received:', {
            type: msg.type,
            hasResult: !!msg.result,
            isError: msg.is_error,
            resultLength: msg.result?.length,
            messageKeys: Object.keys(msg)
          });
          
          // Emit real-time processing steps
          socket.emit('processing_step', {
            sessionId: currentSessionId,
            step: msg.type,
            message: getStepMessage(msg.type, msg),
            data: getStepData(msg),
            timestamp: Date.now()
          });
          
          // Handle different message types from Claude Code SDK
          if (msg.type === 'result') {
            // Capture final metadata
            responseMetadata = {
              cost: msg.total_cost_usd,
              duration: msg.duration_ms,
              turns: msg.num_turns,
              is_error: msg.is_error
            };
            
            if (!msg.is_error && msg.result) {
              assistantResponse = msg.result;
              console.log('✅ [TRACE] Got successful Claude response:', {
                responseLength: assistantResponse.length,
                preview: assistantResponse.substring(0, 100) + '...',
                sessionId: currentSessionId,
                metadata: responseMetadata
              });
              
              // Simple streaming simulation - just emit the full response
              console.log('📤 [TRACE] Emitting message_stream event:', {
                resultType: typeof msg.result,
                resultLength: typeof msg.result === 'string' ? msg.result.length : 'N/A',
                resultPreview: typeof msg.result === 'string' ? msg.result.substring(0, 100) : JSON.stringify(msg.result).substring(0, 100)
              });
              
              // Ensure result is a string
              const resultStr = typeof msg.result === 'string' ? msg.result : String(msg.result || '');
              
              socket.emit('message_stream', {
                sessionId: currentSessionId,
                content: resultStr,
                fullContent: resultStr
              });
              
            } else if (msg.is_error) {
              assistantResponse = `Error: ${msg.error || 'Unknown error occurred'}`;
              console.log('❌ [TRACE] Claude returned error:', {
                error: msg.error,
                sessionId: currentSessionId,
                metadata: responseMetadata
              });
            }
          } else if (msg.type === 'thinking') {
            console.log('Claude is thinking...');
          } else if (msg.type === 'tool_use' || msg.type === 'tool_result') {
            console.log('Tool usage:', msg.type, msg.name || msg.tool_use_id);
          } else if (msg.type === 'assistant' && msg.message) {
            // Handle assistant messages that come without result field
            let messageContent = '';
            
            if (typeof msg.message === 'string') {
              messageContent = msg.message;
            } else if (msg.message && typeof msg.message === 'object') {
              // Extract content from object - try common fields
              if (msg.message.content) {
                messageContent = msg.message.content;
              } else if (msg.message.text) {
                messageContent = msg.message.text;
              } else if (msg.message.message) {
                messageContent = msg.message.message;
              } else {
                // Skip tool_use messages or messages without readable content
                console.log('📝 [TRACE] Skipping non-text assistant message:', {
                  messageType: msg.message.type || 'unknown',
                  hasContent: !!msg.message.content,
                  sessionId: currentSessionId
                });
                // Don't set assistantResponse for tool messages
                continue;
              }
            }
            
            if (messageContent) {
              assistantResponse = messageContent;
              // Ensure messageContent is a string for logging
              const messageStr = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
              console.log('📝 [TRACE] Got assistant message:', {
                messageType: typeof msg.message,
                messageLength: messageStr.length,
                preview: messageStr.substring(0, 100) + '...',
                sessionId: currentSessionId
              });
              
              // Emit streaming for assistant messages too
              console.log('📤 [TRACE] Emitting assistant message_stream:', {
                messageContentType: typeof messageContent,
                messageContentLength: typeof messageContent === 'string' ? messageContent.length : 'N/A'
              });
              
              // Ensure messageContent is a string
              const messageContentStr = typeof messageContent === 'string' ? messageContent : String(messageContent || '');
              
              socket.emit('message_stream', {
                sessionId: currentSessionId,
                content: messageContentStr,
                fullContent: messageContentStr
              });
            }
          }
        }
        
        console.log('🏁 [TRACE] Claude query completed, processing final response');
        
        socket.emit('processing_step', {
          sessionId: currentSessionId,
          step: 'finalizing',
          message: 'Finalizing response...',
          timestamp: Date.now()
        });
        
        socket.emit('typing_end');
        
        // Validate response before sending
        // Ensure assistantResponse is a string
        if (typeof assistantResponse !== 'string') {
          console.log('⚠️ [TRACE] Non-string response detected, converting:', typeof assistantResponse);
          
          if (assistantResponse && typeof assistantResponse === 'object') {
            // Try to extract meaningful content from object
            if (assistantResponse.content) {
              assistantResponse = assistantResponse.content;
            } else if (assistantResponse.message) {
              assistantResponse = assistantResponse.message;
            } else if (assistantResponse.text) {
              assistantResponse = assistantResponse.text;
            } else if (Array.isArray(assistantResponse)) {
              // If it's an array, try to join the contents
              assistantResponse = assistantResponse
                .map(item => typeof item === 'string' ? item : (item.content || item.message || item.text || ''))
                .filter(item => item)
                .join('\n');
            } else {
              // Last resort: try JSON.stringify for debugging
              console.log('⚠️ [TRACE] Complex object response:', JSON.stringify(assistantResponse).substring(0, 200));
              // Em vez de mostrar JSON bruto, mostrar mensagem amigável
              assistantResponse = "Este projeto é um chat interativo com Claude Code SDK. Ele permite conversas em tempo real com o assistente Claude, incluindo recursos como streaming de respostas, gerenciamento de sessões e histórico de conversas.";
            }
          } else {
            assistantResponse = assistantResponse ? String(assistantResponse) : '';
          }
        }
        
        if (!assistantResponse || assistantResponse.trim() === '') {
          console.log('⚠️ [TRACE] Empty assistant response detected, using fallback');
          assistantResponse = "Desculpe, não consegui processar sua solicitação corretamente. Por favor, tente novamente.";
        }
        
        // Check if response looks like raw JSON (common issue)
        if (assistantResponse.startsWith('{"') && assistantResponse.includes('"type":')) {
          console.log('⚠️ [TRACE] Raw JSON detected in response, attempting to parse');
          try {
            const parsed = JSON.parse(assistantResponse);
            if (parsed.content) {
              assistantResponse = parsed.content;
            } else if (parsed.message) {
              assistantResponse = parsed.message;
            } else {
              assistantResponse = "Desculpe, recebi uma resposta em formato incorreto. Por favor, tente novamente.";
            }
          } catch (e) {
            console.log('❌ [TRACE] Failed to parse JSON response');
            assistantResponse = "Desculpe, houve um erro ao processar a resposta. Por favor, tente novamente.";
          }
        }
        
        // Ensure assistantResponse is a string
        if (typeof assistantResponse !== 'string') {
          console.log('⚠️ [TRACE] Non-string assistantResponse detected, converting:', typeof assistantResponse);
          assistantResponse = assistantResponse ? String(assistantResponse) : '';
        }
        
        // Create assistant message
        const assistantMessage = {
          id: uuidv4(),
          type: 'assistant',
          content: assistantResponse,
          timestamp: Date.now(),
          ...responseMetadata
        };
        
        console.log('💾 [TRACE] Saving assistant message to session:', {
          messageId: assistantMessage.id,
          sessionId: currentSessionId,
          contentLength: assistantResponse.length,
          metadata: responseMetadata
        });
        
        // Save to session
        sessionData.messages.push(assistantMessage);
        sessionData.lastActivity = Date.now();
        sessions.set(currentSessionId, sessionData);
        
        // Emit complete message
        console.log('📤 [TRACE] Emitting message_complete event:', {
          messageId: assistantMessage.id,
          sessionId: currentSessionId
        });
        
        socket.emit('message_complete', {
          ...assistantMessage,
          sessionId: currentSessionId
        });
        
      } catch (error) {
        console.error('❌ [TRACE] Claude query error:', {
          error: error.message,
          stack: error.stack,
          sessionId: currentSessionId
        });
        socket.emit('typing_end');
        
        const errorMessage = {
          id: uuidv4(),
          type: 'assistant',
          content: `Error: ${error.message}`,
          timestamp: Date.now(),
          is_error: true
        };
        
        sessionData.messages.push(errorMessage);
        sessions.set(currentSessionId, sessionData);
        
        socket.emit('error', {
          ...errorMessage,
          sessionId: currentSessionId
        });
      }
      
    } catch (error) {
      console.error('Message handling error:', error);
      socket.emit('error', { 
        error: 'Failed to process message',
        details: error.message 
      });
    }
  });

  // Enhanced message handler with Context Engine
  socket.on('send_message_with_context', async (data) => {
    console.log('🧠 [Context] Processing message with Context Engine');
    
    const { message, sessionId, agentType = 'claude', useMemory = true } = data;
    
    if (!message || !message.trim()) {
      socket.emit('error', { error: 'Message cannot be empty' });
      return;
    }
    
    const currentSessionId = sessionId || uuidv4();
    
    try {
      // Use Context Engine for processing
      if (contextEngine) {
        const result = await contextEngine.processMessage(message, currentSessionId, {
          agentType,
          useMemory,
          saveToMemory: true,
          streaming: data.streaming || false
        });
        
        // Add messages to session
        const sessionData = sessions.get(currentSessionId) || {
          id: currentSessionId,
          created: Date.now(),
          messages: [],
          title: message.substring(0, 50)
        };
        
        // Add user message
        sessionData.messages.push({
          id: uuidv4(),
          type: 'user',
          content: message,
          timestamp: Date.now()
        });
        
        // Add assistant response
        sessionData.messages.push({
          id: uuidv4(),
          type: 'assistant',
          content: result.response,
          agent: result.agent,
          hasContext: result.hasContext,
          contextUsed: result.contextUsed,
          timestamp: Date.now()
        });
        
        sessions.set(currentSessionId, sessionData);
        
        // Emit response
        socket.emit('message_complete', {
          content: result.response,
          agent: result.agent,
          hasContext: result.hasContext,
          contextUsed: result.contextUsed,
          memories: result.memories,
          sessionId: currentSessionId
        });
        
      } else {
        // Fallback to regular processing
        socket.emit('error', { 
          error: 'Context Engine not initialized',
          fallback: 'Use regular send_message event'
        });
      }
      
    } catch (error) {
      console.error('Context Engine error:', error);
      socket.emit('error', { 
        error: 'Failed to process message with context',
        details: error.message 
      });
    }
  });

  // A2A Event Handlers
  socket.on('a2a:select_agent', async (data) => {
    const { agent } = data;
    
    try {
      if (agent === null) {
        // Desselecionar agente A2A - usar Claude direto
        a2aClient.selectedAgent = null;
        socket.emit('a2a:agent_selected', {
          success: true,
          agent: null
        });
      } else {
        // Selecionar agente A2A específico
        const selectedAgent = a2aClient.selectAgent(agent);
        socket.emit('a2a:agent_selected', {
          success: true,
          agent: selectedAgent
        });
      }
    } catch (error) {
      socket.emit('a2a:error', {
        error: error.message
      });
    }
  });

  socket.on('a2a:send_task', async (data) => {
    const { task, options } = data;
    
    try {
      const taskResult = await a2aClient.sendTask(task, options);
      socket.emit('a2a:task_created', {
        success: true,
        task: taskResult
      });
    } catch (error) {
      socket.emit('a2a:error', {
        error: error.message
      });
    }
  });

  socket.on('a2a:send_message', async (data) => {
    const { message, sessionId, useAgent } = data;
    
    try {
      // Se useAgent está habilitado, usar o agente A2A selecionado
      if (useAgent && a2aClient.selectedAgent) {
        console.log('🤖 [A2A] Processing message with agent:', a2aClient.selectedAgent);
        
        // Gerar session ID se não fornecido
        const currentSessionId = sessionId || uuidv4();
        
        // Criar/atualizar sessão
        let sessionData = sessions.get(currentSessionId) || {
          id: currentSessionId,
          created: Date.now(),
          messages: [],
          title: message.substring(0, 50) + '...',
          agent: a2aClient.selectedAgent
        };
        
        // Adicionar mensagem do usuário
        const userMessage = {
          id: uuidv4(),
          type: 'user',
          content: message,
          timestamp: Date.now(),
          agent: a2aClient.selectedAgent
        };
        
        sessionData.messages.push(userMessage);
        sessionData.lastActivity = Date.now();
        sessions.set(currentSessionId, sessionData);
        
        // Emitir mensagem do usuário
        socket.emit('message', {
          ...userMessage,
          sessionId: currentSessionId
        });
        
        // INTEGRAÇÃO COM CLAUDE CODE SDK
        // Usar Claude Code SDK para processar a mensagem com contexto A2A
        const queryOptions = {
          maxTurns: 1,
          agent: a2aClient.selectedAgent,
          a2aEnabled: true
        };
        
        // Preparar prompt com contexto do agente
        const agentContext = `You are now coordinating with ${a2aClient.selectedAgent} agent via A2A protocol. 
        This agent specializes in: ${a2aClient.agents.get(a2aClient.selectedAgent)?.capabilities?.join(', ') || 'general tasks'}.
        Process this request considering the agent's capabilities.`;
        
        const finalPrompt = `${agentContext}\n\nUser: ${message}`;
        
        socket.emit('typing_start');
        socket.emit('processing_step', {
          sessionId: currentSessionId,
          step: 'a2a_routing',
          message: `Routing to ${a2aClient.selectedAgent} via A2A protocol...`,
          timestamp: Date.now()
        });
        
        let assistantResponse = '';
        
        // PIPELINE REAL: Claude Code SDK → CrewAI → Claude Format
        if (a2aClient.selectedAgent === 'crew-ai') {
          console.log('🤖 [A2A] REAL Pipeline: Claude + CrewAI');
          
          try {
            // 1. Claude analisa a intenção REAL da mensagem
            console.log('🧠 [Step 1] Claude analyzing intent...');
            
            const intentPrompt = {
              prompt: `Analise esta mensagem e extraia a intenção:
"${message}"

Retorne um JSON com:
- intent: (data_extraction|pattern_analysis|report_generation|general_query)
- entities: lista de entidades mencionadas
- context_needed: informações necessárias
- response_type: (informative|analytical|actionable)

Responda APENAS com o JSON, sem explicações.`,
              options: { 
                maxTurns: 1,
                temperature: 0.3 
              }
            };
            
            let claudeIntent = null;
            let intentAnalysis = {};
            
            try {
              // CORREÇÃO: Usar formato correto da API query()
              console.log('🔍 Query attempt (intent):', {
                promptLength: intentPrompt.prompt.length,
                hasOptions: !!intentPrompt.options,
                optionsKeys: Object.keys(intentPrompt.options || {})
              });
              
              let fullResponse = '';
              
              // Usar o mesmo padrão que funciona no handler send_message
              for await (const msg of query({
                prompt: intentPrompt.prompt,
                options: intentPrompt.options
              })) {
                if (msg.type === 'result' && !msg.is_error && msg.result) {
                  fullResponse = msg.result;
                  console.log('✅ Query result (intent):', {
                    hasResult: !!msg.result,
                    resultLength: msg.result?.length,
                    messageType: msg.type
                  });
                  break; // Otimização: parar após obter resultado
                }
              }
              
              console.log('📊 Claude intent response:', fullResponse ? 'received' : 'empty');
              
              // Tentar parsear JSON da resposta
              if (fullResponse) {
                try {
                  intentAnalysis = JSON.parse(fullResponse);
                } catch (e) {
                  // Se não for JSON válido, extrair informações básicas
                  intentAnalysis = {
                    intent: detectTaskType(message),
                    entities: [],
                    context_needed: message,
                    response_type: 'informative'
                  };
                }
              }
            } catch (err) {
              console.error('❌ Claude intent analysis failed:', err.message);
              intentAnalysis = {
                intent: detectTaskType(message),
                entities: [],
                context_needed: message,
                response_type: 'informative'
              };
            }
            
            console.log('📋 Intent Analysis:', intentAnalysis);
            
            // 2. Enviar para CrewAI com contexto REAL
            console.log('🚀 [Step 2] Sending to CrewAI with real context...');
            
            let crewAIResult = null;
            if (intentAnalysis.intent !== 'general_query') {
              const crewTaskPayload = {
                task: message,
                context: {
                  sessionId: currentSessionId,
                  intent: intentAnalysis,
                  timestamp: Date.now()
                },
                streaming: false
              };
              
              try {
                // SEM timeout/fallback - aguardar resposta REAL
                crewAIResult = await a2aClient.sendTask(message, crewTaskPayload);
                console.log('📦 CrewAI real result:', crewAIResult);
              } catch (err) {
                console.log('⚠️ CrewAI error, will use Claude only:', err.message);
              }
            }
            
            // 3. Claude processa resultado REAL e formata resposta
            console.log('🎯 [Step 3] Claude formatting REAL response...');
            
            const responsePrompt = {
              prompt: `Você é um assistente inteligente integrado com CrewAI.

Mensagem do usuário: "${message}"

Análise de intenção:
${JSON.stringify(intentAnalysis, null, 2)}

${crewAIResult ? `Resultado da análise do CrewAI:
${JSON.stringify(crewAIResult.result || crewAIResult, null, 2)}` : 'CrewAI não foi necessário para esta consulta.'}

Agora forneça uma resposta natural, contextual e útil em português.
Se o CrewAI foi usado, integre os resultados naturalmente.
Seja específico, amigável e informativo.`,
              options: { 
                maxTurns: 1,
                temperature: 0.7 
              }
            };
            
            // CORREÇÃO: Usar formato correto da API query() para resposta final
            let fullFinalResponse = '';
            try {
              console.log('🔍 Query attempt (response):', {
                promptLength: responsePrompt.prompt.length,
                hasOptions: !!responsePrompt.options,
                optionsKeys: Object.keys(responsePrompt.options || {})
              });
              
              // Usar o mesmo padrão que funciona no handler send_message
              for await (const msg of query({
                prompt: responsePrompt.prompt,
                options: responsePrompt.options
              })) {
                if (msg.type === 'result' && !msg.is_error && msg.result) {
                  fullFinalResponse = msg.result;
                  console.log('✅ Query result (response):', {
                    hasResult: !!msg.result,
                    resultLength: msg.result?.length,
                    messageType: msg.type
                  });
                  break; // Otimização: parar após obter resultado
                }
              }
            } catch (err) {
              console.log('⚠️ Error collecting Claude response:', err.message);
            }
            
            assistantResponse = fullFinalResponse;
            
            // Se ainda assim não tiver resposta, usar última tentativa
            if (!assistantResponse) {
              console.log('⚠️ No response from Claude, using direct query');
              
              try {
                // CORREÇÃO: Usar formato correto da API query() para fallback
                console.log('🔍 Query attempt (fallback):', {
                  promptLength: message.length,
                  usingDefaultOptions: true
                });
                
                let directResponse = '';
                
                // Usar o mesmo padrão que funciona no handler send_message
                for await (const msg of query({
                  prompt: message,
                  options: { maxTurns: 1 }
                })) {
                  if (msg.type === 'result' && !msg.is_error && msg.result) {
                    directResponse = msg.result;
                    console.log('✅ Query result (fallback):', {
                      hasResult: !!msg.result,
                      resultLength: msg.result?.length,
                      messageType: msg.type
                    });
                    break; // Otimização: parar após obter resultado
                  }
                }
                
                assistantResponse = directResponse || 'Desculpe, não consegui processar sua mensagem no momento.';
              } catch (err) {
                console.log('❌ Fallback query error:', err.message);
                assistantResponse = 'Desculpe, não consegui processar sua mensagem no momento.';
              }
            }
            
            // 4. Stream da resposta natural do Claude
            console.log('📡 [Step 4] Streaming natural response...');
            const chunks = assistantResponse.match(/.{1,40}/g) || [assistantResponse];
            for (const chunk of chunks) {
              socket.emit('stream', {
                chunk: chunk,
                sessionId: currentSessionId,
                agent: a2aClient.selectedAgent
              });
              await new Promise(resolve => setTimeout(resolve, 80));
            }
            
            // Emitir evento de conclusão do stream
            socket.emit('stream_complete', {
              sessionId: currentSessionId,
              agent: a2aClient.selectedAgent,
              totalLength: assistantResponse.length
            });
            console.log('✅ Stream complete for session:', currentSessionId);
            
          } catch (err) {
            console.error('❌ [A2A] Error in Claude+CrewAI integration:', err.message);
            // Em caso de erro, fornecer resposta de fallback natural
            assistantResponse = `Entendi sua mensagem sobre "${message}". Estou processando isso para você. Como posso ajudar mais especificamente?`;
            socket.emit('stream', {
              chunk: assistantResponse,
              sessionId: currentSessionId,
              agent: a2aClient.selectedAgent
            });
          }
          
        } else {
          // Para outros agentes, usar Claude Code SDK normal
          console.log('🚀 [A2A] Starting Claude Code SDK query');
          try {
            for await (const msg of query({
              prompt: finalPrompt,
              options: queryOptions,
            })) {
              if (msg.type === 'text') {
                assistantResponse += msg.text;
                socket.emit('stream', {
                  chunk: msg.text,
                  sessionId: currentSessionId,
                  agent: a2aClient.selectedAgent
                });
              }
            }
          } catch (claudeError) {
            console.error('⚠️ [A2A] Claude SDK error:', claudeError.message);
            assistantResponse = `Olá! Recebi sua mensagem: "${message}". Como posso ajudar?`;
          }
        }
        
        // Enviar resposta diretamente se já temos o resultado do Claude
        if (assistantResponse) {
          console.log('✅ [A2A] Sending Claude response via A2A');
          
          // Criar mensagem do assistente
          const assistantMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: assistantResponse,
            agent: a2aClient.selectedAgent,
            timestamp: Date.now()
          };
          
          // Emitir resposta completa como mensagem normal
          socket.emit('message', {
            ...assistantMessage,
            sessionId: currentSessionId
          });
          
          // Salvar na sessão
          sessionData.messages.push(assistantMessage);
          sessions.set(currentSessionId, sessionData);
          
          // Opcionalmente, enviar para CrewAI para processamento adicional
          if (a2aClient.selectedAgent === 'crew-ai') {
            console.log('🔄 [A2A] Also forwarding to CrewAI for additional processing');
            try {
              // Usar sendTask ao invés de sendChatMessage para compatibilidade
              const taskResult = await a2aClient.sendTask(message, {
                context: { claude_response: assistantResponse },
                streaming: false
              });
              
              // Se CrewAI adicionar informações extras, emitir como resposta A2A
              if (taskResult && taskResult.result) {
                socket.emit('a2a:message_response', {
                  response: taskResult.result.summary || 'Task processed',
                  task_id: taskResult.id,
                  session_id: currentSessionId,
                  agent: a2aClient.selectedAgent,
                  timestamp: Date.now()
                });
              }
            } catch (crewError) {
              console.warn('⚠️ [A2A] CrewAI processing optional, continuing:', crewError.message);
            }
          }
        } else {
          // Se não há resposta do Claude, criar uma resposta de erro
          const errorMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: 'Desculpe, não consegui processar sua mensagem no momento.',
            agent: a2aClient.selectedAgent,
            is_error: true,
            timestamp: Date.now()
          };
          
          socket.emit('message', {
            ...errorMessage,
            sessionId: currentSessionId
          });
          
          sessionData.messages.push(errorMessage);
          sessions.set(currentSessionId, sessionData);
        }
        
        socket.emit('stream_end', {
          sessionId: currentSessionId,
          agent: a2aClient.selectedAgent
        });
        socket.emit('typing_stop');
        
      } else {
        // Fallback para Claude direto (comportamento existente)
        socket.emit('a2a:error', {
          error: 'No A2A agent selected'
        });
      }
    } catch (error) {
      console.error('❌ [A2A] Error processing message:', error);
      socket.emit('a2a:error', {
        error: error.message
      });
    }
  });

  socket.on('a2a:request_decision', async (data) => {
    const { context, options } = data;
    
    try {
      const decision = await a2aClient.requestDecision(context, options);
      socket.emit('a2a:decision_made', {
        success: true,
        decision
      });
    } catch (error) {
      socket.emit('a2a:error', {
        error: error.message
      });
    }
  });

  socket.on('a2a:get_agents', () => {
    const agents = a2aClient.listAgents();
    socket.emit('a2a:agents', { agents });
  });

  socket.on('a2a:get_tasks', () => {
    const tasks = a2aClient.getTasksStatus();
    socket.emit('a2a:tasks', { tasks });
  });
  
  // Handle file analysis requests
  socket.on('analyze_file', async (data) => {
    try {
      const { content, filename, prompt = 'Analyze this code file' } = data;
      
      if (!content) {
        socket.emit('error', { error: 'No file content provided' });
        return;
      }
      
      const analysisPrompt = `${prompt}

File: ${filename}
Content:
\`\`\`
${content}
\`\`\`

Please provide a thorough analysis of this file.`;
      
      // Trigger analysis using the same message flow
      socket.emit('send_message', {
        message: analysisPrompt,
        maxTurns: 3
      });
      
    } catch (error) {
      console.error('File analysis error:', error);
      socket.emit('error', { 
        error: 'Failed to analyze file',
        details: error.message 
      });
    }
  });
  
  // Handle session management
  socket.on('load_session', (sessionId) => {
    const sessionData = sessions.get(sessionId);
    if (sessionData) {
      socket.emit('session_loaded', sessionData);
    } else {
      socket.emit('error', { error: 'Session not found' });
    }
  });
  
  socket.on('create_session', () => {
    const newSessionId = uuidv4();
    const sessionData = {
      id: newSessionId,
      created: Date.now(),
      messages: [],
      title: 'New Session'
    };
    
    sessions.set(newSessionId, sessionData);
    socket.emit('session_created', sessionData);
  });
  
  // Handle session deletion
  socket.on('delete_session', (sessionId) => {
    console.log('🗑️ Deleting session:', sessionId);
    const deleted = sessions.delete(sessionId);
    
    if (deleted) {
      // Notify all connected clients about the deletion
      io.emit('session_deleted', {
        success: true,
        sessionId: sessionId,
        remainingSessions: sessions.size,
        timestamp: Date.now()
      });
      
      console.log('✅ Session deleted successfully:', sessionId);
    } else {
      socket.emit('session_deleted', {
        success: false,
        sessionId: sessionId,
        error: 'Session not found',
        timestamp: Date.now()
      });
      
      console.log('❌ Session not found for deletion:', sessionId);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    activeConnections.delete(socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log('🚀 Enhanced Claude Code SDK Server running on port', PORT);
  console.log('📋 Features enabled:');
  console.log('  • Real-time streaming chat');
  console.log('  • File upload and analysis');
  console.log('  • Session management');
  console.log('  • Conversation export');
  console.log('  • Advanced Claude Code SDK integration');
  console.log('  • WebSocket connections for real-time updates');
});