<div align="center">

# 🏢 ORA-EMS
### Role-Based Employee Management System

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)


**Developed at Ora-Tech Systems, Pakistan — Full Stack Developer Project (2025)**

[Features](#-features) • [Architecture](#-architecture) • [Tech Stack](#-tech-stack) • [Setup](#-getting-started) • [Roles](#-role-based-access)

</div>

---

## 📖 Overview

ORA-EMS is a production-grade, role-based Employee Management System built with **Next.js 14** (App Router) and **Supabase**. It streamlines HR operations by providing dedicated dashboards for Admins, HR personnel, Managers, and Employees — each scoped to their own responsibilities and data permissions.

The system handles everything from employee onboarding, leave workflows, attendance tracking, payroll management, and productivity scoring to automated absence alerts, meeting logs with commute reimbursement, and real-time company-wide announcements.

---

## ✨ Features

### 👤 Role-Based Authentication
- Supabase Auth with email/password sign-in
- Role detection from `profiles` table on login — automatic redirect to the appropriate dashboard (`/admin`, `/hr`, `/manager`, `/employee`)
- Protected routes with server-side and client-side session checks
- Support for four distinct roles: **Admin**, **HR**, **Manager**, **Employee**

### 🛡️ Admin Dashboard
- Full user and department management — create, update, delete accounts and departments
- Bulk user selection and batch operations
- Company-wide analytics: total employees, admins, managers, departments, and monthly expenses
- Leave request oversight across the entire organization
- System-level settings management

### 👩‍💼 HR Dashboard
- Complete employee directory with profile photos, designations, departments, and reporting manager details
- Add new employees directly from the dashboard with an inline modal form
- Leave request management: approve or reject with mandatory rejection reason
- Attendance overview with today's stats: present, absent, short hours, and total headcount
- Payroll management: view, generate, and update payroll records per employee per month
- Reimbursement tracking: review and manage commute costs logged by employees
- Full attendance history with time-in/time-out and work hours visibility

### 🧑‍💼 Manager Dashboard
- View and manage team members within the manager's assigned department
- Approve or reject leave requests for direct reports with rejection justification
- Access to department-level productivity scores
- Meeting and field-visit log overview for the team

### 👨‍💻 Employee Dashboard
- Personal profile view: name, email, phone, designation, department, and reporting manager
- Leave application form supporting full-day and half-day requests with date range and reason
- Leave history with status tracking (pending / approved / rejected) and rejection reasons
- Personal productivity score display
- Profile photo support via Supabase Storage

### 📅 Attendance Module
- One-click check-in and check-out with automatic timestamp recording
- Work hours calculation per session
- Full attendance history view with date, time-in, time-out, and hours worked
- HR-level view of all employees' attendance records with cross-employee filtering

### 🌿 Leave Management
- Dual leave types: full-day and half-day
- Multi-day leave requests with auto-computed duration
- Status workflow: pending → approved / rejected
- Rejection reason surfaced back to the requesting employee
- HR and Manager approval flows operating independently

### 🤝 Meeting & Field Visit Logs
- Employees log field visits with destination, purpose, and departure time
- Check-in recording on return with automatic commute cost entry
- HR-level view of all meeting logs for reimbursement processing
- Profile photo display alongside each log entry

### 📊 Productivity Tracking
- `productivity_metrics` table stores per-employee scores
- Manager productivity sub-page for team-level reporting (`/manager/productivity`)
- Scores surfaced on both the Employee and Manager dashboards
- Sortable by score in HR overview

### 🔔 Alerts & Announcements
- Admins and HR can broadcast alerts with type classification and message body
- Targeted alerts: send to all employees or a specific individual
- Alerts feed viewable by all staff with sender name and timestamp
- Alert types stored and filterable

### 📧 Automated Email Notifications
- Nodemailer integration with Gmail SMTP for transactional emails
- Automated absence alerts via a secured cron endpoint (`/api/cron/check-absences`)
- Daily cross-check: employees without approved leave and no check-in receive an absence alert
- Leave approval/rejection notifications sent to employees via email
- Cron job secured with a `CRON_SECRET` bearer token

---

## 🏗️ Architecture

```
app/
├── page.tsx                          # Root: session check + role-based redirect
├── layout.tsx                        # Global layout (Geist font, metadata)
├── globals.css                       # Global styles
│
├── auth/
│   └── login/page.tsx                # Login page (Supabase Auth)
│
├── admin/
│   ├── page.tsx                      # Admin dashboard (users, departments, analytics)
│   └── employees/page.tsx            # Admin employee management view
│
├── hr/
│   └── page.tsx                      # HR dashboard (employees, leaves, attendance, payroll)
│
├── manager/
│   ├── page.tsx                      # Manager dashboard (team, leaves)
│   └── productivity/page.tsx         # Team productivity scores
│
├── employee/
│   └── page.tsx                      # Employee dashboard (profile, leaves, productivity)
│
├── attendance/
│   └── page.tsx                      # Attendance check-in/out + history
│
├── leaves/
│   └── page.tsx                      # Leave application + history
│
├── meetings/
│   └── page.tsx                      # Meeting/field visit logs
│
├── alerts/
│   └── page.tsx                      # Company alerts (broadcast + view)
│
└── api/
    ├── auth/route.ts                 # Sign-in endpoint
    ├── alerts/route.ts               # Alert CRUD
    ├── departments/route.js          # Department listing
    ├── email/send/route.ts           # Nodemailer email dispatch (Gmail SMTP)
    ├── leaves/route.ts               # Leave create/approve/reject
    ├── meetings/route.ts             # Meeting log CRUD
    ├── productivity/
    │   ├── route.ts                  # Fetch all productivity scores
    │   └── log/route.ts              # Log productivity entry
    ├── settings/hr-email/route.ts    # HR email settings
    ├── upload-photo/route.js         # Profile photo upload to Supabase Storage
    ├── debug/route.ts                # Debug/health check
    ├── test-auth/route.ts            # Auth test endpoint
    ├── test-gmail/route.ts           # Gmail connectivity test
    └── cron/
        └── check-absences/route.ts  # Scheduled absence detection + alert dispatch
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Database & Auth** | Supabase (PostgreSQL + Row-Level Security) |
| **Email** | Nodemailer + Gmail SMTP |
| **File Storage** | Supabase Storage (profile photos) |
| **Styling** | Inline CSS with CSS-in-JS (`CSSProperties`) + Tailwind CSS |
| **Fonts** | Geist Sans & Geist Mono (Google Fonts) |
| **Scheduling** | Cron-secured Next.js API route |

---

## 🔐 Role-Based Access

| Feature | Admin | HR | Manager | Employee |
|---------|:-----:|:--:|:-------:|:--------:|
| User & department management | ✅ | ❌ | ❌ | ❌ |
| Add/edit employees | ✅ | ✅ | ❌ | ❌ |
| View all employees | ✅ | ✅ | ✅ (own dept) | ❌ |
| Approve/reject leaves | ✅ | ✅ | ✅ (own team) | ❌ |
| Apply for leave | ❌ | ❌ | ❌ | ✅ |
| View own leave history | ✅ | ✅ | ✅ | ✅ |
| Attendance management | ✅ | ✅ | ❌ | ✅ (own) |
| Payroll management | ❌ | ✅ | ❌ | ❌ |
| Reimbursement review | ❌ | ✅ | ❌ | ❌ |
| Send company alerts | ✅ | ✅ | ❌ | ❌ |
| View alerts | ✅ | ✅ | ✅ | ✅ |
| Productivity scores | ✅ | ✅ | ✅ (team) | ✅ (own) |
| Meeting logs | ✅ | ✅ | ✅ | ✅ |
| System settings | ✅ | ❌ | ❌ | ❌ |

---

## 🚀 Getting Started

### Prerequisites
- Node.js `>=18.0.0`
- npm or yarn
- A [Supabase](https://supabase.com) project
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) enabled

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/subhana-web/ems.git
cd ems

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in your values (see Environment Variables section below)

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file in the root directory with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Gmail SMTP (for email notifications)
GMAIL_APP_PASSWORD=your-gmail-app-password

# Cron job security
CRON_SECRET=your-random-secret-string
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose to client) |
| `GMAIL_APP_PASSWORD` | Gmail App Password for Nodemailer SMTP |
| `CRON_SECRET` | Bearer token to secure the `/api/cron/check-absences` endpoint |

### Supabase Schema

The application expects the following tables in your Supabase database:

- `profiles` — user roles (`admin`, `hr`, `manager`, `employee`) linked to Supabase Auth
- `employees` — employee records with personal and employment details
- `departments` — company department directory
- `attendance` — check-in/check-out records with work hours
- `leave_requests` — leave applications with status workflow
- `meeting_logs` — field visit logs with commute costs
- `alerts` — company-wide and targeted announcements
- `productivity_metrics` — per-employee productivity scores
- `payroll` — monthly salary, allowances, deductions, and payment status

> **Tip:** Enable Row-Level Security (RLS) on all tables and define policies that match each role's access scope.

---

## 📡 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth` | POST | Sign in with email and password |
| `/api/alerts` | GET / POST | Fetch or create alerts |
| `/api/departments` | GET | List all departments |
| `/api/email/send` | POST | Send email via Gmail SMTP |
| `/api/leaves` | GET / POST / PATCH | Manage leave requests |
| `/api/meetings` | GET / POST | Manage meeting logs |
| `/api/productivity` | GET | Fetch all productivity scores |
| `/api/productivity/log` | POST | Log a productivity entry |
| `/api/settings/hr-email` | GET / POST | Manage HR email settings |
| `/api/upload-photo` | POST | Upload profile photo to Supabase Storage |
| `/api/cron/check-absences` | GET | Detect absent employees and dispatch email alerts (cron-secured) |

---

## 📂 Key Technical Decisions

**Supabase for Auth + Database** — Supabase provides a unified solution for authentication, a PostgreSQL database, and file storage. Row-Level Security policies are enforced at the database level, ensuring that even if client-side guards are bypassed, data access remains scoped to the authenticated user's role.

**App Router with Layouts** — The Next.js 14 App Router enables per-route loading states, nested layouts, and server components. Client components are used where interactivity and real-time data fetching are required; server-side rendering is used for auth-gated entry points.

**Automated Absence Detection** — The `/api/cron/check-absences` endpoint runs daily (via an external cron scheduler such as Vercel Cron or GitHub Actions). It cross-references the employees table, approved leave records, and attendance check-ins to identify unexplained absences and automatically send email notifications — removing the need for manual HR follow-up.

**Email via Nodemailer** — Rather than a third-party email SaaS, the system uses a Gmail SMTP account with an App Password. This keeps the setup cost-free and simple for organizational deployment while still supporting HTML email templates.

---

## 👩‍💻 About the Developer

Built by **Syeda Subhana Wasim** — Full Stack Developer at Ora-Tech Systems, BS CS Graduate from Rawalpindi Women University (2025).

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/syeda-subhana-wasim-93b6aa26a)
[![Email](https://img.shields.io/badge/Email-EA4335?style=flat&logo=gmail&logoColor=white)](mailto:subhanasyeda009@gmail.com)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/subhana-web)

---

## 📄 Screens
[EMS.Visuals.pdf](https://github.com/user-attachments/files/27550140/EMS.Visuals.pdf)



---

<div align="center">
  <sub>Built with Next.js 💙 | Ora-Tech Systems 2025 | Rawalpindi, Pakistan</sub>
</div>
