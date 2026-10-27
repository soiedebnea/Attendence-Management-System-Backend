# Attendance Management System: Backend

REST API for the Attendance Management System, built with **Node.js, Express and MongoDB (Mongoose)**. It handles sign-in, students, daily attendance, and reports.

The web app that uses this API is in the separate `attendance-frontend` project.

## Features
- JWT login with two roles: `admin` and `teacher`
- Student management (add, edit, search, delete)
- Mark attendance for a whole class in one request (Present, Absent, Late, Excused, with notes)
- Reports: daily summary, per-student attendance percentage, absence log, CSV export

## Requirements
- Node.js 18 or newer
- MongoDB, either installed locally or a free MongoDB Atlas cluster

## Folder structure
```
attendance-backend/
├── .env                  # your settings (create from .env.example, never commit)
├── .env.example
├── package.json
├── server.js             # entry point
├── config/
│   └── db.js             # MongoDB connection
├── models/
│   ├── User.js
│   ├── Student.js
│   └── Attendance.js
├── middleware/
│   └── auth.js           # JWT check, admin-only guard
└── routes/
    ├── auth.js
    ├── students.js
    ├── attendance.js
    └── reports.js
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a file named `.env` in this folder (copy `.env.example`) and fill in:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/attendance_db
   JWT_SECRET=replace_this_with_a_long_random_string
   CLIENT_URL=http://localhost:5173
   ```
3. Make sure MongoDB is running (see below).
4. Start the server:
   ```bash
   npm run dev     # auto-restarts on changes (nodemon)
   npm start       # plain start
   ```

You should see:
```
MongoDB connected
API running on http://localhost:5000
```
Check it at `http://localhost:5000/api/health`, which should return `{"ok":true}`.

### Environment variables
| Variable | Description |
|---|---|
| `PORT` | Port the API listens on (default 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `CLIENT_URL` | Frontend address allowed by CORS (default `http://localhost:5173`) |

Generate a strong secret with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### MongoDB options
- **Local (Windows):** start the service with `net start MongoDB`.
- **MongoDB Atlas:** create a free cluster, add a database user, allow your IP under Network Access, then use its connection string:
  ```env
  MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/attendance_db?retryWrites=true&w=majority
  ```

## First login
The first account created through `POST /api/auth/register` becomes the **admin**. The frontend does this for you on its first screen. After that, only an admin can create more users.

## Data model
- **users**: name, email, password (hashed), role (`admin` or `teacher`)
- **students**: name, rollNo, className, guardianPhone (roll number is unique within a class)
- **attendances**: student, date (`YYYY-MM-DD`), status (`present`, `absent`, `late`, `excused`), note, markedBy

There is one attendance record per student per day. Saving a date again updates the earlier records.

## API reference
All routes except the auth ones need the header `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Server check |
| GET | `/api/auth/setup-status` | Whether the first admin still needs to be created |
| POST | `/api/auth/register` | Create the first admin, or (admin only) add a user |
| POST | `/api/auth/login` | Sign in, returns a token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/students?className=&search=` | List students |
| GET | `/api/students/classes` | List class names |
| POST | `/api/students` | Add a student |
| PUT | `/api/students/:id` | Edit a student |
| DELETE | `/api/students/:id` | Delete a student and their history (admin only) |
| GET | `/api/attendance?date=&className=` | Attendance records for one day |
| POST | `/api/attendance/bulk` | Save a class: `{ "date": "2026-10-25", "records": [{ "student": "<id>", "status": "absent", "note": "" }] }` |
| GET | `/api/attendance/student/:id?from=&to=` | One student's history |
| GET | `/api/reports/daily?date=` | Counts for a day and the absentee list |
| GET | `/api/reports/summary?from=&to=&className=` | Per-student totals and attendance percentage |
| GET | `/api/reports/absences?from=&to=&className=` | Every absence in the range |
| GET | `/api/reports/export.csv?from=&to=&className=` | Summary as a CSV download |

Attendance percentage is (present + late) divided by total marked days. To change this rule, edit `routes/reports.js`.

## Troubleshooting
| Problem | Fix |
|---|---|
| `Cannot find module '../models/Attendance'` | A file name is misspelled or has the wrong case. File names must match exactly: `Attendance.js`, `Student.js`, `User.js`, and `attendance.js` in `routes`. This matters on Linux servers even if Windows tolerates it. |
| `MongoDB connection failed ... ECONNREFUSED` | MongoDB isn't running. Start it, or use Atlas. |
| `uri ... got "undefined"` or `secretOrPrivateKey must have a value` | `.env` is missing, misnamed (for example `.env.txt`), or not in the same folder as `server.js`. |
| `EADDRINUSE ... 5000` | Port is taken. Change `PORT` here and `VITE_API_URL` in the frontend. |
| `Cannot find module 'express'` | Run `npm install`. |
| Browser shows a CORS error | `CLIENT_URL` must match the exact address of the frontend. |

After editing `.env`, restart the server. With nodemon you can type `rs` and press Enter.

## Security notes
- Never commit `.env` to Git. Add `.env` and `node_modules/` to `.gitignore`.
- Use a long random `JWT_SECRET` and a strong admin password in real use.
- Back up the MongoDB database regularly.
