Card game info can be found under @docs/games

## Tech stack
- **Client**: Vite + React 19 + Tailwind CSS v4
- **Server**: Express + SQLite
- **Tailwind v4**: Configuration is done via CSS `@theme` directives (no `tailwind.config.*`). Custom dark mode variant is defined in `client/src/index.css`: `@custom-variant dark (&:where(.dark, .dark *));`. Theme preference is stored in `localStorage('theme')` and the `.dark` class is toggled on `<html>`.
- **Build**: `npm run build` in `client/` (runs `tsc -b && vite build`)

