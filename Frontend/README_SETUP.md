# LawFlow Frontend - Setup & Run Guide

## Prerequisites

Before running the project, ensure you have the following installed:

1. **Node.js** (v16.0.0 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **npm** (v7.0.0 or higher)
   - Comes with Node.js
   - Verify: `npm --version`

---

## Installation Steps

### Step 1: Navigate to Frontend Directory

```bash
cd Frontend
```

### Step 2: Install Dependencies

```bash
npm install
```

This downloads and installs all required packages from the `package.json` file.

**Expected output:**
```
added XXX packages, and audited XXX packages in Xm XXs
```

**If installation fails:**
```bash
npm cache clean --force
rm -r node_modules package-lock.json
npm install
```

---

## Running the Project

### Option 1: Development Mode (Recommended)

Start the development server with hot module replacement:

```bash
npm run dev
```

**What happens:**
- Dev server starts on `http://localhost:5173/`
- Browser may open automatically
- Code changes reload instantly (HMR)
- Full source maps for debugging

**Expected output:**
```
VITE v7.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  press h + enter to show help
```

**Stop the server:**
Press `Ctrl + C` in the terminal

### Option 2: Production Build

Create an optimized build for deployment:

```bash
npm run build
```

**What happens:**
- Compiles TypeScript
- Bundles and minifies code
- Optimizes assets
- Creates `dist/` folder with production files

**Expected output:**
```
✓ built in XXXms
```

### Option 3: Preview Production Build

Test the production build locally:

```bash
npm run preview
```

This serves the production build at `http://localhost:4173/`

### Option 4: Code Quality Check

Check for linting errors:

```bash
npm run lint
```

**What it does:**
- Checks code style
- Identifies potential issues
- Reports ESLint violations

---

## Complete Workflow

**First time setup:**
```bash
cd Frontend
npm install
npm run dev
```

**Before committing code:**
```bash
npm run lint      # Check for errors
npm run build     # Test production build
```

**Production deployment:**
```bash
npm run build
# Deploy the contents of dist/ folder
```

---

## Available Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server (port 5173) |
| `npm run build` | Create production build |
| `npm run preview` | Preview production build (port 4173) |
| `npm run lint` | Check code quality |

---

## Troubleshooting

### Port 5173 Already in Use

If port 5173 is occupied, use a different port:

```bash
npm run dev -- --port 5174
```

Or kill the process using port 5173:
```bash
# Windows (PowerShell)
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5173
kill -9 <PID>
```

### Dependencies Installation Issues

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and lock file
rm -r node_modules package-lock.json

# Reinstall
npm install
```

### TypeScript Compilation Errors

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Fix TypeScript issues according to output
```

### Vite Cache Issues

```bash
# Clear Vite cache
rm -r node_modules/.vite

# Restart dev server
npm run dev
```

### ESLint Errors

```bash
# View all linting issues
npm run lint

# Attempt automatic fixes
npx eslint . --fix
```

---

## Project Structure

```
Frontend/
├── src/
│   ├── main.tsx                 # Application entry point
│   ├── app/
│   │   ├── App.tsx              # Root component
│   │   └── router.tsx           # Route configuration
│   ├── modules/                 # Feature modules
│   │   ├── admin/               # Admin dashboard
│   │   ├── auth/                # Authentication
│   │   ├── client/              # Client features
│   │   ├── lawyer/              # Lawyer features
│   │   ├── registrar/           # Registrar features
│   │   └── marketing/           # Marketing pages
│   ├── shared/                  # Shared resources
│   │   ├── api/                 # API configuration
│   │   ├── components/          # Reusable components
│   │   ├── hooks/               # Custom hooks
│   │   ├── types/               # Type definitions
│   │   └── utils/               # Utility functions
│   ├── types/                   # Global types
│   └── styles/                  # Global styles
├── public/                      # Static assets
├── index.html                   # HTML entry point
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies & scripts
└── eslint.config.js             # ESLint configuration
```

---

## Technology Stack

- **React** 19.2.0
- **TypeScript** 5.9.3
- **Vite** 7.2.4
- **Tailwind CSS** 4.1.18
- **TanStack Router** 1.136.0
- **Zustand** 5.0.1
- **Axios** 1.13.2
- **React Hook Form** 7.52.0
- **TipTap** (Rich text editor)
- **Lucide React** (Icons)
- **Chart.js** (Data visualization)

---

## Environment Variables (if needed)

Create a `.env.local` file in the `Frontend/` directory:

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=LawFlow
```

**Note:** Variables must start with `VITE_` to be exposed to the client.

---

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

---

## Performance Tips

1. **Development mode is slow?**
   - Disable browser extensions
   - Clear browser cache
   - Check available disk space

2. **Build is large?**
   - Check for unused dependencies: `npm outdated`
   - Review bundle size: `npm run build` and check `dist/` folder

3. **Dev server crashes?**
   - Increase Node memory: `NODE_OPTIONS=--max_old_space_size=4096 npm run dev`

---

## Getting Help

If you encounter issues:

1. **Check the troubleshooting section above**
2. **Review official docs:**
   - Vite: https://vite.dev/
   - React: https://react.dev/
   - TypeScript: https://www.typescriptlang.org/docs/

3. **Check VS Code terminal for error messages**

---

## Next Steps After Running

Once the dev server is running at `http://localhost:5173/`:

1. Open the application in your browser



