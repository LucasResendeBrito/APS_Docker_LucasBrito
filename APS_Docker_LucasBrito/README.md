# APS Docker - API de Tarefas

Stack escolhida: Node.js (Express) + MySQL 8.0

## Como rodar

```
docker compose up --build -d
```

Swagger UI: http://localhost:3000/docs

## Teste de persistencia

1. Criar uma tarefa pelo Swagger (POST /api/v1/tarefas)
2. `docker compose down`
3. `docker compose up -d`
4. Consultar GET /api/v1/tarefas, a tarefa continua la por causa do volume `mysqldata`

Obs: se a porta 3306 ja estiver em uso no Windows, trocar no docker-compose.yml para "3307:3306".
