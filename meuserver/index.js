const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs').promises;

const app = express();
const PORT = 3000;
const REPO_URL = 'https://github.com/DevZIKIII/DanielJacometo.git';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Função para verificar se um diretório existe
async function directoryExists(path) {
    try {
        const stats = await fs.stat(path);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

// Função para verificar se um arquivo existe
async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

// Função para clonar o repositório
async function setupRepository() {
    try {
        console.log('Verificando estrutura de pastas...');
        
        // Verifica se a pasta public existe
        const publicExists = await directoryExists(PUBLIC_DIR);
        
        if (!publicExists) {
            console.log('Criando pasta public...');
            await fs.mkdir(PUBLIC_DIR, { recursive: true });
        }

        // Verifica se já existe conteúdo na pasta public
        const files = await fs.readdir(PUBLIC_DIR);
        
        // Verifica especificamente se existe um .git (indicando que já foi clonado)
        const gitExists = await directoryExists(path.join(PUBLIC_DIR, '.git'));
        
        if (files.length === 0 || !gitExists) {
            console.log('Clonando repositório do GitHub...');
            
            // Se houver arquivos mas não é um repositório git, limpa a pasta
            if (files.length > 0 && !gitExists) {
                console.log('Limpando pasta public antes de clonar...');
                for (const file of files) {
                    await fs.rm(path.join(PUBLIC_DIR, file), { recursive: true, force: true });
                }
            }
            
            return new Promise((resolve, reject) => {
                // Clona diretamente dentro da pasta public
                const command = `git clone ${REPO_URL} .`;
                console.log(`Executando: ${command}`);
                
                exec(command, { cwd: PUBLIC_DIR }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Erro ao clonar repositório: ${error.message}`);
                        if (stderr) console.error(`Stderr: ${stderr}`);
                        reject(error);
                        return;
                    }
                    console.log('Repositório clonado com sucesso!');
                    if (stdout) console.log(stdout);
                    resolve();
                });
            });
        } else {
            console.log('Repositório já existe. Fazendo pull das atualizações...');
            return new Promise((resolve, reject) => {
                exec('git pull', { cwd: PUBLIC_DIR }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Erro ao atualizar repositório: ${error.message}`);
                        reject(error);
                        return;
                    }
                    console.log('Repositório atualizado!');
                    resolve();
                });
            });
        }
    } catch (error) {
        console.error('Erro durante setup:', error);
        throw error;
    }
}

// Configuração do Express para servir arquivos estáticos
app.use(express.static(PUBLIC_DIR));

// Middleware para log de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rota principal
app.get('/', async (req, res) => {
    try {
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        const exists = await fileExists(indexPath);
        
        if (!exists) {
            // Lista os arquivos disponíveis para debug
            const files = await fs.readdir(PUBLIC_DIR);
            console.log('Arquivos em public:', files);
            
            res.status(404).send(`
                <html>
                <head><title>Erro</title></head>
                <body>
                    <h1>Arquivo index.html não encontrado!</h1>
                    <p>Verifique se o repositório foi clonado corretamente.</p>
                    <p>Arquivos encontrados em public: ${files.join(', ') || 'Nenhum arquivo encontrado'}</p>
                    <p><a href="/update-repo">Tentar atualizar repositório</a></p>
                    <p><a href="/repo-status">Ver status do repositório</a></p>
                </body>
                </html>
            `);
            return;
        }
        
        res.sendFile(indexPath);
    } catch (error) {
        console.error('Erro ao servir index.html:', error);
        res.status(500).send('Erro interno do servidor');
    }
});

// Rota para atualizar o repositório (pull)
app.get('/update-repo', async (req, res) => {
    try {
        await setupRepository();
        
        res.send(`
            <html>
            <head><title>Atualização</title></head>
            <body>
                <h1>Repositório atualizado com sucesso!</h1>
                <p><a href="/">Voltar para a página principal</a></p>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`
            <html>
            <head><title>Erro</title></head>
            <body>
                <h1>Erro ao atualizar repositório</h1>
                <pre>${error.message}</pre>
                <p><a href="/">Voltar</a></p>
            </body>
            </html>
        `);
    }
});

// Rota para verificar status do Git
app.get('/repo-status', async (req, res) => {
    try {
        const gitExists = await directoryExists(path.join(PUBLIC_DIR, '.git'));
        
        if (!gitExists) {
            res.send(`
                <html>
                <head><title>Status</title></head>
                <body>
                    <h1>Repositório não encontrado</h1>
                    <p>A pasta public não contém um repositório Git.</p>
                    <p><a href="/update-repo">Clonar repositório</a></p>
                </body>
                </html>
            `);
            return;
        }
        
        const status = await new Promise((resolve, reject) => {
            exec('git status', { cwd: PUBLIC_DIR }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });
        
        // Lista arquivos
        const files = await fs.readdir(PUBLIC_DIR);
        
        res.send(`
            <html>
            <head><title>Status do Repositório</title></head>
            <body>
                <h1>Status do Git</h1>
                <pre>${status}</pre>
                <h2>Arquivos em public/</h2>
                <ul>
                    ${files.map(f => `<li>${f}</li>`).join('')}
                </ul>
                <p><a href="/">Voltar para a página principal</a></p>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`
            <html>
            <head><title>Erro</title></head>
            <body>
                <h1>Erro ao verificar status</h1>
                <pre>${error.message}</pre>
                <p><a href="/">Voltar</a></p>
            </body>
            </html>
        `);
    }
});

// Rota para listar arquivos (debug)
app.get('/files', async (req, res) => {
    try {
        const files = await fs.readdir(PUBLIC_DIR);
        const fileDetails = [];
        
        for (const file of files) {
            const stats = await fs.stat(path.join(PUBLIC_DIR, file));
            fileDetails.push({
                name: file,
                isDirectory: stats.isDirectory(),
                size: stats.size
            });
        }
        
        res.json({
            publicDir: PUBLIC_DIR,
            files: fileDetails
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Inicializa o servidor
async function startServer() {
    try {
        console.log('Iniciando servidor...');
        console.log(`Diretório público: ${PUBLIC_DIR}`);
        
        await setupRepository();
        
        app.listen(PORT, () => {
            console.log(`\n=================================`);
            console.log(`MEU Server rodando!`);
            console.log(`=================================`);
            console.log(`URL principal: http://localhost:${PORT}`);
            console.log(`\nRotas disponíveis:`);
            console.log(`  - http://localhost:${PORT}/ (página principal)`);
            console.log(`  - http://localhost:${PORT}/update-repo (atualizar/clonar do GitHub)`);
            console.log(`  - http://localhost:${PORT}/repo-status (verificar status Git)`);
            console.log(`  - http://localhost:${PORT}/files (listar arquivos - debug)`);
            console.log(`=================================\n`);
        });
    } catch (error) {
        console.error('Erro ao iniciar servidor:', error);
        console.error('Tentando iniciar servidor mesmo assim...');
        
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
            console.log(`Acesse http://localhost:${PORT}/update-repo para clonar o repositório`);
        });
    }
}

// Inicia o servidor
startServer();