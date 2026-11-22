# Servidor GG

Frontend e backend inicial para uma plataforma de alojamento de servidores Minecraft, com interface em português e integração preparada para Pterodactyl.

## O que está no repositório

- Site responsivo publicado como frontend estático.
- Formulários de registo e login ligados à API.
- Backend Node.js com SQLite, passwords com hash bcrypt e sessões JWT.
- Catálogo de versões Java release consultado no manifesto público da Mojang.
- Provisionamento de servidores através da Application API do Pterodactyl, usando Eggs configurados pelo administrador.
- Dockerfile, exemplo de variáveis de ambiente e guia de instalação.

## Estado real

O código e a estrutura estão no repositório, mas **a criação real só funciona depois de alojar a API num VPS e configurar um Pterodactyl Panel + Wings, node, allocation, utilizador de serviço, Application API key e Eggs**. O GitHub Pages não executa o backend.

O MVP atual cria servidores Java apenas para os softwares configurados em `EGG_MAP_JSON`. A lista de versões é ampla, mas a compatibilidade depende de cada Egg. Bedrock, consola em tempo real, ligar/desligar/reiniciar, gestão de ficheiros/plugins/mods, backups acionáveis, pagamentos, quotas e painel administrativo ainda não estão implementados.

## Começar

Segue o guia completo em [DEPLOY.md](DEPLOY.md). Copia `api/.env.example` para `.env` no servidor e preenche os valores reais. Nunca comites `.env` nem exponhas a Application API key.

Para apontar o frontend à API, define o URL HTTPS público em `config.js` e publica novamente o GitHub Pages.

## Desenvolvimento local

Frontend: abrir `index.html` através de um servidor estático (por exemplo, `python -m http.server 8000`).

Backend:

```bash
cd api
cp .env.example .env
npm install
npm start
```

A API requer Node.js 20+. Sem configuração real do Pterodactyl, os pedidos de provisionamento são recusados.

Servidor GG é um projeto independente e não é afiliado à Mojang ou Microsoft.
