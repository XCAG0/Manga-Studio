# Setup Guide

## 1. Install frontend dependencies

```bash
npm install
```

## 2. Configure environment

Copy `.env.example` to `.env` and set your own public Supabase values.

## 3. Install backend dependencies

On Windows, run:

```bat
manga-backend\installer.bat
```

This creates a local virtual environment in `manga-backend\.venv` and installs the Python packages required by the backend.

## 4. Start the app

```bash
npm run electron
```

## Notes

- The dev server now uses `--strictPort`, so it requires port `5173` to be free.
- If the backend says Python modules are missing, rerun `manga-backend\installer.bat`.
- The public repository does not include `python-embed` or bundled AI models. Those must be added locally if you want a packaged build with embedded runtimes.
