const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Configuração do Swagger / OpenAPI Specification
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Gerenciamento de Tarefas',
      version: '1.0.0',
      description: 'API RESTful conteinerizada em Docker e documentada com Swagger UI'
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor Local / Contêiner Docker'
      }
    ]
  },
  apis: ['./server.js']
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// conexao com o MySQL (dados vem das variaveis do docker-compose)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'tarefas_db',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'app_senha',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

// o depends_on so espera o container do banco iniciar, nao o MySQL ficar pronto
// por isso tenta conectar algumas vezes antes de desistir
async function iniciarBanco(tentativas = 20) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tarefas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          titulo VARCHAR(255) NOT NULL,
          descricao TEXT,
          prioridade ENUM('BAIXA', 'MEDIA', 'ALTA') NOT NULL DEFAULT 'MEDIA',
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Conectado ao MySQL e tabela tarefas pronta');
      return;
    } catch (err) {
      console.log(`Banco ainda nao respondeu (tentativa ${i}/${tentativas}): ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('Nao foi possivel conectar no banco de dados');
}

/**
 * @openapi
 * components:
 *   schemas:
 *     TarefaDTO:
 *       type: object
 *       required:
 *         - titulo
 *       properties:
 *         titulo:
 *           type: string
 *           example: "Configurar Docker"
 *         descricao:
 *           type: string
 *           example: "Subir contêineres da API e do Banco"
 *         prioridade:
 *           type: string
 *           enum: [BAIXA, MEDIA, ALTA]
 *           example: "ALTA"
 *     TarefaResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         titulo:
 *           type: string
 *           example: "Configurar Docker"
 *         descricao:
 *           type: string
 *           example: "Subir contêineres da API e do Banco"
 *         prioridade:
 *           type: string
 *           example: "ALTA"
 *         criado_em:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/v1/tarefas:
 *   get:
 *     summary: Listar todas as tarefas
 *     tags:
 *       - Tarefas
 *     responses:
 *       200:
 *         description: Lista de tarefas retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TarefaResponse'
 */
app.get('/api/v1/tarefas', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tarefas ORDER BY id');
    return res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao buscar tarefas.' });
  }
});

/**
 * @openapi
 * /api/v1/tarefas:
 *   post:
 *     summary: Cadastrar uma nova tarefa
 *     tags:
 *       - Tarefas
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TarefaDTO'
 *     responses:
 *       201:
 *         description: Tarefa criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TarefaResponse'
 *       400:
 *         description: Dados inválidos (título ausente ou em branco)
 */
app.post('/api/v1/tarefas', async (req, res) => {
  const { titulo, descricao, prioridade } = req.body;

  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ erro: 'Título é obrigatório.' });
  }

  const prioridadeFinal = prioridade || 'MEDIA';
  if (!['BAIXA', 'MEDIA', 'ALTA'].includes(prioridadeFinal)) {
    return res.status(400).json({ erro: 'Prioridade deve ser BAIXA, MEDIA ou ALTA.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO tarefas (titulo, descricao, prioridade) VALUES (?, ?, ?)',
      [titulo.trim(), descricao || '', prioridadeFinal]
    );
    const [rows] = await pool.query('SELECT * FROM tarefas WHERE id = ?', [result.insertId]);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao salvar tarefa.' });
  }
});

iniciarBanco()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API Node.js rodando na porta ${PORT}`);
      console.log(`Documentação interativa Swagger UI: http://localhost:${PORT}/docs`);
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
