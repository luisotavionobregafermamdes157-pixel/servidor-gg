# Servidor GG

Website frontend for a Minecraft server hosting platform. Interface language: Portuguese.

## Current status

This repository contains a responsive landing page and an interactive server configuration preview.

### Included
- Responsive dark gaming design
- Java / Bedrock edition selector
- Version, software and RAM selectors
- Configuration preview form
- Example plan cards
- Basic copy-address interaction

### Important limitation
The current site is a frontend demonstration. Submitting the form does **not** provision a Minecraft server. Real server creation and management require a backend, database, authentication, a hosting machine, and integration with a server management panel such as Pterodactyl (or an equivalent API). Login, billing, live console, file management and real server power controls are not connected yet.

## Run locally

Open `index.html` in a browser, or run a local static server:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Next development steps
1. Add backend API and database.
2. Implement secure registration and login.
3. Connect Pterodactyl for server provisioning and power controls.
4. Add live console and file/plugin management.
5. Configure real plans, payments, limits and admin permissions.
6. Deploy the frontend and backend with production secrets and monitoring.

Servidor GG is an independent project and is not affiliated with Mojang or Microsoft.