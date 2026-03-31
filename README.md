# Manga Studio

Manga Studio is a desktop manga translation editor built with Electron, React, and a Python OCR backend.

## What is intentionally omitted from this public repository

- Private `.env` values
- Bundled `python-embed` runtime
- Downloaded/packaged backend models
- Protected build pipeline and internal obfuscation tooling
- Generated build artifacts and runtime caches

## Development

```bash
npm install
npm run dev
```

In another terminal:

```bash
npm run electron
```

## Environment

Copy `.env.example` to `.env` and fill in your own public Supabase values.

## Notes

This public repository contains the source code only. If you want to package the app with a bundled Python runtime or backend models, add those assets locally before building.
