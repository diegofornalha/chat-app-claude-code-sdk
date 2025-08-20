# 🔌 Arquitetura de Plugins - Chat App Claude Code SDK

## 📋 Visão Geral

O sistema foi refatorado para usar uma arquitetura modular de plugins, permitindo que agentes externos (como CrewAI e HelloWorld) sejam adicionados ou removidos dinamicamente sem modificar o código core do projeto.

## 🏗️ Estrutura

```
backend/
├── plugins/
│   ├── PluginManager.js      # Gerenciador principal de plugins
│   ├── AgentPlugin.js         # Interface base para plugins
│   ├── available/             # Plugins disponíveis (não carregados)
│   │   └── example-plugin.js  # Exemplo de implementação
│   └── enabled/               # Plugins ativos (carregados)
├── config/
│   └── plugins.json           # Configuração de plugins
```

## 🚀 Como Funciona

### 1. **PluginManager**
Responsável por:
- Carregar/descarregar plugins dinamicamente
- Gerenciar ciclo de vida dos plugins
- Hot-reload automático
- Integração com AgentManager

### 2. **AgentPlugin (Interface Base)**
Todos os plugins devem herdar desta classe e implementar:
- `initialize()` - Inicialização do plugin
- `getAgent()` - Retorna instância do agente
- `shutdown()` - Limpeza ao descarregar

### 3. **Configuração (plugins.json)**
```json
{
  "enabled": ["plugin-id"],        // Plugins ativos
  "available": [...],               // Lista de plugins disponíveis
  "settings": {                    // Configurações globais
    "autoReload": true,
    "maxPlugins": 10
  }
}
```

## 📦 Criando um Plugin

### Estrutura Básica:

```javascript
const AgentPlugin = require('../AgentPlugin');
const BaseAgent = require('../../agents/BaseAgent');

// 1. Criar o agente customizado
class MyAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      name: 'my-agent',
      type: 'custom',
      capabilities: ['task1', 'task2'],
      ...config
    });
  }

  async executeTask(task) {
    // Implementação do agente
  }
}

// 2. Criar o plugin
class MyPlugin extends AgentPlugin {
  constructor() {
    super({
      name: 'my-plugin',
      type: 'custom',
      version: '1.0.0',
      description: 'Meu plugin customizado',
      agentClass: MyAgent,
      agentConfig: { /* configurações */ }
    });
  }
}

module.exports = MyPlugin;
```

## 🔧 API de Gerenciamento

### Endpoints Disponíveis:

- `GET /api/plugins` - Lista todos os plugins
- `POST /api/plugins/:id/enable` - Habilita um plugin
- `POST /api/plugins/:id/disable` - Desabilita um plugin
- `POST /api/plugins/reload` - Recarrega todos os plugins

### Exemplo de Uso:

```bash
# Listar plugins
curl http://localhost:8080/api/plugins

# Habilitar plugin
curl -X POST http://localhost:8080/api/plugins/example-plugin/enable

# Desabilitar plugin
curl -X POST http://localhost:8080/api/plugins/crew-ai/disable
```

## 🔄 Migração dos Agentes Removidos

### CrewAI e HelloWorld
Estes agentes foram removidos do código core e agora podem ser instalados como plugins:

1. **Criar plugin CrewAI:**
   - Copiar lógica do antigo `CrewAIAgent.js`
   - Encapsular em um plugin seguindo a estrutura acima
   - Salvar em `plugins/available/crew-ai-plugin.js`

2. **Habilitar quando necessário:**
   ```bash
   curl -X POST http://localhost:8080/api/plugins/crew-ai-plugin/enable
   ```

## ✨ Benefícios

1. **Modularidade** - Agentes isolados do código core
2. **Flexibilidade** - Adicionar/remover agentes sem modificar o projeto
3. **Hot-Reload** - Atualizar plugins sem reiniciar o servidor
4. **Manutenibilidade** - Código mais limpo e organizado
5. **Escalabilidade** - Fácil adicionar novos agentes

## 🛠️ Desenvolvimento

### Adicionar Novo Plugin:

1. Criar arquivo em `plugins/available/meu-plugin.js`
2. Implementar interface `AgentPlugin`
3. Habilitar via API ou adicionar ao `plugins.json`

### Debugging:

```javascript
// Verificar status dos plugins
const status = pluginManager.getStatus();
console.log(status);

// Eventos do PluginManager
pluginManager.on('plugin:loaded', (data) => {
  console.log('Plugin carregado:', data.pluginId);
});
```

## 📝 Notas

- Plugins são carregados na inicialização do servidor
- Hot-reload monitora mudanças nos arquivos de plugins
- Cada plugin roda isolado e pode ser atualizado independentemente
- O sistema mantém compatibilidade com o AgentManager existente

## 🔮 Próximos Passos

1. Criar marketplace de plugins
2. Sistema de versionamento de plugins
3. Sandboxing para segurança
4. UI para gerenciamento de plugins
5. Sistema de dependências entre plugins

---

*Arquitetura implementada para tornar o projeto mais enxuto e extensível, permitindo que agentes sejam plugados conforme necessário.*