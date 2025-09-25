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

### Z-Index Layer System

To prevent z-index conflicts, we follow a consistent layering system:

```css
/* Z-Index Scale (0-1000) */

/* Background layers: 0-99 */
--z-canvas-background: 1;     /* Canvas grid and background */
--z-workflow-nodes: 2;        /* Workflow nodes base layer */

/* Interactive layers: 100-299 */
--z-connections: 3;           /* SVG connection lines (above nodes for targeting) */
--z-node-details: 10;         /* Node configuration panels */
--z-floating-panels: 20;      /* Draggable panels (toolbar, node palette) */

/* Overlay layers: 300-699 */
--z-dropdowns: 300;           /* Dropdown menus and selects */
--z-modals: 400;              /* Modal dialogs */
--z-overlays: 500;            /* Full-screen overlays */

/* Critical layers: 700-999 */
--z-tooltips: 700;            /* Tooltips and hints */
--z-notifications: 800;       /* Toast notifications */
--z-connection-toolbar: 900;  /* Connection editing toolbar */

/* Emergency layer: 1000 */
--z-emergency: 1000;          /* Debug panels, critical alerts */
```

**Usage Guidelines:**
- Use CSS custom properties: `z-index: var(--z-floating-panels)`
- Increment by 1 when stacking within same category: `z-index: calc(var(--z-floating-panels) + 1)`
- Never exceed 1000 except for true emergencies
- Document any new z-index values in this list

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