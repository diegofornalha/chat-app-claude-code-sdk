/**
 * CrewAIAgentSDK - Parallel Worker Pattern for CrewAI
 * Distributes tasks across crew members for parallel execution
 */

const { generateObject, generateText } = require('ai');
const { z } = require('zod');
const { claudeCode } = require('ai-sdk-provider-claude-code');
const BaseAgent = require('./BaseAgent');

// Schemas for crew task distribution
const CrewTaskSchema = z.object({
  id: z.string(),
  role: z.enum(['researcher', 'analyst', 'writer', 'reviewer', 'coordinator']),
  task: z.string(),
  priority: z.number().min(1).max(10),
  dependencies: z.array(z.string()).optional(),
  expectedDuration: z.number(),
  requiredSkills: z.array(z.string())
});

const CrewExecutionPlanSchema = z.object({
  objective: z.string(),
  crewMembers: z.array(z.object({
    id: z.string(),
    role: z.string(),
    status: z.enum(['idle', 'busy', 'completed']),
    currentTask: z.string().optional()
  })),
  tasks: z.array(CrewTaskSchema),
  parallelGroups: z.array(z.array(z.string())),
  coordinationStrategy: z.enum(['autonomous', 'supervised', 'collaborative'])
});

const CrewResultSchema = z.object({
  taskId: z.string(),
  memberId: z.string(),
  result: z.string(),
  quality: z.number().min(0).max(10),
  insights: z.array(z.string()),
  nextSteps: z.array(z.string()).optional()
});

class CrewAIAgentSDK extends BaseAgent {
  constructor() {
    super('crewai-sdk', 'CrewAI with Parallel Workers');
    
    // Initialize AI SDK for crew coordination
    this.model = claudeCode('claude-3-5-sonnet-20241022');
    
    // Crew configuration
    this.crew = {
      members: [
        { id: 'researcher-1', role: 'researcher', skills: ['web_search', 'data_gathering'] },
        { id: 'analyst-1', role: 'analyst', skills: ['data_analysis', 'pattern_recognition'] },
        { id: 'writer-1', role: 'writer', skills: ['content_creation', 'summarization'] },
        { id: 'reviewer-1', role: 'reviewer', skills: ['quality_check', 'fact_verification'] },
        { id: 'coordinator-1', role: 'coordinator', skills: ['task_distribution', 'synthesis'] }
      ],
      maxParallelTasks: 4,
      coordinationMode: 'supervised'
    };
    
    // Task tracking
    this.activeTasks = new Map();
    this.completedTasks = new Map();
  }

  /**
   * Process message with crew collaboration
   */
  async processMessage(message, sessionId, io) {
    console.log('[CrewAIAgentSDK] Processing with crew collaboration...');
    
    try {
      // Create execution plan
      const plan = await this._createExecutionPlan(message);
      
      if (!plan.success) {
        throw new Error('Failed to create crew execution plan');
      }
      
      // Emit plan to frontend
      if (io) {
        io.to(sessionId).emit('crew:plan', {
          objective: plan.data.objective,
          taskCount: plan.data.tasks.length,
          parallelGroups: plan.data.parallelGroups.length,
          strategy: plan.data.coordinationStrategy
        });
      }
      
      // Execute plan with parallel workers
      const results = await this._executeCrewPlan(plan.data, sessionId, io);
      
      // Synthesize results
      const synthesis = await this._synthesizeResults(results, message);
      
      return synthesis;
    } catch (error) {
      console.error('[CrewAIAgentSDK] Processing error:', error);
      throw error;
    }
  }

  /**
   * Create crew execution plan
   */
  async _createExecutionPlan(message) {
    console.log('[CrewAIAgentSDK] Creating crew execution plan...');
    
    const result = await generateObject({
      model: this.model,
      schema: CrewExecutionPlanSchema,
      prompt: `
        Create a crew execution plan for this request:
        
        Request: "${message}"
        
        Available Crew Members:
        ${JSON.stringify(this.crew.members, null, 2)}
        
        Guidelines:
        1. Break down into tasks suitable for parallel execution
        2. Assign appropriate crew members based on skills
        3. Identify task dependencies
        4. Group independent tasks for parallel execution
        5. Choose coordination strategy
        
        Optimize for collaboration and parallel processing.
      `,
      experimental_telemetry: {
        functionId: 'crew-plan',
        metadata: { requestLength: message.length }
      }
    });
    
    return {
      success: true,
      data: result.object
    };
  }

  /**
   * Execute crew plan with parallel workers
   */
  async _executeCrewPlan(plan, sessionId, io) {
    console.log('[CrewAIAgentSDK] Executing crew plan...');
    
    const results = [];
    const memberStatus = new Map();
    
    // Initialize member status
    plan.crewMembers.forEach(member => {
      memberStatus.set(member.id, 'idle');
    });
    
    // Process parallel groups
    for (let groupIndex = 0; groupIndex < plan.parallelGroups.length; groupIndex++) {
      const group = plan.parallelGroups[groupIndex];
      
      console.log(`[CrewAIAgentSDK] Processing parallel group ${groupIndex + 1}/${plan.parallelGroups.length}`);
      
      // Emit group progress
      if (io) {
        io.to(sessionId).emit('crew:group_start', {
          groupIndex: groupIndex + 1,
          totalGroups: plan.parallelGroups.length,
          tasks: group
        });
      }
      
      // Execute tasks in parallel
      const groupPromises = group.map(taskId => {
        const task = plan.tasks.find(t => t.id === taskId);
        const member = this._selectCrewMember(task, memberStatus);
        
        return this._executeCrewTask(task, member, sessionId, io);
      });
      
      const groupResults = await Promise.allSettled(groupPromises);
      
      // Process results
      groupResults.forEach((result, index) => {
        const taskId = group[index];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
          this.completedTasks.set(taskId, result.value);
        } else {
          console.error(`[CrewAIAgentSDK] Task ${taskId} failed:`, result.reason);
          results.push({
            taskId,
            error: result.reason,
            fallback: true
          });
        }
      });
      
      // Emit group completion
      if (io) {
        io.to(sessionId).emit('crew:group_complete', {
          groupIndex: groupIndex + 1,
          successCount: groupResults.filter(r => r.status === 'fulfilled').length,
          totalTasks: group.length
        });
      }
    }
    
    return results;
  }

  /**
   * Execute individual crew task
   */
  async _executeCrewTask(task, member, sessionId, io) {
    console.log(`[CrewAIAgentSDK] Member ${member.id} executing task ${task.id}`);
    
    // Mark task as active
    this.activeTasks.set(task.id, {
      member: member.id,
      startTime: Date.now()
    });
    
    // Emit task start
    if (io) {
      io.to(sessionId).emit('crew:task_start', {
        taskId: task.id,
        memberId: member.id,
        role: member.role,
        task: task.task
      });
    }
    
    try {
      // Simulate crew member processing with AI
      const result = await generateObject({
        model: this.model,
        schema: CrewResultSchema,
        prompt: `
          You are a ${member.role} crew member with skills: ${member.skills.join(', ')}
          
          Execute this task:
          Task: ${task.task}
          Priority: ${task.priority}
          Required Skills: ${task.requiredSkills.join(', ')}
          
          Provide detailed results with insights and quality assessment.
          Be specific to your role and leverage your specialized skills.
        `,
        experimental_telemetry: {
          functionId: 'crew-task',
          metadata: { 
            taskId: task.id,
            role: member.role
          }
        }
      });
      
      // Add member and task metadata
      result.object.taskId = task.id;
      result.object.memberId = member.id;
      
      // Mark task as complete
      this.activeTasks.delete(task.id);
      
      // Emit task completion
      if (io) {
        io.to(sessionId).emit('crew:task_complete', {
          taskId: task.id,
          memberId: member.id,
          quality: result.object.quality,
          duration: Date.now() - this.activeTasks.get(task.id)?.startTime
        });
      }
      
      return result.object;
    } catch (error) {
      // Mark task as failed
      this.activeTasks.delete(task.id);
      throw error;
    }
  }

  /**
   * Synthesize crew results
   */
  async _synthesizeResults(results, originalRequest) {
    console.log('[CrewAIAgentSDK] Synthesizing crew results...');
    
    // Filter successful results
    const successfulResults = results.filter(r => !r.error);
    
    // Group results by role
    const resultsByRole = {};
    successfulResults.forEach(result => {
      const member = this.crew.members.find(m => m.id === result.memberId);
      if (member) {
        if (!resultsByRole[member.role]) {
          resultsByRole[member.role] = [];
        }
        resultsByRole[member.role].push(result);
      }
    });
    
    // Generate synthesis
    const synthesis = await generateText({
      model: this.model,
      prompt: `
        Synthesize these crew collaboration results:
        
        Original Request: "${originalRequest}"
        
        Results by Role:
        ${JSON.stringify(resultsByRole, null, 2)}
        
        Create a comprehensive response that:
        1. Integrates insights from all crew members
        2. Highlights key findings
        3. Presents a cohesive answer
        4. Acknowledges different perspectives
        5. Provides actionable recommendations
      `,
      maxTokens: 2000,
      experimental_telemetry: {
        functionId: 'crew-synthesis',
        metadata: { 
          resultCount: successfulResults.length,
          roles: Object.keys(resultsByRole)
        }
      }
    });
    
    return {
      content: synthesis.text,
      metadata: {
        agent: this.name,
        crewSize: this.crew.members.length,
        tasksCompleted: successfulResults.length,
        tasksTotal: results.length,
        parallel: true,
        synthesis: true
      },
      crewResults: resultsByRole
    };
  }

  /**
   * Select appropriate crew member for task
   */
  _selectCrewMember(task, memberStatus) {
    // Find members with required skills
    const eligibleMembers = this.crew.members.filter(member => {
      // Check if member has required skills
      const hasSkills = task.requiredSkills.some(skill => 
        member.skills.includes(skill)
      );
      
      // Check if member matches role
      const matchesRole = member.role === task.role;
      
      // Check if member is available
      const isAvailable = memberStatus.get(member.id) === 'idle';
      
      return (hasSkills || matchesRole) && isAvailable;
    });
    
    if (eligibleMembers.length === 0) {
      // Fallback to coordinator if no eligible members
      return this.crew.members.find(m => m.role === 'coordinator');
    }
    
    // Select member with best skill match
    const selected = eligibleMembers.reduce((best, member) => {
      const skillMatch = task.requiredSkills.filter(skill => 
        member.skills.includes(skill)
      ).length;
      
      const bestMatch = task.requiredSkills.filter(skill => 
        best.skills.includes(skill)
      ).length;
      
      return skillMatch > bestMatch ? member : best;
    });
    
    // Mark member as busy
    memberStatus.set(selected.id, 'busy');
    
    return selected;
  }

  /**
   * Delegate specific task to crew member
   */
  async delegateTask(task, memberId, sessionId) {
    const member = this.crew.members.find(m => m.id === memberId);
    
    if (!member) {
      throw new Error(`Crew member ${memberId} not found`);
    }
    
    return await this._executeCrewTask(
      {
        id: `delegated-${Date.now()}`,
        role: member.role,
        task,
        priority: 5,
        requiredSkills: member.skills,
        expectedDuration: 60
      },
      member,
      sessionId,
      null
    );
  }

  /**
   * Get crew status
   */
  getCrewStatus() {
    return {
      members: this.crew.members.map(member => ({
        ...member,
        status: this.activeTasks.has(member.id) ? 'busy' : 'idle',
        currentTask: Array.from(this.activeTasks.entries())
          .find(([_, task]) => task.member === member.id)?.[0]
      })),
      activeTasks: this.activeTasks.size,
      completedTasks: this.completedTasks.size,
      coordinationMode: this.crew.coordinationMode
    };
  }

  /**
   * Configure crew settings
   */
  configureCrew(settings) {
    this.crew = { ...this.crew, ...settings };
    console.log('[CrewAIAgentSDK] Crew configuration updated:', this.crew);
  }

  /**
   * Add new crew member
   */
  addCrewMember(member) {
    this.crew.members.push(member);
    console.log(`[CrewAIAgentSDK] Added crew member: ${member.id}`);
  }

  /**
   * Remove crew member
   */
  removeCrewMember(memberId) {
    this.crew.members = this.crew.members.filter(m => m.id !== memberId);
    console.log(`[CrewAIAgentSDK] Removed crew member: ${memberId}`);
  }

  /**
   * Get crew performance metrics
   */
  getPerformanceMetrics() {
    const taskMetrics = Array.from(this.completedTasks.values());
    
    const avgQuality = taskMetrics.reduce((sum, t) => sum + (t.quality || 0), 0) / taskMetrics.length;
    
    const rolePerformance = {};
    this.crew.members.forEach(member => {
      const memberTasks = taskMetrics.filter(t => t.memberId === member.id);
      if (memberTasks.length > 0) {
        rolePerformance[member.role] = {
          tasksCompleted: memberTasks.length,
          averageQuality: memberTasks.reduce((sum, t) => sum + (t.quality || 0), 0) / memberTasks.length
        };
      }
    });
    
    return {
      totalTasksCompleted: taskMetrics.length,
      averageQuality,
      rolePerformance,
      crewEfficiency: this.completedTasks.size / (this.completedTasks.size + this.activeTasks.size)
    };
  }
}

module.exports = CrewAIAgentSDK;