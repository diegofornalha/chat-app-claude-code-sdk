import os
from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task




@CrewBase
class ExtratorJsonParaConstituicaoSocietariaCrew:
    """ExtratorJsonParaConstituicaoSocietaria crew"""

    
    @agent
    def extrator_conversacional_de_dados_json(self) -> Agent:
        
        return Agent(
            config=self.agents_config["extrator_conversacional_de_dados_json"],
            tools=[],
            reasoning=False,
            inject_date=True,
            llm=LLM(
                model="openai/auto",
                temperature=0.7,
            ),
        )
    

    
    @task
    def extracao_de_dados_para_constituicao_societaria(self) -> Task:
        return Task(
            config=self.tasks_config["extracao_de_dados_para_constituicao_societaria"],
        )
    

    @crew
    def crew(self) -> Crew:
        """Creates the ExtratorJsonParaConstituicaoSocietaria crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
        )
