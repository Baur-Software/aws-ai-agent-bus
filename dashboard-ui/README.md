# AWS AI Agent Bus Dashboard

Modern SolidJS dashboard for the AWS AI Agent Bus MCP server.

## Features

- 🚀 **SolidJS**: Fast reactive UI framework
- 🎨 **Modern Design**: Clean interface inspired by Open WebUI
- 📱 **Responsive**: Works on desktop, tablet, and mobile
- 🌙 **Dark/Light Theme**: Automatic theme switching with persistence
- 💬 **AI Assistant**: Interactive chat panel for MCP operations
- 🔄 **Real-time**: Live connection status and updates
- 🧩 **Modular**: Provider/context pattern for clean state management

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

- **Contexts**: Theme, MCP connection, notifications
- **Components**: Sidebar, header, chat panel, widgets
- **Pages**: Dashboard, analytics, workflows, etc.
- **Styles**: CSS variables with theme support

## MCP Integration

The dashboard communicates with the MCP server via:
- REST API endpoints (`/mcp`, `/api`, `/info`, `/health`)
- WebSocket connections (planned)
- Real-time status updates

## Building

The build process creates optimized static files that can be:
- Served by the MCP HTTP server
- Deployed to any static hosting service
- Integrated into existing applications