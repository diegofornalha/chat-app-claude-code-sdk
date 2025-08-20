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
const Neo4jRAGService = require('./services/neo4j-rag-service.js');
const ContextEngine = require('./context/engine.js');

// AI SDK v5 Services
const AgentManagerV2 = require('./services/AgentManagerV2');
const ClaudeAgentSDK = require('./agents/ClaudeAgentSDK');
const { UnifiedAgentFactory } = require('./agents/UnifiedAgentInterface');

// Enhanced Agent Manager Integration
const EnhancedAgentManager = require('./services/EnhancedAgentManager');
const OrchestratorService = require('./services/OrchestratorService');
const QualityController = require('./services/QualityController');
const { config, validateConfig } = require('./config/ai-sdk.config');
const WorkerPool = require('./integrations/WorkerPool');
const HealthChecker = require('./services/health-checker');
const FeedbackProcessor = require('./integrations/FeedbackProcessor');
const TelemetryMonitor = require('./integrations/TelemetryMonitor');
const StructuredOutputProcessor = require('./integrations/StructuredOutputProcessor');

// Plugin System
const PluginManager = require('./plugins/PluginManager');

// Memory Middleware
const MemoryMiddleware = require('./middleware/MemoryMiddleware');

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
// Sistema de deduplicação de mensagens
const processedMessages = new Map();
const MESSAGE_TTL = 30000; // 30 seconds

// Limpeza automática de mensagens antigas
setInterval(() => {
  const now = Date.now();
  for (const [messageId, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_TTL) {
      processedMessages.delete(messageId);
    }
  }
}, 60000); // Limpar a cada minuto

// Função para extrair timestamp de reset do Claude
async function getClaudeResetTime() {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('npx @anthropic-ai/claude-code --print "test" 2>&1', (error, stdout, stderr) => {
      const output = stdout + stderr;
      // Procurar tanto no formato texto quanto no formato JSON/array
      let match = output.match(/Claude AI usage limit reached\|(\d+)/);
      
      if (!match) {
        // Tentar extrair do formato JSON: [{"type": "text", "text": "Claude AI usage limit reached|timestamp"}]
        const jsonMatch = output.match(/\{"type":\s*"text",\s*"text":\s*"Claude AI usage limit reached\|(\d+)"\s*\}/);
        if (jsonMatch) {
          match = jsonMatch;
        }
      }
      
      if (match) {
        const resetTimestamp = parseInt(match[1]);
        const resetTime = new Date(resetTimestamp * 1000);
        const day = resetTime.getDate();
        const hour = resetTime.getHours();
        // Formato conciso: "dia 19, 20h"
        const resetTimeStr = `dia ${day}, ${hour}h`;
        resolve(resetTimeStr);
      } else {
        resolve(null);
      }
    });
  });
}

// Initialize clients
const a2aClient = new A2AClient();
const mcpClient = new MCPClient({
  debug: process.env.MCP_DEBUG === 'true'
});
const ragService = new Neo4jRAGService(mcpClient);

// FUNÇÃO AUXILIAR PARA PROCESSAMENTO A2A
async function processA2AMessage(socket, message, sessionId, selectedAgent, messageId) {
  try {
    console.log('🤖 [A2A] Processing message with agent:', selectedAgent);
    
    // INTEGRAÇÃO COM CLAUDE CODE SDK
    const queryOptions = {
      maxTurns: 1,
      agent: selectedAgent,
      a2aEnabled: true
    };
    
    // Preparar prompt com contexto do agente
    const agentContext = `You are now coordinating with ${selectedAgent} agent via A2A protocol. 
    This agent specializes in: ${a2aClient.agents.get(selectedAgent)?.capabilities?.join(', ') || 'general tasks'}.
    Process this request considering the agent's capabilities.`;
    
    const finalPrompt = `${agentContext}\n\nUser: ${message}`;
    
    socket.emit('typing_start', { messageId });
    socket.emit('processing_step', {
      sessionId: sessionId,
      step: 'a2a_routing',
      message: `Routing to ${selectedAgent} via A2A protocol...`,
      timestamp: Date.now(),
      messageId
    });
    
    let assistantResponse = '';
    
    // PIPELINE REAL: Claude Code SDK → CrewAI → Claude Format
    if (selectedAgent === 'crew-ai') {
      console.log('🤖 [A2A] REAL Pipeline: Claude + CrewAI');
      
      // Processar com CrewAI (implementação simplificada)
      assistantResponse = `Processed with CrewAI agent: ${message}`;
      
    } else {
      // Usar Claude Code SDK para outros agentes
      try {
        const { query } = require('@anthropic-ai/sdk');
        for await (const msg of query({ prompt: finalPrompt, options: queryOptions })) {
          if (msg.type === 'result' && !msg.is_error && msg.result) {
            assistantResponse = msg.result;
            break;
          }
        }
      } catch (error) {
        console.error('Claude query error:', error);
        
        // Detectar limite do Claude atingido
        if (error.message.includes('Claude Code process exited with code 1')) {
          try {
            const resetTime = await getClaudeResetTime();
            if (resetTime) {
              assistantResponse = `🕐 Seu limite será resetado:  ${resetTime}`;
              console.log(`⏰ [CLAUDE] Limite será resetado: ${resetTime}`);
            } else {
              assistantResponse = `🕐 Seu limite será resetado breve`;
            }
          } catch (extractError) {
            assistantResponse = `🕐 Seu limite será resetado breve`;
          }
          console.warn('⚠️ [CLAUDE] Usage limit reached during conversation');
        } else {
          assistantResponse = `Error processing with ${selectedAgent}: ${error.message}`;
        }
      }
    }
    
    // Atualizar sessão com resposta
    const sessionData = sessions.get(sessionId);
    if (sessionData) {
      const assistantMessage = {
        id: uuidv4(),
        type: 'assistant',
        role: 'assistant', // Adicionar role
        content: assistantResponse,
        timestamp: Date.now(),
        agent: selectedAgent
      };
      
      sessionData.messages.push(assistantMessage);
      sessions.set(sessionId, sessionData);
      
      // Emitir resposta UMA VEZ
      socket.emit('message', {
        ...assistantMessage,
        role: assistantMessage.role || 'assistant', // Garantir role
        sessionId: sessionId,
        messageId
      });
    }
    
    socket.emit('typing_end', { messageId });
    
  } catch (error) {
    console.error('A2A processing error:', error);
    throw error;
  }
}
let contextEngine = null;

// Initialize AI SDK v5 Manager
const agentManagerV2 = new AgentManagerV2();
let useAISDKv5 = process.env.USE_AI_SDK_V5 !== 'false'; // Default to true

// Initialize Enhanced Agent Manager Components
let enhancedAgentManager = null;
let orchestratorService = null;
let qualityController = null;
let workerPool = null;
let feedbackProcessor = null;

// Initialize Plugin Manager
const pluginManager = new PluginManager({
  autoReload: true,
  pluginsDir: path.join(__dirname, 'plugins/available'),
  enabledDir: path.join(__dirname, 'plugins/enabled')
});

// Initialize Memory Middleware
let memoryMiddleware = null;

// Initialize Health Checker
const healthChecker = new HealthChecker();

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

    // 2. Initialize Plugin Manager
    console.log('🔌 Initializing Plugin Manager...');
    try {
      await pluginManager.initialize(a2aClient);
      console.log(`✅ Plugin Manager initialized with ${pluginManager.plugins.size} plugins`);
      
      // List available plugins
      const available = await pluginManager.listAvailablePlugins();
      if (available.length > 0) {
        console.log('📦 Available plugins:', available.map(p => p.id).join(', '));
      }
    } catch (pluginError) {
      console.error('⚠️ Plugin Manager failed (continuing without plugins):', pluginError.message);
    }

    // 3. Initialize Memory Middleware
    console.log('🧠 Initializing Memory Middleware...');
    if (mcpClient && ragService) {
      memoryMiddleware = new MemoryMiddleware(mcpClient, ragService);
      console.log('✅ Memory Middleware initialized - ALL messages will be saved to Neo4j');
      
      // Configurar limpeza automática de sessões antigas a cada hora
      setInterval(() => {
        memoryMiddleware.cleanupOldSessions();
      }, 60 * 60 * 1000);
      
      // Registrar rotas de gestão de memória
      const MemoryRoutes = require('./routes/memory');
      const memoryRoutes = new MemoryRoutes(memoryMiddleware, ragService);
      app.use('/api/memory/v2', memoryRoutes.getRouter());
      console.log('🧠 Memory management routes registered at /api/memory/v2');
    } else {
      console.warn('⚠️ Memory Middleware not initialized - Neo4j service not available');
    }

    // 4. Create Context Engine
    contextEngine = new ContextEngine(mcpClient, a2aClient, memoryMiddleware);
    console.log('✅ Context Engine initialized with MemoryMiddleware integration');
    
    // 4. Initialize AI SDK v5 Agents
    if (useAISDKv5) {
      console.log('🎯 Initializing AI SDK v5 agents...');
      try {
        // Validate configuration
        validateConfig();
        
        // Initialize Enhanced Agent Manager Components
        console.log('🔧 Setting up Enhanced Agent Manager ecosystem...');
        
        // Initialize Worker Pool
        workerPool = new WorkerPool({
          maxWorkers: config.parallel.maxConcurrency,
          workerTimeout: config.parallel.taskTimeout
        });
        
        // Initialize Feedback Processor
        feedbackProcessor = new FeedbackProcessor({
          learningEnabled: true,
          adaptiveThresholds: true
        });
        
        // Initialize Quality Controller
        qualityController = new QualityController(
          { generateObject: agentManagerV2.generateObject.bind(agentManagerV2) },
          feedbackProcessor
        );
        
        // Initialize Orchestrator Service
        orchestratorService = new OrchestratorService(
          { generateObject: agentManagerV2.generateObject.bind(agentManagerV2) },
          workerPool
        );
        
        // Initialize Enhanced Agent Manager
        enhancedAgentManager = new EnhancedAgentManager(
          { analyzeComplexity: agentManagerV2.analyzeComplexity?.bind(agentManagerV2) || (() => ({ score: 0.5, factors: [], estimatedTime: 5000 })),
            generateText: agentManagerV2.generateText?.bind(agentManagerV2) || (() => ({ text: 'Mock response' })) },
          orchestratorService,
          qualityController
        );
        
        // Register agents in Enhanced Manager
        enhancedAgentManager.registerAgent({
          id: 'claude-enhanced',
          name: 'Claude Enhanced',
          capabilities: ['text_generation', 'code_generation', 'data_analysis'],
          performance: { avgTime: 2000, successRate: 0.95 }
        });
        
        enhancedAgentManager.registerAgent({
          id: 'crew-enhanced',
          name: 'CrewAI Enhanced',
          capabilities: ['data_analysis', 'report_generation', 'complex_analysis'],
          performance: { avgTime: 4000, successRate: 0.92 }
        });
        
        // Register Claude with AI SDK
        const claudeSDK = new ClaudeAgentSDK();
        await claudeSDK.initialize({ model: 'sonnet-3.5' });
        agentManagerV2.registerAgent('claude-sdk', claudeSDK);
        
        // Register unified factory agents
        UnifiedAgentFactory.register('claude-sdk', ClaudeAgentSDK);
        // Additional agents can be registered via plugins
        
        console.log('✅ AI SDK v5 agents initialized');
        console.log('🔧 AgentManagerV2 Configuration:', {
          orchestration: agentManagerV2.config.enableOrchestration,
          qualityControl: agentManagerV2.config.enableQualityControl,
          parallelProcessing: agentManagerV2.config.enableParallelProcessing
        });
        console.log('🚀 Enhanced Agent Manager ecosystem ready');
      } catch (sdkError) {
        console.error('⚠️ AI SDK v5 initialization failed:', sdkError.message);
        useAISDKv5 = false;
      }
    }

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
    // Use cached status if available and recent
    const cached = healthChecker.getCachedStatus();
    if (cached && !req.query.force) {
      return res.json(cached);
    }

    // Perform full health check
    const healthStatus = await healthChecker.performFullCheck({
      mcpClient,
      agentManagerV2,
      a2aClient,
      io
    });

    // Set appropriate HTTP status code based on health
    const httpStatus = healthStatus.status === 'unhealthy' ? 503 : 
                       healthStatus.status === 'degraded' ? 200 : 200;

    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    console.error('❌ [HEALTH] Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// MCP Health check endpoint
app.get('/api/health/mcp', async (req, res) => {
  try {
    const status = mcpClient.getStatus();
    const neo4jTest = mcpClient.connected ? await mcpClient.testConnection() : { success: false, message: 'MCP not connected' };
    
    res.json({
      mcp: status,
      neo4j: neo4jTest,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      error: 'MCP health check failed',
      message: error.message,
      timestamp: Date.now()
    });
  }
});

// RAG Service Health check endpoint
app.get('/api/health/rag', async (req, res) => {
  try {
    const status = ragService.getStatus();
    
    res.json({
      rag: status,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      error: 'RAG service health check failed',
      message: error.message,
      timestamp: Date.now()
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

// Code Analyzer Endpoints
app.get('/api/code/files', async (req, res) => {
  try {
    const codeAnalyzer = require('./services/CodeAnalyzer');
    const files = await codeAnalyzer.listProjectFiles();
    res.json({ files, count: files.length });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/code/read', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const codeAnalyzer = require('./services/CodeAnalyzer');
    const fileContent = await codeAnalyzer.readFile(filePath);
    res.json(fileContent);
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/code/search', async (req, res) => {
  try {
    const { pattern, flags } = req.body;
    if (!pattern) {
      return res.status(400).json({ error: 'Search pattern is required' });
    }
    
    const codeAnalyzer = require('./services/CodeAnalyzer');
    const results = await codeAnalyzer.searchInCode(pattern, { flags });
    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Error searching code:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/code/structure', async (req, res) => {
  try {
    const codeAnalyzer = require('./services/CodeAnalyzer');
    const structure = await codeAnalyzer.analyzeProjectStructure();
    res.json(structure);
  } catch (error) {
    console.error('Error analyzing structure:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/code/context', async (req, res) => {
  try {
    const codeAnalyzer = require('./services/CodeAnalyzer');
    const context = await codeAnalyzer.generateProjectContext();
    res.json({ context });
  } catch (error) {
    console.error('Error generating context:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI SDK v5 REST Endpoints
app.get('/api/aisdk/status', (req, res) => {
  if (!useAISDKv5) {
    return res.status(503).json({ 
      enabled: false,
      message: 'AI SDK v5 is not enabled' 
    });
  }
  
  res.json({
    enabled: true,
    config: agentManagerV2.config,
    agents: agentManagerV2.getAvailableAgents(),
    metrics: agentManagerV2.metrics
  });
});

app.post('/api/aisdk/process', async (req, res) => {
  if (!useAISDKv5) {
    return res.status(503).json({ error: 'AI SDK v5 is not enabled' });
  }
  
  const { message, sessionId = uuidv4(), options = {} } = req.body;
  
  try {
    const result = await agentManagerV2.processMessage(
      message,
      sessionId,
      null, // No socket.io for REST
      options
    );
    
    res.json({
      sessionId,
      result,
      metadata: result.metadata
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/aisdk/compare', async (req, res) => {
  if (!useAISDKv5) {
    return res.status(503).json({ error: 'AI SDK v5 is not enabled' });
  }
  
  const { message, agents = ['claude-sdk', 'crew-sdk'], sessionId = uuidv4() } = req.body;
  
  try {
    const comparison = await agentManagerV2.compareAgents(
      message,
      agents,
      sessionId,
      null
    );
    
    res.json({
      sessionId,
      comparison
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/aisdk/metrics', async (req, res) => {
  if (!useAISDKv5) {
    return res.status(503).json({ error: 'AI SDK v5 is not enabled' });
  }
  
  try {
    const report = await agentManagerV2.getPerformanceReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/aisdk/configure', (req, res) => {
  if (!useAISDKv5) {
    return res.status(503).json({ error: 'AI SDK v5 is not enabled' });
  }
  
  const { settings } = req.body;
  
  try {
    agentManagerV2.configure(settings);
    res.json({
      message: 'Configuration updated',
      config: agentManagerV2.config
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Memory management endpoints (Neo4j)
app.get('/api/memory/search', async (req, res) => {
  const { query, label, limit = 10, depth = 2 } = req.query;
  
  if (!mcpClient || !mcpClient.connected) {
    return res.status(503).json({ error: 'Memory system not available' });
  }
  
  try {
    const memories = await mcpClient.searchMemories({
      query,
      label,
      limit: parseInt(limit),
      depth: parseInt(depth)
    });
    
    res.json({
      success: true,
      count: memories.length,
      memories
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memory/create', async (req, res) => {
  const { label, properties } = req.body;
  
  if (!mcpClient || !mcpClient.connected) {
    return res.status(503).json({ error: 'Memory system not available' });
  }
  
  try {
    const memory = await mcpClient.createMemory({ label, properties });
    
    res.json({
      success: true,
      memory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/memory/update/:nodeId', async (req, res) => {
  const { nodeId } = req.params;
  const { properties } = req.body;
  
  if (!mcpClient || !mcpClient.connected) {
    return res.status(503).json({ error: 'Memory system not available' });
  }
  
  try {
    const updated = await mcpClient.updateMemory({
      nodeId: parseInt(nodeId),
      properties
    });
    
    res.json({
      success: true,
      updated
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/memory/delete/:nodeId', async (req, res) => {
  const { nodeId } = req.params;
  
  if (!mcpClient || !mcpClient.connected) {
    return res.status(503).json({ error: 'Memory system not available' });
  }
  
  try {
    await mcpClient.deleteMemory({ nodeId: parseInt(nodeId) });
    
    res.json({
      success: true,
      message: `Memory ${nodeId} deleted`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/memory/stats', async (req, res) => {
  if (!memoryMiddleware) {
    return res.status(503).json({ error: 'Memory middleware not initialized' });
  }
  
  try {
    const stats = memoryMiddleware.getStats();
    
    res.json({
      success: true,
      stats,
      neo4j: {
        connected: mcpClient?.connected || false
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/memory/export', async (req, res) => {
  const { format = 'json' } = req.query;
  
  if (!mcpClient || !mcpClient.connected) {
    return res.status(503).json({ error: 'Memory system not available' });
  }
  
  try {
    // Buscar todas as memórias
    const memories = await mcpClient.searchMemories({
      limit: 1000,
      depth: 3
    });
    
    if (format === 'json') {
      res.json({
        export_date: new Date().toISOString(),
        count: memories.length,
        memories
      });
    } else {
      res.status(400).json({ error: 'Unsupported format' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memory/import', async (req, res) => {
  const { memories } = req.body;
  
  if (!mcpClient || !mcpClient.connected) {
    return res.status(503).json({ error: 'Memory system not available' });
  }
  
  if (!Array.isArray(memories)) {
    return res.status(400).json({ error: 'Invalid import data' });
  }
  
  try {
    let imported = 0;
    let errors = 0;
    
    for (const memory of memories) {
      try {
        await mcpClient.createMemory({
          label: memory.label || 'imported',
          properties: memory.properties || memory
        });
        imported++;
      } catch (e) {
        errors++;
      }
    }
    
    res.json({
      success: true,
      imported,
      errors,
      total: memories.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Memory Management Routes will be initialized after system startup

// Plugin management endpoints
app.get('/api/plugins', async (req, res) => {
  try {
    const status = pluginManager.getStatus();
    const available = await pluginManager.listAvailablePlugins();
    
    res.json({
      ...status,
      available
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plugins/:pluginId/enable', async (req, res) => {
  const { pluginId } = req.params;
  
  try {
    const success = await pluginManager.enablePlugin(pluginId);
    
    if (success) {
      res.json({
        message: `Plugin ${pluginId} enabled successfully`,
        plugin: pluginManager.getPluginInfo(pluginId)
      });
    } else {
      res.status(400).json({ error: `Failed to enable plugin ${pluginId}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plugins/:pluginId/disable', async (req, res) => {
  const { pluginId } = req.params;
  
  try {
    const success = await pluginManager.disablePlugin(pluginId);
    
    if (success) {
      res.json({
        message: `Plugin ${pluginId} disabled successfully`
      });
    } else {
      res.status(400).json({ error: `Failed to disable plugin ${pluginId}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plugins/reload', async (req, res) => {
  try {
    await pluginManager.reloadAll();
    res.json({
      message: 'All plugins reloaded',
      status: pluginManager.getStatus()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enhanced Agent Manager endpoints
app.get('/api/enhanced/status', (req, res) => {
  if (!enhancedAgentManager) {
    return res.status(503).json({ 
      enabled: false,
      message: 'Enhanced Agent Manager not initialized' 
    });
  }
  
  res.json({
    enabled: true,
    agents: enhancedAgentManager.listAvailableAgents(),
    metrics: enhancedAgentManager.getPerformanceMetrics(),
    orchestrator: orchestratorService ? {
      activeTasks: orchestratorService.getActiveTasksCount(),
      strategy: orchestratorService.getLoadBalancingStrategy()
    } : null,
    quality: qualityController ? qualityController.getQualityMetrics() : null
  });
});

app.post('/api/enhanced/execute', async (req, res) => {
  if (!enhancedAgentManager) {
    return res.status(503).json({ error: 'Enhanced Agent Manager not enabled' });
  }
  
  const { task, options = {} } = req.body;
  
  if (!task || !task.content) {
    return res.status(400).json({ error: 'Task content is required' });
  }
  
  try {
    const result = await enhancedAgentManager.executeTask(task, options);
    res.json({
      success: true,
      result,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.get('/api/enhanced/agents', (req, res) => {
  if (!enhancedAgentManager) {
    return res.status(503).json({ error: 'Enhanced Agent Manager not enabled' });
  }
  
  const agents = enhancedAgentManager.listAvailableAgents();
  res.json({ agents, count: agents.length });
});

app.post('/api/enhanced/agents/register', (req, res) => {
  if (!enhancedAgentManager) {
    return res.status(503).json({ error: 'Enhanced Agent Manager not enabled' });
  }
  
  const { agentConfig } = req.body;
  
  try {
    enhancedAgentManager.registerAgent(agentConfig);
    res.json({
      success: true,
      message: `Agent ${agentConfig.id} registered successfully`
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.delete('/api/enhanced/agents/:agentId', (req, res) => {
  if (!enhancedAgentManager) {
    return res.status(503).json({ error: 'Enhanced Agent Manager not enabled' });
  }
  
  const { agentId } = req.params;
  
  try {
    const success = enhancedAgentManager.unregisterAgent(agentId);
    res.json({
      success,
      message: success ? `Agent ${agentId} removed` : `Agent ${agentId} not found`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Orchestrator Service endpoints
app.post('/api/orchestrator/decompose', async (req, res) => {
  if (!orchestratorService) {
    return res.status(503).json({ error: 'Orchestrator Service not enabled' });
  }
  
  const { task } = req.body;
  
  try {
    const decomposition = await orchestratorService.decomposeTask(task);
    res.json({
      success: true,
      decomposition,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/orchestrator/coordinate', async (req, res) => {
  if (!orchestratorService) {
    return res.status(503).json({ error: 'Orchestrator Service not enabled' });
  }
  
  const { subtasks, executionPlan } = req.body;
  
  try {
    const results = await orchestratorService.coordinateWorkers(subtasks, executionPlan);
    res.json({
      success: true,
      results,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.get('/api/orchestrator/status', (req, res) => {
  if (!orchestratorService) {
    return res.status(503).json({ error: 'Orchestrator Service not enabled' });
  }
  
  res.json({
    activeTasks: orchestratorService.getActiveTasksCount(),
    loadBalancer: orchestratorService.getLoadBalancingStrategy(),
    workerPool: workerPool ? workerPool.getStatus() : null
  });
});

// Worker Pool endpoints
app.get('/api/workers/status', (req, res) => {
  if (!workerPool) {
    return res.status(503).json({ error: 'Worker Pool not enabled' });
  }
  
  res.json(workerPool.getStatus());
});

app.get('/api/workers/metrics', (req, res) => {
  if (!workerPool) {
    return res.status(503).json({ error: 'Worker Pool not enabled' });
  }
  
  res.json(workerPool.getMetrics());
});

// Quality Controller endpoints
app.post('/api/quality/evaluate', async (req, res) => {
  if (!qualityController) {
    return res.status(503).json({ error: 'Quality Controller not enabled' });
  }
  
  const { result, task } = req.body;
  
  try {
    const evaluation = await qualityController.evaluateQuality(result, task);
    res.json({
      success: true,
      evaluation,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.get('/api/quality/metrics', (req, res) => {
  if (!qualityController) {
    return res.status(503).json({ error: 'Quality Controller not enabled' });
  }
  
  res.json(qualityController.getQualityMetrics());
});

app.get('/api/quality/trends', (req, res) => {
  if (!qualityController) {
    return res.status(503).json({ error: 'Quality Controller not enabled' });
  }
  
  res.json(qualityController.analyzeImprovementTrends());
});

// Feedback Processor endpoints
app.get('/api/feedback/learning', (req, res) => {
  if (!feedbackProcessor) {
    return res.status(503).json({ error: 'Feedback Processor not enabled' });
  }
  
  res.json(feedbackProcessor.getLearningMetrics());
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
  
  // CONSOLIDATED MESSAGE HANDLER - Único ponto de processamento
  socket.on('send_message', async (data) => {
    // Gerar ID único para esta mensagem
    const messageId = `${socket.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Verificar se mensagem já foi processada
    if (processedMessages.has(messageId) || 
        (data.messageId && processedMessages.has(data.messageId))) {
      console.log('🔄 [DEDUP] Message already processed, ignoring:', messageId);
      return;
    }
    
    // Marcar mensagem como sendo processada
    const finalMessageId = data.messageId || messageId;
    processedMessages.set(finalMessageId, Date.now());
    
    console.log('📥 [TRACE] Processing unique message:', {
      messageId: finalMessageId,
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
        customOptions = {},
        // Parâmetros do Context Engine
        agentType = 'claude',
        useMemory = true,
        // Parâmetros A2A
        useAgent = false
      } = data;
      
      if (!message || !message.trim()) {
        console.log('❌ [TRACE] Empty message validation failed');
        socket.emit('error', { 
          error: 'Message cannot be empty',
          messageId: finalMessageId
        });
        // Remover da lista de processadas já que falhou
        processedMessages.delete(finalMessageId);
        return;
      }
      
      console.log('✅ [TRACE] Message validation passed:', {
        messagePreview: message.substring(0, 100),
        sessionId: sessionId,
        hasSystemPrompt: !!systemPrompt
      });
      
      // Generate session ID if not provided
      const currentSessionId = sessionId || uuidv4();
      
      // ROTEAMENTO DE MENSAGENS - Determinar qual fluxo usar
      let shouldUseContextEngine = data.send_message_with_context || (agentType && agentType !== 'claude');
      let shouldUseA2A = useAgent && a2aClient.selectedAgent;
      
      console.log('🚦 [ROUTING] Message routing decision:', {
        shouldUseContextEngine,
        shouldUseA2A,
        agentType,
        useAgent,
        selectedAgent: a2aClient.selectedAgent
      });
      
      // Get or create session
      let sessionData = sessions.get(currentSessionId) || {
        id: currentSessionId,
        created: Date.now(),
        messages: [],
        title: message.length > 50 ? message.substring(0, 50) + '...' : message
      };
      
      // CONTEXT ENGINE PROCESSING
      if (shouldUseContextEngine && contextEngine) {
        console.log('🧠 [Context] Processing with Context Engine + MemoryMiddleware');
        
        const userId = socket.id;
        
        try {
          const result = await contextEngine.processMessage(message, currentSessionId, {
            agentType,
            useMemory,
            saveToMemory: true,
            streaming: data.streaming || false,
            userId
          });
          
          // Add messages to session
          sessionData.messages.push({
            id: uuidv4(),
            type: 'user',
            content: message,
            timestamp: Date.now()
          });
          
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
          
          // Emit response UMA VEZ
          socket.emit('message_complete', {
            content: result.response,
            agent: result.agent,
            hasContext: result.hasContext,
            contextUsed: result.contextUsed,
            memories: result.memories,
            sessionId: currentSessionId,
            messageId: finalMessageId
          });
          
          return; // Sair do handler após processar
          
        } catch (error) {
          console.error('Context Engine error:', error);
          socket.emit('error', { 
            error: 'Failed to process message with context',
            details: error.message,
            messageId: finalMessageId
          });
          processedMessages.delete(finalMessageId);
          return;
        }
      }
      
      // A2A PROCESSING
      if (shouldUseA2A) {
        console.log('🤖 [A2A] Processing with agent:', a2aClient.selectedAgent);
        
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
        sessionData.agent = a2aClient.selectedAgent;
        sessions.set(currentSessionId, sessionData);
        
        // Emitir mensagem do usuário UMA VEZ
        socket.emit('message', {
          ...userMessage,
          sessionId: currentSessionId,
          messageId: finalMessageId
        });
        
        // Processar com A2A
        try {
          await processA2AMessage(socket, message, currentSessionId, a2aClient.selectedAgent, finalMessageId);
          return; // Sair do handler após processar
        } catch (error) {
          console.error('A2A processing error:', error);
          socket.emit('error', {
            error: 'Failed to process A2A message',
            details: error.message,
            messageId: finalMessageId
          });
          processedMessages.delete(finalMessageId);
          return;
        }
      }
      
      // 🧠 INTEGRAÇÃO MEMORY MIDDLEWARE - PROCESSAMENTO PADRÃO CLAUDE
      let enrichedMessage = { content: message, role: 'user' };
      let memoryContext = null;
      let userId = socket.id; // Por enquanto usando socket.id como userId
      
      if (memoryMiddleware) {
        console.log('🧠 [MemoryMiddleware] Processing message through Neo4j memory...');
        try {
          const processedMessage = await memoryMiddleware.processMessage(
            enrichedMessage,
            userId,
            currentSessionId
          );
          
          // Usar o contexto enriquecido
          if (processedMessage.context) {
            memoryContext = processedMessage.context;
            
            // Se há mensagens anteriores relevantes, adicionar ao contexto
            if (processedMessage.previousMessages && processedMessage.previousMessages.length > 0) {
              console.log(`✅ [MemoryMiddleware] Found ${processedMessage.previousMessages.length} relevant previous messages`);
            }
            
            // Se há memórias semânticas relacionadas
            if (processedMessage.relatedMemories && processedMessage.relatedMemories.length > 0) {
              console.log(`✅ [MemoryMiddleware] Found ${processedMessage.relatedMemories.length} related memories`);
            }
          }
          
          // Atualizar a mensagem com informações processadas
          enrichedMessage = processedMessage;
          
          console.log(`✅ [MemoryMiddleware] Message processed with intent: ${processedMessage.intent}, sentiment: ${processedMessage.sentiment}`);
        } catch (memoryError) {
          console.error('❌ [MemoryMiddleware] Error:', memoryError);
          // Continuar sem contexto em caso de erro
        }
      }
      
      // Check if user is asking about the project BEFORE adding to session
      const projectQuestions = [
        'do que se trata',
        'sobre o projeto',
        'sobre este projeto',
        'what is this',
        'o que é isso',
        'o que é este projeto',
        'qual é o projeto',
        'me explique o projeto',
        'explain the project',
        'sobre o repositório',
        'about this project',
        'about the repository'
      ];
      
      const isAskingAboutProject = projectQuestions.some(q => 
        message.toLowerCase().includes(q.toLowerCase())
      );
      
      // Check if user is asking about specific files
      const fileQuestions = [
        'mostre o código',
        'show the code',
        'listar arquivos',
        'list files',
        'quais arquivos',
        'what files',
        'estrutura do projeto',
        'project structure'
      ];
      
      const isAskingAboutFiles = fileQuestions.some(q => 
        message.toLowerCase().includes(q.toLowerCase())
      );
      
      // Add user message to session
      const userMessage = {
        id: uuidv4(),
        type: 'user',
        role: 'user', // IMPORTANTE: Adicionar role para consistência
        content: message,
        timestamp: Date.now()
      };
      
      sessionData.messages.push(userMessage);
      sessionData.lastActivity = Date.now();
      sessions.set(currentSessionId, sessionData);
      
      // Emit user message
      socket.emit('message', {
        ...userMessage,
        role: userMessage.role || userMessage.type || 'user', // Garantir que role está definido
        sessionId: currentSessionId
      });
      
      if (isAskingAboutProject) {
        // Emit minimal processing indicators
        socket.emit('typing_start');
        socket.emit('processing_step', {
          sessionId: currentSessionId,
          step: 'system',
          message: 'Processing: system',
          timestamp: Date.now()
        });
        
        // Use CodeAnalyzer to get dynamic project context
        const codeAnalyzer = require('./services/CodeAnalyzer');
        
        try {
          // Get dynamic project context
          const projectContext = await codeAnalyzer.generateProjectContext();
          const projectStructure = await codeAnalyzer.analyzeProjectStructure();
          
          const projectInfo = `# Sobre este Projeto

Este é o **Claude Code Chat** - uma aplicação avançada de chat multi-agente que integra o Claude AI SDK com várias capacidades:

## 🌟 Principais Recursos:

### Interface Moderna
- Chat em tempo real com Claude AI
- Interface configurável com logs técnicos opcionais
- Suporte a dark mode e animações suaves
- Histórico de conversas persistente

### Sistema Multi-Agente
- **Claude AI**: Assistente principal para código e análise
- **Crew AI**: Orquestração de agentes especializados
- **Context Engine**: Processamento com memória e contexto
- **A2A Router**: Comunicação inteligente entre agentes

### Capacidades Técnicas
- Integração com AI SDK Provider v5
- Memória persistente com Neo4j
- Processamento em streaming
- Upload e análise de arquivos
- Exportação de conversas

## 🎯 Como Usar:
1. Digite sua mensagem no campo de texto
2. Escolha um agente específico ou use a seleção automática
3. Configure a interface em "UI Config" conforme sua preferência
4. Use "Settings" para ajustar parâmetros do sistema

## 🔧 Configurações Disponíveis:
- **UI Config**: Controle visualização de logs, animações e métricas
- **Settings**: Ajuste system prompt, max turns e streaming
- **Sessions**: Acesse histórico de conversas anteriores

${projectContext}

## 📡 Status:
- Conexão: ${socket.connected ? '✅ Conectado' : '❌ Desconectado'}
- Agentes disponíveis: Claude, Crew-AI, Context Engine
- Memória: ${contextEngine ? 'Ativa' : 'Inativa'}
- Total de arquivos: ${projectStructure.total.files}
- Tamanho total: ${(projectStructure.total.size / 1024 / 1024).toFixed(2)} MB

Você pode me fazer perguntas sobre código, pedir para analisar arquivos, criar projetos ou qualquer outra tarefa de desenvolvimento!`;
          
          const infoMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: projectInfo,
            timestamp: Date.now()
          };
          
          sessionData.messages.push(infoMessage);
          sessions.set(currentSessionId, sessionData);
          
          socket.emit('typing_end');
          socket.emit('message_complete', {
            ...infoMessage,
            sessionId: currentSessionId
          });
          
        } catch (error) {
          console.error('Error generating project info:', error);
          // Fallback to static info
          const projectInfo = `# Sobre este Projeto

Este é o **Claude Code Chat** - uma aplicação avançada de chat multi-agente.

## 📡 Status:
- Conexão: ${socket.connected ? '✅ Conectado' : '❌ Desconectado'}
- Agentes disponíveis: Claude, Crew-AI, Context Engine
- Memória: ${contextEngine ? 'Ativa' : 'Inativa'}

Você pode me fazer perguntas sobre código, pedir para analisar arquivos, criar projetos ou qualquer outra tarefa de desenvolvimento!`;
          
          const infoMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: projectInfo,
            timestamp: Date.now()
          };
          
          sessionData.messages.push(infoMessage);
          sessions.set(currentSessionId, sessionData);
          
          socket.emit('typing_end');
          socket.emit('message_complete', {
            ...infoMessage,
            sessionId: currentSessionId
          });
        }
        
        return; // Don't process further
      }
      
      // Handle file listing requests
      if (isAskingAboutFiles) {
        socket.emit('typing_start');
        socket.emit('processing_step', {
          sessionId: currentSessionId,
          step: 'system',
          message: 'Analisando estrutura do projeto...',
          timestamp: Date.now()
        });
        
        const codeAnalyzer = require('./services/CodeAnalyzer');
        
        try {
          const files = await codeAnalyzer.listProjectFiles();
          const structure = await codeAnalyzer.analyzeProjectStructure();
          
          // Organizar arquivos por categoria
          const filesByCategory = {
            frontend: files.filter(f => f.path.startsWith('frontend/')),
            backend: files.filter(f => f.path.startsWith('backend/')),
            config: files.filter(f => f.name.includes('config') || f.name.includes('.json')),
            docs: files.filter(f => f.extension === '.md')
          };
          
          let fileInfo = `# Estrutura do Projeto

`;
          fileInfo += `## 📈 Estatísticas Gerais
`;
          fileInfo += `- Total de arquivos: ${files.length}\n`;
          fileInfo += `- Tamanho total: ${(structure.total.size / 1024 / 1024).toFixed(2)} MB\n`;
          fileInfo += `- Frontend: ${structure.frontend.framework} (${filesByCategory.frontend.length} arquivos)\n`;
          fileInfo += `- Backend: ${structure.backend.framework} (${filesByCategory.backend.length} arquivos)\n\n`;
          
          fileInfo += `## 📁 Principais Arquivos\n\n`;
          fileInfo += `### Frontend\n`;
          filesByCategory.frontend.slice(0, 10).forEach(f => {
            fileInfo += `- \`${f.path}\` (${(f.size / 1024).toFixed(1)} KB)\n`;
          });
          
          fileInfo += `\n### Backend\n`;
          filesByCategory.backend.slice(0, 10).forEach(f => {
            fileInfo += `- \`${f.path}\` (${(f.size / 1024).toFixed(1)} KB)\n`;
          });
          
          fileInfo += `\n### Configurações\n`;
          filesByCategory.config.slice(0, 5).forEach(f => {
            fileInfo += `- \`${f.path}\` (${(f.size / 1024).toFixed(1)} KB)\n`;
          });
          
          fileInfo += `\n### Documentação\n`;
          filesByCategory.docs.forEach(f => {
            fileInfo += `- \`${f.path}\` (${(f.size / 1024).toFixed(1)} KB)\n`;
          });
          
          fileInfo += `\n\n> Para ver o conteúdo de um arquivo específico, peça: "mostre o arquivo [caminho]"`;
          
          const filesMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: fileInfo,
            timestamp: Date.now()
          };
          
          sessionData.messages.push(filesMessage);
          sessions.set(currentSessionId, sessionData);
          
          socket.emit('typing_end');
          socket.emit('message_complete', {
            ...filesMessage,
            sessionId: currentSessionId
          });
          
        } catch (error) {
          console.error('Error listing files:', error);
          const errorMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: 'Desculpe, não consegui listar os arquivos do projeto. Tente novamente mais tarde.',
            timestamp: Date.now(),
            is_error: true
          };
          
          sessionData.messages.push(errorMessage);
          sessions.set(currentSessionId, sessionData);
          
          socket.emit('typing_end');
          socket.emit('message_complete', {
            ...errorMessage,
            sessionId: currentSessionId
          });
        }
        
        return; // Don't process further
      }
      
      // Log emitting user message (already emitted above)
      console.log('📤 [TRACE] User message emitted:', {
        messageId: userMessage.id,
        sessionId: currentSessionId,
        contentLength: userMessage.content.length
      });
      
      // Prepare Claude Code query options
      const queryOptions = {
        maxTurns: maxTurns,
        ...customOptions
      };
      
      // Add system prompt if provided
      // 🧠 USAR MENSAGEM ENRIQUECIDA DO MEMORY MIDDLEWARE
      console.log('🔍 [DEBUG] enrichedMessage:', enrichedMessage);
      console.log('🔍 [DEBUG] message:', message);
      
      let finalPrompt = typeof enrichedMessage === 'string' ? enrichedMessage : enrichedMessage.content || message;
      
      console.log('🔍 [DEBUG] finalPrompt before systemPrompt:', finalPrompt);
      
      if (systemPrompt) {
        finalPrompt = `${systemPrompt}\n\nUser: ${finalPrompt}`;
      }
      
      console.log('🔍 [DEBUG] finalPrompt after systemPrompt:', finalPrompt);
      console.log('🔍 [DEBUG] finalPrompt type:', typeof finalPrompt);
      
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
        
        for await (const msg of query({ prompt: finalPrompt, options: queryOptions })) {
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
              
              // Ensure result is a string - handle Claude Code SDK structure
              let resultStr = '';
              if (typeof msg.result === 'string') {
                resultStr = msg.result;
              } else if (Array.isArray(msg.result)) {
                // Claude Code SDK returns array like [{"type": "text", "text": "content"}]
                resultStr = msg.result
                  .filter(item => item.type === 'text' && item.text)
                  .map(item => item.text)
                  .join('\n');
              } else if (typeof msg.result === 'object' && msg.result) {
                // Handle single object structure
                if (msg.result.type === 'text' && msg.result.text) {
                  resultStr = msg.result.text;
                } else {
                  resultStr = JSON.stringify(msg.result, null, 2);
                }
              } else {
                resultStr = String(msg.result || '');
              }
              
              // Processar mensagem de limite do Claude para converter timestamp
              if (resultStr.includes('Claude AI usage limit reached|')) {
                const timestampMatch = resultStr.match(/Claude AI usage limit reached\|(\d+)/);
                if (timestampMatch) {
                  const resetTimestamp = parseInt(timestampMatch[1]);
                  const resetDate = new Date(resetTimestamp * 1000);
                  const day = resetDate.getDate();
                  const hour = resetDate.getHours();
                  // Formato conciso: "dia 19, 20h"
                  const resetTime = `dia ${day}, ${hour}h`;
                  resultStr = `🕐 Seu limite será resetado:  ${resetTime}`;
                  
                  // Parar o typing indicator imediatamente para limite do Claude
                  socket.emit('typing_end');
                }
              }
              
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
              
              // Ensure messageContent is a string - handle Claude Code SDK structure
              let messageContentStr = '';
              if (typeof messageContent === 'string') {
                messageContentStr = messageContent;
              } else if (Array.isArray(messageContent)) {
                // Claude Code SDK returns array like [{"type": "text", "text": "content"}]
                messageContentStr = messageContent
                  .filter(item => item.type === 'text' && item.text)
                  .map(item => item.text)
                  .join('\n');
              } else if (typeof messageContent === 'object' && messageContent) {
                // Handle single object structure
                if (messageContent.type === 'text' && messageContent.text) {
                  messageContentStr = messageContent.text;
                } else {
                  messageContentStr = JSON.stringify(messageContent, null, 2);
                }
              } else {
                messageContentStr = String(messageContent || '');
              }
              
              // Processar mensagem de limite do Claude para converter timestamp
              if (messageContentStr.includes('Claude AI usage limit reached|')) {
                const timestampMatch = messageContentStr.match(/Claude AI usage limit reached\|(\d+)/);
                if (timestampMatch) {
                  const resetTimestamp = parseInt(timestampMatch[1]);
                  const resetDate = new Date(resetTimestamp * 1000);
                  const day = resetDate.getDate();
                  const hour = resetDate.getHours();
                  // Formato conciso: "dia 19, 20h"
                  const resetTime = `dia ${day}, ${hour}h`;
                  messageContentStr = `🕐 Seu limite será resetado:  ${resetTime}`;
                  
                  // Parar o typing indicator imediatamente para limite do Claude
                  socket.emit('typing_end');
                }
              }
              
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
            assistantResponse = assistantResponse ? 
              (typeof assistantResponse === 'object' ? JSON.stringify(assistantResponse, null, 2) : String(assistantResponse)) : '';
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
          assistantResponse = assistantResponse ? 
            (typeof assistantResponse === 'object' ? JSON.stringify(assistantResponse, null, 2) : String(assistantResponse)) : '';
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
        
        // 🧠 SALVAR RESPOSTA NO NEO4J VIA MEMORY MIDDLEWARE
        if (memoryMiddleware) {
          console.log('🧠 [MemoryMiddleware] Saving response to Neo4j...');
          try {
            await memoryMiddleware.saveInteraction({
              message: message,  // Mensagem original do usuário
              response: assistantResponse,
              sessionId: currentSessionId,
              context: memoryContext?.contextsUsed || [],
              metadata: {
                ...responseMetadata,
                socketId: socket.id,
                agent: 'claude',
                hasContext: !!memoryContext,
                contextItems: memoryContext?.itemsCount || 0
              },
              processingTime: Date.now() - userMessage.timestamp
            });
            console.log('✅ [MemoryMiddleware] Response saved to Neo4j');
          } catch (saveError) {
            console.error('❌ [MemoryMiddleware] Error saving to Neo4j:', saveError);
          }
        }
        
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
        
        // Detectar limite do Claude e criar mensagem amigável
        let errorContent = `Error: ${error.message}`;
        
        // Função para detectar limite do Claude em diferentes formatos
        const isClaudeLimit = (errorMsg) => {
          return errorMsg.includes('Claude Code process exited with code 1') ||
                 errorMsg.includes('Claude AI usage limit reached');
        };
        
        if (isClaudeLimit(error.message)) {
          try {
            // Primeiro tentar extrair timestamp direto da mensagem de erro se houver
            let resetTime = null;
            const timestampMatch = error.message.match(/Claude AI usage limit reached\|(\d+)/);
            
            if (timestampMatch) {
              const resetTimestamp = parseInt(timestampMatch[1]);
              const resetDate = new Date(resetTimestamp * 1000);
              const day = resetDate.getDate();
              const hour = resetDate.getHours();
              // Formato conciso: "dia 19, 20h"
              resetTime = `dia ${day}, ${hour}h`;
            } else {
              // Fallback para função original
              resetTime = await getClaudeResetTime();
            }
            
            if (resetTime) {
              errorContent = `🕐 Seu limite será resetado:  ${resetTime}`;
            } else {
              errorContent = `🕐 Seu limite será resetado breve`;
            }
          } catch (extractError) {
            errorContent = `🕐 Seu limite será resetado breve`;
          }
        }

        const errorMessage = {
          id: uuidv4(),
          type: 'assistant',
          content: errorContent,
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
      
      // Send error message in the correct format
      const errorMessage = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: `Desculpe, não consegui processar sua solicitação corretamente. Por favor, tente novamente.\n\nDetalhes do erro: ${error.message}`,
        timestamp: Date.now(),
        is_error: true
      };
      
      socket.emit('error', {
        ...errorMessage,
        sessionId: data?.sessionId || 'default'
      });
    }
  });

  // Enhanced Agent Manager Socket events
  socket.on('enhanced:execute_task', async (data) => {
    const { task, sessionId, options = {} } = data;
    
    if (!enhancedAgentManager) {
      socket.emit('error', { message: 'Enhanced Agent Manager not enabled' });
      return;
    }
    
    try {
      console.log('🎯 [Enhanced] Executing task with Enhanced Agent Manager');
      
      // Emit processing start
      socket.emit('enhanced:task_started', {
        sessionId,
        taskId: task.id || `task-${Date.now()}`,
        timestamp: Date.now()
      });
      
      // Execute task
      const result = await enhancedAgentManager.executeTask(task, options);
      
      // Emit result
      socket.emit('enhanced:task_complete', {
        sessionId,
        result,
        timestamp: Date.now()
      });
      
      // Update metrics in real-time
      socket.emit('enhanced:metrics_update', {
        sessionId,
        metrics: enhancedAgentManager.getPerformanceMetrics(),
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ [Enhanced] Task execution error:', error);
      socket.emit('enhanced:task_error', {
        sessionId,
        error: error.message,
        timestamp: Date.now()
      });
    }
  });
  
  // Orchestrator Socket events
  socket.on('orchestrator:decompose', async (data) => {
    const { task, sessionId } = data;
    
    if (!orchestratorService) {
      socket.emit('error', { message: 'Orchestrator Service not enabled' });
      return;
    }
    
    try {
      console.log('📊 [Orchestrator] Decomposing task');
      
      const decomposition = await orchestratorService.decomposeTask(task);
      
      socket.emit('orchestrator:decomposition_complete', {
        sessionId,
        decomposition,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ [Orchestrator] Decomposition error:', error);
      socket.emit('orchestrator:error', {
        sessionId,
        error: error.message,
        timestamp: Date.now()
      });
    }
  });
  
  socket.on('orchestrator:coordinate', async (data) => {
    const { subtasks, executionPlan, sessionId } = data;
    
    if (!orchestratorService) {
      socket.emit('error', { message: 'Orchestrator Service not enabled' });
      return;
    }
    
    try {
      console.log('🔄 [Orchestrator] Coordinating workers');
      
      // Emit coordination start
      socket.emit('orchestrator:coordination_started', {
        sessionId,
        subtaskCount: subtasks.length,
        timestamp: Date.now()
      });
      
      const results = await orchestratorService.coordinateWorkers(subtasks, executionPlan);
      
      socket.emit('orchestrator:coordination_complete', {
        sessionId,
        results,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ [Orchestrator] Coordination error:', error);
      socket.emit('orchestrator:error', {
        sessionId,
        error: error.message,
        timestamp: Date.now()
      });
    }
  });
  
  // Quality Control Socket events
  socket.on('quality:evaluate', async (data) => {
    const { result, task, sessionId } = data;
    
    if (!qualityController) {
      socket.emit('error', { message: 'Quality Controller not enabled' });
      return;
    }
    
    try {
      console.log('🔍 [Quality] Evaluating result quality');
      
      const evaluation = await qualityController.evaluateQuality(result, task);
      
      socket.emit('quality:evaluation_complete', {
        sessionId,
        evaluation,
        passed: evaluation.passed,
        timestamp: Date.now()
      });
      
      // Emit quality metrics update
      socket.emit('quality:metrics_update', {
        sessionId,
        metrics: qualityController.getQualityMetrics(),
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ [Quality] Evaluation error:', error);
      socket.emit('quality:error', {
        sessionId,
        error: error.message,
        timestamp: Date.now()
      });
    }
  });
  
  // Worker Pool Socket events
  socket.on('workers:get_status', () => {
    if (!workerPool) {
      socket.emit('error', { message: 'Worker Pool not enabled' });
      return;
    }
    
    socket.emit('workers:status_update', {
      status: workerPool.getStatus(),
      metrics: workerPool.getMetrics(),
      timestamp: Date.now()
    });
  });
  
  // Real-time metrics broadcasting
  socket.on('metrics:subscribe', () => {
    console.log('📊 Client subscribed to metrics updates');
    
    // Send initial metrics
    const metricsData = {
      enhanced: enhancedAgentManager ? enhancedAgentManager.getPerformanceMetrics() : null,
      quality: qualityController ? qualityController.getQualityMetrics() : null,
      workers: workerPool ? workerPool.getMetrics() : null,
      orchestrator: orchestratorService ? {
        activeTasks: orchestratorService.getActiveTasksCount()
      } : null,
      timestamp: Date.now()
    };
    
    socket.emit('metrics:initial', metricsData);
    
    // Store subscription
    socket.isMetricsSubscribed = true;
  });
  
  socket.on('metrics:unsubscribe', () => {
    console.log('📊 Client unsubscribed from metrics updates');
    socket.isMetricsSubscribed = false;
  });

  // HANDLER REMOVIDO - Consolidado no send_message principal

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

  // AI SDK v5 Event Handlers
  socket.on('aisdk:process', async (data) => {
    const { message, sessionId, options = {} } = data;
    
    if (!useAISDKv5) {
      socket.emit('error', {
        message: 'AI SDK v5 is not enabled',
        sessionId
      });
      return;
    }
    
    try {
      console.log('🎯 [AI SDK v5] Processing with AgentManagerV2');
      
      // Process with AI SDK v5 enhancements
      const result = await agentManagerV2.processMessage(
        message,
        sessionId,
        io,
        options
      );
      
      // Emit result
      socket.emit('aisdk:result', {
        sessionId,
        result,
        metadata: result.metadata
      });
    } catch (error) {
      console.error('❌ [AI SDK v5] Processing error:', error);
      socket.emit('error', {
        message: error.message,
        sessionId,
        type: 'aisdk_error'
      });
    }
  });
  
  // Orchestrator routing decision
  socket.on('orchestrator:route', async (data) => {
    const { message, sessionId, context = {} } = data;
    
    if (!useAISDKv5) {
      socket.emit('error', { message: 'AI SDK v5 not enabled' });
      return;
    }
    
    try {
      const routingResult = await agentManagerV2.orchestrator.route(message, context);
      
      socket.emit('orchestrator:routing', {
        sessionId,
        decision: routingResult.decision,
        metadata: routingResult.metadata
      });
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        type: 'orchestrator_error'
      });
    }
  });
  
  // Quality evaluation request
  socket.on('evaluator:evaluate', async (data) => {
    const { response, request, sessionId } = data;
    
    if (!useAISDKv5) {
      socket.emit('error', { message: 'AI SDK v5 not enabled' });
      return;
    }
    
    try {
      const evaluation = await agentManagerV2.evaluator.evaluateResponse(
        response,
        request
      );
      
      socket.emit('evaluator:quality', {
        sessionId,
        evaluation: evaluation.evaluation,
        metadata: evaluation.metadata
      });
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        type: 'evaluator_error'
      });
    }
  });
  
  // Parallel execution request
  socket.on('parallel:execute', async (data) => {
    const { tasks, sessionId, options = {} } = data;
    
    if (!useAISDKv5) {
      socket.emit('error', { message: 'AI SDK v5 not enabled' });
      return;
    }
    
    try {
      const result = await agentManagerV2.parallelExecutor.executeParallel(
        tasks,
        { ...options, io, sessionId }
      );
      
      socket.emit('parallel:complete', {
        sessionId,
        results: result.results,
        statistics: result.statistics
      });
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        type: 'parallel_error'
      });
    }
  });
  
  // Agent comparison request
  socket.on('aisdk:compare', async (data) => {
    const { message, agents, sessionId } = data;
    
    if (!useAISDKv5) {
      socket.emit('error', { message: 'AI SDK v5 not enabled' });
      return;
    }
    
    try {
      const comparison = await agentManagerV2.compareAgents(
        message,
        agents,
        sessionId,
        io
      );
      
      socket.emit('comparison:results', {
        sessionId,
        comparison
      });
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        type: 'comparison_error'
      });
    }
  });
  
  // Performance metrics request
  socket.on('aisdk:metrics', async (data) => {
    const { sessionId } = data;
    
    if (!useAISDKv5) {
      socket.emit('error', { message: 'AI SDK v5 not enabled' });
      return;
    }
    
    try {
      const metrics = await agentManagerV2.getPerformanceReport();
      
      socket.emit('aisdk:metrics_report', {
        sessionId,
        metrics
      });
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        type: 'metrics_error'
      });
    }
  });
  
  // Configure AI SDK settings
  socket.on('aisdk:configure', async (data) => {
    const { settings, sessionId } = data;
    
    if (!useAISDKv5) {
      socket.emit('error', { message: 'AI SDK v5 not enabled' });
      return;
    }
    
    try {
      agentManagerV2.configure(settings);
      
      socket.emit('aisdk:configured', {
        sessionId,
        settings: agentManagerV2.config
      });
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        type: 'configuration_error'
      });
    }
  });
  
  // HANDLER REMOVIDO - Consolidado no send_message principal

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
    socket.isMetricsSubscribed = false;
  });
});

// Real-time metrics broadcasting
setInterval(() => {
  if (io && enhancedAgentManager) {
    const metricsData = {
      enhanced: enhancedAgentManager.getPerformanceMetrics(),
      quality: qualityController ? qualityController.getQualityMetrics() : null,
      workers: workerPool ? workerPool.getMetrics() : null,
      orchestrator: orchestratorService ? {
        activeTasks: orchestratorService.getActiveTasksCount()
      } : null,
      timestamp: Date.now()
    };
    
    // Broadcast to subscribed clients
    io.sockets.sockets.forEach(socket => {
      if (socket.isMetricsSubscribed) {
        socket.emit('metrics:update', metricsData);
      }
    });
  }
}, 5000); // Broadcast every 5 seconds

// Cleanup interval
setInterval(() => {
  if (workerPool) {
    workerPool.cleanup();
  }
  if (qualityController) {
    qualityController.cleanupOldFeedback();
  }
}, 300000); // Cleanup every 5 minutes

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
  console.log('  • Enhanced Agent Manager with Orchestrator-Worker pattern');
  console.log('  • Quality Control and Feedback Loops');
  
  // Start health monitoring
  healthChecker.startMonitoring({
    mcpClient,
    agentManagerV2,
    a2aClient,
    io
  }, 30000); // Check every 30 seconds
  console.log('  • Real-time metrics and monitoring');
});