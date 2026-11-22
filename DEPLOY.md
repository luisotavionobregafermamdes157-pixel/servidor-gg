# Servidor GG — instalação do backend

O site publicado no GitHub Pages é apenas o frontend estático. O backend tem de correr num VPS/servidor separado com Node.js 20+ ou Docker. Não coloques tokens Pterodactyl, JWT secrets ou passwords no HTML, JavaScript público, GitHub ou neste chat.

## 1. Preparar o Pterodactyl

1. Instala e confirma que o Pterodactyl Panel e o Wings estão operacionais.
2. Cria um utilizador de serviço no painel para os servidores criados pela aplicação e guarda o respetivo ID.
3. Cria uma Application API key no painel, com permissões mínimas necessárias para criar/consultar servidores e utilizadores. Não uses uma Client API key.
4. Instala os Eggs Minecraft que pretendes disponibilizar (Paper, Vanilla, Fabric, Forge, etc.).
5. Confirma para cada Egg o Nest ID, Egg ID, imagem Docker, comando de arranque e variáveis obrigatórias.
6. Cria uma allocation disponível no node e guarda o respetivo ID.

A aplicação não consegue adivinhar os IDs, imagens ou variáveis dos Eggs. Cada instalação Pterodactyl pode ter configurações diferentes.

## 2. Configurar o backend

Na pasta `api`:

```bash
cp .env.example .env
```

Edita `.env` no servidor de alojamento, não no repositório. Define:
- `JWT_SECRET`: string aleatória com pelo menos 32 caracteres.
- `FRONTEND_ORIGIN`: origem exata do frontend, sem caminho (por exemplo, `https://utilizador.github.io`).
- `PTERODACTYL_URL`, `PTERODACTYL_APPLICATION_KEY`, `PTERODACTYL_OWNER_ID` e `PTERODACTYL_ALLOCATION_ID`.
- `EGG_MAP_JSON`: mapeamento dos Eggs realmente instalados.

Exemplo meramente estrutural de um Egg Paper (substitui IDs, imagem, startup e variáveis pelos valores do teu painel):

```json
{
  "paper": {
    "nestId": 1,
    "eggId": 3,
    "dockerImage": "ghcr.io/pterodactyl/yolks:java_21",
    "startup": "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
    "versionVariable": "MINECRAFT_VERSION",
    "environment": {
      "SERVER_JARFILE": "server.jar",
      "BUILD_TYPE": "default"
    }
  }
}
```

O nome das variáveis tem de coincidir exatamente com o Egg instalado. Não copies o exemplo sem validar no teu painel.

Instala e inicia:

```bash
cd api
npm install
npm start
```

A API fica, por omissão, na porta 3000. Usa HTTPS através de um reverse proxy (por exemplo, Caddy ou Nginx), firewall e backups da base de dados.

### Arranque com Docker Compose (VPS)

Na pasta `api`, cria o ficheiro `.env` a partir de `.env.example`, preenche os valores reais e executa:

```bash
docker compose up -d --build
docker compose logs -f
```

O Compose mantém a base de dados num volume persistente e publica a porta 3000 apenas em `127.0.0.1`, para que um proxy HTTPS local (Caddy/Nginx) a possa encaminhar. Configura o domínio e o certificado TLS no proxy antes de apontar o site para a API. Não abras a porta 3000 diretamente à Internet.

## 3. Ligar o frontend ao backend

No ficheiro `config.js`, define `window.SERVIDOR_GG_API_URL` para o URL HTTPS público da API, por exemplo `https://api.teudominio.pt`. O valor é público e não deve conter segredos.

Depois publica novamente o frontend no GitHub Pages.

## 4. Estado e limitações desta primeira integração

- Inclui registo, login, JWT, base de dados SQLite, catálogo de versões Java e pedido autenticado de criação de servidor através da Application API.
- Os servidores são criados sob o utilizador de serviço Pterodactyl configurado. A aplicação regista o proprietário na sua própria base de dados; não partilhes o acesso desse utilizador do painel.
- Só é possível criar os softwares mapeados em `EGG_MAP_JSON`. Para disponibilizar todas as opções, instala e configura os Eggs correspondentes e valida a compatibilidade de versões.
- O catálogo da Mojang lista versões Java release; isso não significa que todos os Eggs suportem todas as versões.
- Esta versão ainda não inclui consola em tempo real, iniciar/parar/reiniciar, ficheiros, plugins, mods, backups acionáveis, pagamentos, quotas por utilizador, verificação de email, recuperação de password, painel administrativo ou proteção anti-abuso de produção.
- Antes de abrir registos ao público, adiciona verificação de email, quotas globais por node, monitorização, backups, políticas de retenção e testes de segurança. O MVP já limita pedidos de criação por hora e servidores por conta, mas isso não substitui controlos completos de capacidade. Configura também limites de RAM/disco/CPU que correspondam à capacidade real do node.

## 5. Verificar

- `GET /api/health` verifica se a API está ativa e indica se as variáveis Pterodactyl estão presentes.
- `POST /api/auth/register` com JSON `{"email":"tu@example.com","password":"uma-password-forte"}` cria uma conta.
- Usa o token recebido como `Authorization: Bearer TOKEN` em `POST /api/servers`, com JSON `{"name":"O meu mundo","software":"paper","version":"1.21.4","memoryMb":2048}`.

Não uses dados de exemplo como credenciais reais.
