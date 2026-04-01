# Decont App

Scanner de bonuri cu export Excel pentru deconturi de cheltuieli.

## Stack
- **Next.js 14** (App Router)
- **Gemini Flash 2.5** — OCR și extracție date din bonuri
- **xlsx** — generare Excel formatat
- **Vercel** — hosting recomandat

## Setup

```bash
# 1. Instalează dependențele
npm install

# 2. Configurează cheia API
cp .env.example .env.local
# Editează .env.local și adaugă GEMINI_API_KEY

# 3. Pornește dev server
npm run dev
```

## Obținere cheie Gemini API
1. Du-te la https://aistudio.google.com/apikey
2. Creează un proiect și generează o cheie API
3. Pune cheia în `.env.local`

## Coloanele Excel
| Coloana | Descriere |
|---|---|
| # | Nr. curent |
| Tip document | bon fiscal / factura / chitanta / bilet / altele |
| Nr. document | Numărul bonului/facturii |
| Data document | DD.MM.YYYY |
| Emitent | Firma/magazinul emitent |
| Suma plătită | Suma în moneda originală |
| Monedă | RON, EUR, USD, etc. |
| Curs valutar | 1 pentru RON, altfel cursul BNR |
| Valoare (RON) | Suma convertită automat în RON |
| Plătitor | Persoana care a plătit |
| Explicații | Descrierea cheltuielii |

## Deploy pe Vercel
```bash
# Adaugă GEMINI_API_KEY în Environment Variables pe Vercel
vercel deploy
```

## Faza 2 — Supabase (opțional)
- Stocare bonuri scanate
- Istoric deconturi per utilizator
- Autentificare multi-user
