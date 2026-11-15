# Backend – Phase I.1

## Architekturentscheidung: Supabase als Backend

Der Implementationsplan sah ein eigenes Express-Backend mit PostgreSQL und Prisma vor.
Nach Abgleich mit dem bestehenden Projekt-Stack wurde stattdessen **Supabase** als
Backend-as-a-Service gewählt. Supabase liefert denselben Funktionsumfang, ohne dass
ein eigenständiger Server betrieben werden muss.

### Abdeckung der Plan-Anforderungen durch Supabase

| Plan-Anforderung             | Supabase-Äquivalent                          |
|------------------------------|----------------------------------------------|
| Express-Server               | Supabase REST-API (PostgREST)                |
| PostgreSQL-Datenbank         | Supabase Managed PostgreSQL                  |
| Prisma ORM                   | Supabase JavaScript-Client (`@supabase/supabase-js`) |
| Argon2id-Passwort-Hashing    | Supabase Auth (bcrypt intern, serverseitig)  |
| HttpOnly-Session-Cookies     | Supabase JWT + `pkce`-Flow                   |
| CSRF-Schutz                  | Supabase SameSite-Cookie-Konfiguration       |
| Row-Level Security           | PostgreSQL RLS-Richtlinien (Supabase)        |
| E-Mail-Verifizierung         | Supabase Auth Mailer (konfigurierbar)        |
| Passwort-Reset               | Supabase Auth `resetPasswordForEmail()`      |
| Rate-Limits                  | Supabase Auth Rate-Limiting (konfigurierbar) |

---

## Verzeichnisstruktur (für spätere eigene Backend-Implementierung)

Falls das Projekt zu einem vollständig eigenen Backend migriert werden soll,
ist folgende Struktur vorgesehen:

```
server/
├── index.js                 ← Express-Einstiegspunkt
├── supabase-schema.sql      ← Datenbankschema (Supabase SQL)
├── config/
│   ├── database.js          ← PostgreSQL-Verbindung (Prisma / pg)
│   └── environment.js       ← Umgebungsvariablen
├── routes/
│   ├── authRoutes.js        ← POST /api/auth/register, /login, /logout …
│   └── projectRoutes.js     ← GET/POST/PUT/DELETE /api/projects
├── controllers/
│   ├── AuthController.js
│   └── ProjectController.js
├── services/
│   ├── AuthService.js       ← Argon2id, Session-Management
│   ├── UserService.js
│   └── ProjectService.js    ← optimistisches Locking, JSONB
├── middleware/
│   ├── requireAuth.js       ← Session-Prüfung
│   ├── validateRequest.js   ← Joi/Zod-Validierung
│   └── errorHandler.js      ← Zentrale Fehlerbehandlung
└── validators/
    ├── AuthValidator.js
    └── ProjectValidator.js
```

---

## Konfiguration (Supabase)

Alle Zugangsdaten werden ausschließlich über Umgebungsvariablen konfiguriert.
Sieh `.env.example` im Projektstamm.

```
VITE_SUPABASE_URL      ← Supabase-Projekt-URL
VITE_SUPABASE_ANON_KEY ← Öffentlicher anon-Schlüssel (sicher für Browser)
```

Der `service_role`-Schlüssel darf **niemals** im Frontend verwendet werden.
Er wird ausschließlich für serverseitige Verwaltungsaufgaben (z. B. Benutzer löschen)
über Edge Functions benötigt.

---

## Datenbankschema

Das vollständige SQL-Schema befindet sich in `server/supabase-schema.sql`.
Es muss einmalig im Supabase-SQL-Editor ausgeführt werden.

---

## Deployment

1. Supabase-Projekt unter [supabase.com](https://supabase.com) anlegen.
2. `server/supabase-schema.sql` im SQL-Editor ausführen.
3. Auth-Einstellungen konfigurieren (E-Mail-Templates, SMTP, Rate-Limits).
4. `.env` mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` befüllen.
5. Frontend bauen: `npm run build`.
6. `dist/` auf einem Hosting-Dienst (Netlify, Vercel, Cloudflare Pages …) deployen.
