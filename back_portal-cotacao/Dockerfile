# Usa uma imagem Python leve (slim)
FROM python:3.11-slim

# Impede que o Python gere arquivos .pyc e permite logs em tempo real
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Instala dependências do sistema necessárias para o PostgreSQL
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Define a pasta de trabalho dentro do container
WORKDIR /app

# Instala as dependências do Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o resto do código do projeto
COPY . .

# Expõe a porta que o Django usa
EXPOSE 8000
