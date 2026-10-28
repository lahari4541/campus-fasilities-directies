# Campus Facilities Directory

A beginner-friendly full-stack directory that helps college students find campus facilities, locations, opening hours, accessibility information and contact details. The interface is built with plain HTML, CSS and JavaScript; an Express API performs real CRUD operations in Supabase PostgreSQL.

## Features

- Responsive campus-themed interface for phones, tablets and desktops.
- Search by facility name, building, location and description.
- Filter by category and operating status.
- Facility detail view with hours, contact and accessibility details.
- Create, read, update and delete facilities using REST endpoints and Supabase.
- Form validation, loading state, empty state, confirmation before deletion, and readable API errors.
- Write operations protected by a server-side admin key.
- RLS enabled in PostgreSQL; no database secret is shipped to the browser.

## Technology stack

- Frontend: HTML5, CSS3, vanilla JavaScript and Fetch API
- Backend: Node.js, Express.js, CORS, dotenv
- Database: Supabase PostgreSQL via `@supabase/supabase-js`
- Version control: Git and GitHub

## Prerequisites

Install Node.js 18 or later (LTS recommended), npm, Git, and create a Supabase account/project. Internet access is required for Supabase and the optional Google Fonts loaded by the page.

## 1. Create and configure Supabase

1. Create a project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor** in your project.
3. Open `database/schema.sql` from this repository, copy all its contents, paste them into SQL Editor, and run it.
4. The script creates `public.facilities`, constraints, indexes, an updated-at trigger, RLS and a public read-only policy. It also inserts five starter database records so the directory has real rows to display.
5. In **Project Settings → API** (the exact menu label may vary), copy the project URL and the **service_role/secret key** for server-side use only. Never place this key in `frontend/`, commit it, or share it publicly.

The schema intentionally has no public insert/update/delete policy. The Express server uses the service-role key on the server, which bypasses RLS, and checks `ADMIN_API_KEY` before write operations. Protect both secrets and use this as an educational/demo deployment, not as a production multi-user administration system. For production, implement real user authentication, role-based authorization, rate limiting and audit logging.

## 2. Configure the backend environment

Open a terminal in the project directory, then:

```bash
cd backend
```

Copy the example file to `.env`:
- Windows PowerShell: `Copy-Item .env.example .env`
- Windows Command Prompt: `copy .env.example .env`
- macOS/Linux: `cp .env.example .env`

Edit `backend/.env` and set:

```dotenv
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
ADMIN_API_KEY=replace-with-a-long-random-secret
```

Use the actual values from your Supabase project. Choose a long random admin key and keep it private. `.env` is ignored by Git; `.env.example` contains placeholders only.

## 3. Install dependencies

Run these commands **inside the `backend` directory**. The first command installs every declared runtime and development dependency; the additional commands are included for clarity and are not required if `npm install` succeeds.

```bash
npm install
npm install express cors dotenv @supabase/supabase-js ws
npm install --save-dev nodemon
```

## 4. Start the app

From inside `backend/`:

```bash
npm run dev
```

Or use the production-style start script:

```bash
npm start
```

Open **http://localhost:3000** in your browser. Express serves the frontend and API from the same origin, so no separate frontend server is needed. Keep the terminal open while using the app.

If port 3000 is already in use, change `PORT` in `backend/.env` and also update `FRONTEND_ORIGIN` to `http://localhost:YOUR_PORT`.

## 5. Using the directory

- Search with the search box, or use category/status filters.
- Choose **Details** on a card to see all facility information.
- Choose **Manage facilities** to create a new record.
- Use **Edit** on a card to update it.
- Use the `×` button to delete a record after confirmation.
- Write actions require the value of `ADMIN_API_KEY`. The form asks for it when saving; deletion prompts for it. The key is not stored in browser local storage.

## 6. REST API reference

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/health` | API status and whether DB credentials are configured | Public |
| GET | `/facilities` | List facilities; optional `q`, `category`, `status` query params | Public |
| GET | `/facilities/:id` | Read one facility | Public |
| POST | `/facilities` | Create a facility | `x-admin-key` required |
| PATCH | `/facilities/:id` | Update supplied fields | `x-admin-key` required |
| DELETE | `/facilities/:id` | Delete one facility | `x-admin-key` required |

Create/update JSON fields: `name`, `category`, `building`, `location`, `description`, `opening_hours`, `contact`, `accessibility`, `status`. Required on create: `name`, `category`, `building`, `location`, `description`. Category must be one of `Academic`, `Food & Drink`, `Health`, `Sports`, `Student Services`, `Technology`, `Transport`, `Utilities`, `Other`; status must be `Open`, `Closed`, or `Limited`.

### Test the API

After the server starts, visit `http://localhost:3000/api/health` and `http://localhost:3000/api/facilities`. The second endpoint requires working Supabase credentials and the SQL schema to have been applied.

Example read request:

```bash
curl http://localhost:3000/api/facilities
```

Example create request (replace the key and values):

```bash
curl -X POST http://localhost:3000/api/facilities \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_API_KEY" \
  -d "{\"name\":\"Student Help Desk\",\"category\":\"Student Services\",\"building\":\"Admin Block\",\"location\":\"Ground floor\",\"description\":\"Student enquiries and support\",\"status\":\"Open\"}"
```

For PATCH, send only fields to change. DELETE uses `curl -X DELETE` with the same `x-admin-key` header and facility ID. Do not put real secrets in screenshots or shared commands.

## 7. Git and GitHub submission

From the project root (not `backend/`):

```bash
git init
git add .
git status
git commit -m "Build Campus Facilities Directory"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Create an empty repository on GitHub first and replace the placeholder remote URL with your repository URL. Confirm `backend/.env` is not staged or committed.

## 8. Common errors and troubleshooting

- **“Supabase is not configured” / HTTP 503:** make sure `backend/.env` exists and contains the correct `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Restart the server after editing `.env`.
- **“Facilities unavailable” / HTTP 502:** check the terminal for the Supabase error; confirm the SQL schema ran successfully, the table is named `public.facilities`, and the URL/key belong to the same project.
- **Empty list:** confirm the SQL seed inserts ran, or add records with the admin key.
- **401 admin key error:** enter the exact same `ADMIN_API_KEY` value from `backend/.env`; no extra spaces.
- **Write access disabled:** set `ADMIN_API_KEY` in `.env` and restart.
- **`npm` or `node` not recognized:** install Node.js LTS and reopen the terminal.
- **Port in use:** change `PORT` and `FRONTEND_ORIGIN` in `.env`.
- **CORS error when opening the HTML file directly:** do not open `index.html` with `file://`; visit the Express URL at `http://localhost:3000`.
- **Schema/constraint error:** use one of the allowed category/status values and keep text within the limits documented above.
- **Google Fonts unavailable:** the site still works with system fallback fonts.

## 9. Known limitations / remaining setup

- This archive does not include your Supabase credentials. You must create a Supabase project, run the SQL, and configure `backend/.env`.
- Live database connectivity cannot be verified without your project credentials and network access to that project.
- The admin-key gate is a simple classroom/demo protection, not a replacement for authentication. Anyone who knows the admin key can modify directory records. Use a unique key and do not publish it.
- Public facility data is readable by anyone. RLS is enabled; public roles have read access only. The server's service-role key bypasses RLS, so it must remain server-side.
- No file uploads, accounts, or role management are included; these are intentionally out of scope for a three-day beginner project.

## 10. Short demonstration script

“Good morning. Our project is Campus Facilities Directory, a web application that helps students quickly find important places and services on campus. The home page shows the directory and a search tool. I can filter by category or status, and open a facility to see its location, hours, contact and accessibility details. An administrator can add, edit or delete entries using a protected write key. The frontend uses HTML, CSS and JavaScript; the Express backend exposes REST APIs, and Supabase PostgreSQL stores the actual records. This makes campus information easier to find and update.”

## 11. Beginner-friendly viva questions and answers

**1. What is the purpose of this project?**  
It provides one searchable directory of campus facilities and their details.

**2. Why did you use Express.js?**  
Express makes it straightforward to define HTTP routes and build a REST API in Node.js.

**3. What does CRUD mean?**  
Create, Read, Update and Delete — the four basic operations for managing records.

**4. What is Supabase used for?**  
Supabase provides a hosted PostgreSQL database that stores facility records persistently.

**5. Why should the service-role key stay on the backend?**  
It has elevated database permissions and can bypass Row Level Security. Exposing it in browser code would allow attackers to misuse those permissions.
