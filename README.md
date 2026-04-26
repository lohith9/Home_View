# Home3D - Open Source 3D Home Designer

![Home3D Banner](https://via.placeholder.com/1200x400/0B0F1A/7C3AED?text=Home3D+Open+Source+Planner)

Home3D is an open-source, production-grade interior design and floor planning application. Our mission is to democratize high-quality 3D spatial design by providing developers and designers with a powerful, extensible, and free web-based tool. 

Whether you are building a commercial application, learning 3D web technologies, or designing your own home, Home3D gives you the perfect foundation.

## 🚀 Key Features

### 📐 2D Floor Plan Editor
- **Precision Grid System:** Snap-to-grid mechanics (20px increments) for accurate architectural layout.
- **Wall Drawing Engine:** Draw, connect, and reposition walls dynamically with visual snap guides.
- **Drag & Drop Placement:** Intuitive drag-and-drop from the component sidebar directly onto the canvas.
- **Advanced Selection & Manipulation:** Select, multi-select (Shift+Click), move, rotate, and resize objects using dedicated interaction handles.

### 🏠 High-Fidelity 3D Viewport
- **Real-Time 3D Rendering:** Instantaneous synchronization between the 2D plan and 3D space.
- **Direct 3D Interaction:** Select, drag, and reposition furniture directly within the 3D scene without losing your camera angle.
- **Immersive Environment:** Integrated lighting, dynamic soft shadows, and ambient occlusion powered by Three.js.

### 💻 Modern UI/UX
- **Glassmorphism Design:** Modern, sleek interface utilizing translucent panels and a cohesive dark mode aesthetic.
- **Smart Properties Panel:** Context-aware sidebar displaying dimensions, position, rotation, and custom material settings.
- **Global State Management:** Robust Undo/Redo history system and local storage persistence.
- **Keyboard Shortcuts:** Full support for professional workflows (`Delete`/`Backspace` to remove, `Ctrl+Z`/`Ctrl+Y` for history, `Ctrl+D` for duplication).

## 🛠️ Technology Stack

- **Core Framework:** React 18, Vite
- **State Management:** Zustand (unified state across 2D/3D and UI)
- **3D Engine:** Three.js, @react-three/fiber, @react-three/drei
- **Styling:** Tailwind CSS & Vanilla CSS (Glassmorphism & SaaS Design Tokens)
- **Icons:** Lucide React

## 📦 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm, yarn, or pnpm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/lohith9/home3d.git
   cd home3d/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` in your browser.

## 🤝 Contributing

Home3D is an open-source project, and we welcome contributions from the community! Whether it's fixing bugs, adding new 3D models, improving performance, or writing documentation, your help is appreciated.

### How to Contribute
1. **Fork the repository** to your own GitHub account.
2. **Create a new branch** for your feature or bug fix (`git checkout -b feature/amazing-feature`).
3. **Make your changes** and commit them with descriptive messages.
4. **Push your branch** to your fork (`git push origin feature/amazing-feature`).
5. **Open a Pull Request** against the main repository.

### Development Roadmap
- [ ] Export designs to standard 3D formats (GLTF/OBJ).
- [ ] Import custom 3D models dynamically.
- [ ] Implement a room auto-furnishing algorithm.
- [ ] Real-time multiplayer collaboration.

## 🏗️ Architecture Notes
- **Unified Store:** `useDesignStore` acts as the single source of truth for all spatial data, ensuring 2D and 3D views never desync.
- **Event Isolation:** Careful pointer event handling separates camera controls from object interactions, allowing smooth object dragging in the 3D view.
- **History Tracking:** Incremental state snapshots power the robust undo/redo system without blocking the main render thread.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. This means you are free to use, modify, and distribute the software for both personal and commercial projects.
