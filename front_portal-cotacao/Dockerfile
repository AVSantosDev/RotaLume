FROM node:20-alpine

WORKDIR /app

# Copia arquivos de pacotes
COPY package*.json ./
RUN npm install

# Copia o resto
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]