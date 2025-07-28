# 3D Showcase

A real-time 3D scene editor built with Phoenix LiveView and Three.js. Create, manipulate, and save 3D scenes directly in your browser with an intuitive drag-and-drop interface.

![3D Showcase Demo](https://via.placeholder.com/800x400?text=3D+Showcase+Demo)

## Features

- 🎨 **Drag & Drop Components** - Easily add 3D objects (cubes, spheres) to your scene
- 🎮 **Transform Controls** - Move, rotate, and scale objects with visual gizmos
- 💾 **Scene Persistence** - Save and load complete 3D scenes
- 🎯 **Intuitive Controls** - Keyboard shortcuts for quick transformations
- 🌐 **Real-time Updates** - Phoenix LiveView ensures instant synchronization
- 🎨 **Customizable Properties** - Adjust colors, positions, and animations
- 📐 **Grid System** - Snap objects to a configurable grid

## Quick Start

### Prerequisites

- Elixir 1.14+ 
- Erlang/OTP 25+
- PostgreSQL 14+
- Node.js 16+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/showcase.git
   cd showcase
   ```

2. **Install dependencies**
   ```bash
   mix deps.get
   mix deps.compile
   ```

3. **Setup the database**
   ```bash
   # Create database user (optional if you already have one)
   sudo -u postgres psql < create_db_user.sql
   
   # Create and migrate database
   mix ecto.create
   mix ecto.migrate
   ```

4. **Install Node.js dependencies**
   ```bash
   cd assets
   npm install
   cd ..
   ```

5. **Start the Phoenix server**
   ```bash
   mix phx.server
   ```

Now visit [`http://localhost:4000`](http://localhost:4000) to see your 3D Showcase!

## Usage

### Basic Controls

#### Object Manipulation
- **Click** - Select an object
- **Drag** - Move objects on the horizontal plane
- **Shift + Drag** - Move objects vertically
- **Right-click + Drag** - Orbit camera around scene
- **Scroll** - Zoom in/out

#### Keyboard Shortcuts
- **W** - Switch to Move mode
- **E** - Switch to Rotate mode
- **R** - Switch to Scale mode
- **Q** - Toggle Local/World transform space
- **Delete/Backspace** - Delete selected object

### Creating a Scene

1. **Add Objects**
   - Drag components from the sidebar into the 3D viewport
   - Objects snap to the grid automatically

2. **Customize Objects**
   - Select an object by clicking on it
   - Use the Properties panel to adjust:
     - Position (X, Y, Z)
     - Color
   - Use transform controls or keyboard shortcuts for advanced manipulation

3. **Save Your Scene**
   - Click "Save Scene" to persist your creation
   - All object properties, positions, and scene settings are saved

4. **Load Scenes**
   - Click on any saved scene in the sidebar to load it
   - The entire scene state is restored, including camera position

## Project Structure

```
showcase/
├── assets/              # Frontend assets
│   ├── js/
│   │   ├── app.js
│   │   └── hooks/       # Phoenix LiveView hooks
│   │       ├── draggable_component.js
│   │       └── showcase_room.js    # Three.js scene logic
│   └── css/
├── config/              # Phoenix configuration
├── lib/
│   ├── showcase/        # Business logic
│   │   ├── accounts/    # User authentication
│   │   └── modeling/    # 3D model persistence
│   └── showcase_web/    # Web interface
│       ├── components/
│       ├── controllers/
│       └── live/        # LiveView modules
│           └── showcase_live.ex
├── priv/
│   ├── repo/           # Database migrations
│   └── static/         # Static assets
└── test/               # Test files
```

## Configuration

### Database Configuration

Edit `config/dev.exs` to match your PostgreSQL setup:

```elixir
config :showcase, Showcase.Repo,
  username: "your_db_user",
  password: "your_db_password",
  hostname: "localhost",
  database: "showcase_dev"
```

### Scene Configuration

Default scene settings can be modified in `lib/showcase_web/live/showcase_live.ex`:

```elixir
assign(:scene_config, %{
  background_color: "#1a1a1a",
  grid_visible: true,
  grid_size: 20,
  grid_divisions: 20
})
```

## Development

### Running Tests

```bash
mix test
```

### Code Formatting

```bash
mix format
```

### Building for Production

```bash
# Compile assets
mix assets.deploy

# Create release
MIX_ENV=prod mix release
```

## Tech Stack

- **Backend**: Elixir, Phoenix Framework, Phoenix LiveView
- **Frontend**: Three.js, JavaScript ES6+
- **Database**: PostgreSQL with Ecto
- **CSS**: Tailwind CSS
- **Build Tools**: Webpack (via Phoenix), ESBuild

## Troubleshooting

### Common Issues

1. **"missing hackney dependency" error**
   - This has been fixed in the current version
   - If you encounter it, ensure `{:hackney, "~> 1.9"}` is in your `mix.exs` deps

2. **Database connection errors**
   - Ensure PostgreSQL is running: `sudo service postgresql start`
   - Check your database credentials in `config/dev.exs`

3. **Assets not loading**
   - Run `mix deps.get` and `cd assets && npm install`
   - Ensure watchers are running with `mix phx.server`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Phoenix Framework team for the excellent LiveView technology
- Three.js community for the powerful 3D graphics library
- Contributors and testers who help improve this project