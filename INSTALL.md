# 📖 Guia de Instalação e Configuração Completo — WMS Inviolável

Este guia foi elaborado para orientar você no passo a passo completo da instalação, configuração e execução da plataforma **WMS Inviolável**. 

O sistema possui uma arquitetura moderna dividida em três pilares principais:
1. **Frontend**: Interface SPA construída com **React + TypeScript + Vite** e estilizada com CSS de alto padrão.
2. **Backend**: Servidor API RESTful robusto feito em **Node.js + Express + TypeScript** com integração opcional à API do Google Gemini.
3. **Banco de Dados**: Banco relacional **PostgreSQL (v15+)** orquestrado e conteinerizado via **Docker**.

---

## 🗺️ Visão Geral do Fluxo de Instalação

```mermaid
graph TD
    A[Instalar Docker & Docker Compose] --> B[Criar arquivo .env (opcional)]
    B --> C[Subir Aplicação via Docker Compose: docker compose up -d]
    C --> D[Acessar o Frontend em http://localhost]
```

---

## 🛠️ 1. Pré-requisitos: Instalação das Ferramentas Base

Para rodar todo o sistema de forma integrada em contêineres, você só precisa do **Docker** e do **Docker Compose**. Caso prefira rodar localmente fora de contêineres para fins de desenvolvimento, você também precisará do **Node.js**.

### A. Docker & Docker Compose (Recomendado)

O Docker permite empacotar a aplicação, o backend e o banco de dados dentro de contêineres virtuais isolados.

*   **Windows / macOS:** Baixe e instale o **Docker Desktop** em [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).
    *   *Nota para Windows:* Certifique-se de habilitar o WSL 2 (Windows Subsystem for Linux) durante a instalação.
*   **Linux (Debian/Ubuntu):** Instale os pacotes `docker-ce` e `docker-compose-plugin` seguindo as instruções oficiais da sua distribuição.
    *   Certifique-se de adicionar seu usuário ao grupo docker para executar comandos sem `sudo`: `sudo usermod -aG docker $USER` e reinicie a sessão.

> [!NOTE]
> **Verificação:** Certifique-se de que o Docker daemon está rodando e execute no terminal:
> ```bash
> docker --version
> docker compose version
> ```

### B. Node.js & npm (Opcional - Apenas para Desenvolvimento Local)

O Node.js só é necessário se você optar pelo **Método de Desenvolvimento Local** (fora do Docker).

*   **macOS / Linux:** Recomendamos usar o NVM para instalar:
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    # Reinicie o terminal
    nvm install --lts
    nvm use --lts
    ```
*   **Windows / macOS (Instalador):** Baixe e execute o instalador oficial diretamente em [nodejs.org](https://nodejs.org/).

---

## 🐳 2. Método Recomendado: Inicialização Completa via Docker Compose

Este método compila e executa todo o ecossistema do WMS (Banco de Dados, Backend e Frontend) em contêineres Docker, sem a necessidade de instalar Node.js ou npm localmente na sua máquina hospedeira.

### Passo a Passo:

1. **Configuração Opcional (Google Gemini AI):**
   Para habilitar o assistente de IA, crie um arquivo `.env` na raiz do projeto (`INVENTORY-VIS/`) e defina a sua chave de API:
   ```env
   GEMINI_API_KEY=sua_chave_de_api_aqui
   ```

2. **Iniciar todos os Serviços:**
   Na pasta raiz do projeto, execute o comando a seguir para construir as imagens e subir os contêineres em segundo plano:
   ```bash
   docker compose up -d --build
   ```

3. **Verificar os Contêineres:**
   Confira se todos os três contêineres estão ativos:
   ```bash
   docker compose ps
   ```
   Você deverá ver uma saída similar a esta:
   *   `inviolavel-wms-db` (Porta 5432) -> Banco relacional PostgreSQL
   *   `inviolavel-wms-backend` (Porta 3001) -> API REST
   *   `inviolavel-wms-frontend` (Porta 80) -> Servidor Nginx que entrega a interface React

4. **Acessar o Sistema:**
   *   **Frontend (Interface Web):** Abra no navegador [http://localhost](http://localhost) (porta padrão HTTP 80).
   *   **Backend (API):** Acessível em [http://localhost:3001](http://localhost:3001).

5. **Gerenciar os Contêineres:**
   *   **Ver Logs em Tempo Real:**
       ```bash
       docker compose logs -f
       ```
       Ou para um serviço específico (ex: backend):
       ```bash
       docker compose logs -f backend
       ```
   *   **Parar a Aplicação:**
       ```bash
       docker compose down
       ```

---

## 🛠️ 3. Método Alternativo: Desenvolvimento Híbrido (Local + DB no Docker)

Se você estiver desenvolvendo ou editando o código em tempo real, pode preferir rodar apenas o banco no Docker e o backend/frontend localmente para aproveitar o *Hot Module Replacement (HMR)*.

### Passo a Passo:

1. **Subir Apenas o Banco de Dados:**
   Na pasta raiz do projeto, execute:
   ```bash
   docker compose up -d postgres
   ```

2. **Configurar e Iniciar o Backend:**
   *   Navegue até a pasta `backend`: `cd backend`
   *   Instale as dependências: `npm install`
   *   Crie o arquivo `backend/.env` com a seguinte configuração:
       ```env
       PORT=3001
       DB_HOST=localhost
       DB_PORT=5432
       DB_USER=inviolavel_user
       DB_PASSWORD=inviolavel_password
       DB_NAME=inviolavel_wms
       GEMINI_API_KEY=sua_chave_de_api_opcional_aqui
       ```
   *   Inicie em modo de desenvolvimento: `npm run dev`

3. **Configurar e Iniciar o Frontend:**
   *   Abra outro terminal e navegue até a pasta `frontend`: `cd frontend`
   *   Instale as dependências: `npm install`
   *   Inicie o servidor de desenvolvimento Vite: `npm run dev`
   *   Acesse no navegador: [http://localhost:5173](http://localhost:5173)

---

## 🔑 4. Perfis de Acesso Cadastrados (RBAC)

O sistema conta com Controle de Acesso Baseado em Funções (Role-Based Access Control). Na primeira execução do backend, as seguintes contas padrão são populadas no banco para fins de homologação:

| Usuário (Username) | Senha (Password) | Perfil (Role) | Descrição do Nível de Acesso |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin` | **Administrador** | Acesso completo a todas as páginas e ações. Pode cadastrar/editar/excluir produtos, gerenciar níveis do estoque, cadastrar usuários, baixar/excluir backups e restaurar o banco de dados. |
| **`operador`** | `operador` | **Operador** | Acesso operacional. Permite registrar movimentações de entrada e saída, visualizar o mapa físico de estoques e cumprir as tarefas de conferência diária. As guias de configurações, auditorias e backups ficam ocultas. |
| **`auditor`** | `auditor` | **Auditor** | Acesso de leitura e validação. Pode visualizar o estoque físico, o mapa, o histórico de movimentações da trilha de auditoria e a lixeira. Não tem permissão para cadastrar, editar, excluir ou restaurar dados. |

---

## 💾 5. Funcionamento da Central de Backups

A plataforma possui um sistema integrado de gerenciamento de backups do banco de dados relacional:

*   **Backup Automático:** O backend possui um serviço ativo que verifica a cada 1 hora se já existe um arquivo de backup referente ao dia atual. Caso não exista, um backup completo em formato `.json` é gerado na pasta `backend/backups/`.
*   **Retenção de Dados:** O sistema descarta automaticamente arquivos de backup que possuam mais de 7 dias de criação (pruning), mantendo o armazenamento limpo.
*   **Backups Manuais e Restauração:** Logado com a conta de **Administrador**, navegue em **Configurações > Backup do WMS** para criar cópias manuais sob demanda ou restaurar estados anteriores do sistema. 

---

## 🔍 6. Resolução de Problemas Comuns (Troubleshooting)

### A. Erro: "Port 5432 is already in use" ao rodar o Docker Compose
Este erro ocorre se você já possui um servidor PostgreSQL instalado diretamente em sua máquina host física rodando em segundo plano.

*   **Como resolver:**
    *   **macOS (via Homebrew):**
        ```bash
        brew services stop postgresql
        ```
    *   **Linux (systemd):**
        ```bash
        sudo systemctl stop postgresql
        ```
    *   **Windows:**
        1. Pressione `Win + R`, digite `services.msc` e aperte Enter.
        2. Encontre o serviço com nome `postgresql-...` na lista.
        3. Clique com o botão direito e selecione **Parar (Stop)**.
    *   Após parar o serviço local, execute `docker compose up -d` novamente.

### B. O Frontend exibe um banner vermelho escrito "Modo de Contingência (Local)"
Isso indica que a interface web não conseguiu se conectar à API backend (porta `3001`). O sistema entra em modo de demonstração offline usando dados do `localStorage` para evitar que a operação pare, mas não sincroniza com o banco de dados principal.

*   **Como resolver:**
    *   **Se estiver usando Docker Compose (Recomendado):**
        1. Verifique se o contêiner do backend está ativo rodando `docker compose ps`.
        2. Analise os logs do backend para identificar falhas de inicialização ou conexões malsucedidas com o banco de dados: `docker compose logs backend`.
        3. Certifique-se de que a porta `3001` no host não está ocupada por outra aplicação.
    *   **Se estiver rodando localmente (Desenvolvimento Híbrido):**
        1. Verifique se o terminal do backend não travou ou reportou erros de conexão.
        2. Garanta que você executou `npm run dev` na pasta `backend/`.
        3. Certifique-se de que a variável `PORT=3001` no arquivo `.env` do backend está corretamente configurada.

### C. Recomendações de Compra por Inteligência Artificial aparecem como "local-simulation"
Se o painel do assistente de inteligência artificial exibir simulações estáticas em vez de análises detalhadas personalizadas:

*   **Como resolver:**
    1. Crie uma chave de API gratuita no [Google AI Studio](https://aistudio.google.com/).
    2. Adicione a chave à variável `GEMINI_API_KEY`:
       *   **No Docker Compose:** Crie o arquivo `.env` na raiz do projeto contendo `GEMINI_API_KEY=sua_chave_aqui` e reinicie a aplicação com `docker compose down && docker compose up -d`.
       *   **No modo local:** Adicione-a no arquivo `backend/.env` e reinicie o servidor backend.

---
*WMS Inviolável — Desenvolvido com excelência técnica por Bernardo Rodrigues.*
