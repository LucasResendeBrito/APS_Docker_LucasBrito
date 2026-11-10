FROM node:20-alpine

WORKDIR /app

# copia primeiro so os manifestos pra aproveitar o cache das camadas
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
