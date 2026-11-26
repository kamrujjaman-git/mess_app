# 🏢 Mess App — Modern Mess Management System

A sleek, real-time, full-stack **Mess Management Web Application** built to automate daily meal tracking, mess balance calculations, bazaar expenses, and member management with fine-grained Super Admin & Multi-Admin role-based access control.

---

## ✨ Key Features

🔐 **Role-Based Access Control (RBAC):**
* **Super Admin & Multi-Admin Support:** Multi-level permissions where the Main Admin can grant or revoke admin access dynamically without exposing super-admin privileges.
* **Strict Security Rules:** Secured Firebase Firestore rules preventing unauthorized role escalation or data tampering.

🍽️ **Daily Meal Sheet & Dynamic Tracking:**
* Real-time meal status toggles (Breakfast, Lunch, Dinner) with optimized instant UI updates.
* Automated calculation of Meal Rates, Individual Cost Shares, and Final Refund/Due balances.

📊 **Bazaar, Deposits & PDF Summary:**
* Streamlined entry forms for daily Bazaar expenses and Member Deposits.
* **One-Click PDF Export:** Download complete monthly financial summaries as cleanly formatted PDF reports.

🔄 **Relational Data Integrity:**
* Member deletion atomically removes the member profile and historical meal/deposit references, and unassigns their Bazaar buyer references without deleting the expenses.
* Deletion is rejected without changes if cleanup would exceed Firestore's 500-write transaction limit. Firebase Authentication accounts are not deleted.

📱 **Sleek & Responsive UX/UI:**
* Compact WhatsApp direct-action buttons for quick member communication.
* Snappy UI toast notifications with smart auto-dismissal and close controls.
* Tab state retention across page reloads.
* Responsive dashboard navigation with separate Overview and Summary Table views, a collapsible desktop sidebar, and a mobile navigation drawer.

### Dashboard Navigation Design

The dashboard keeps its existing data subscription and screen components while using URL-backed navigation for Overview, Summary Table, Meals, Bazar & Deposits, and Admin. Existing `tab=meals`, `tab=logs`, and `tab=admin` links remain valid; `tab=summary` continues to open the Summary Table. Log and Admin selections render only the selected view; the legacy `tab=logs` URL opens Bazar Log by default. Admin sidebar items open only the selected form or member-management view and remain protected by the current role checks.

On desktop, the sidebar can collapse from 256px to a 72px icon rail, with the app logo and collapse control at the top and the content offset following its width. Below 768px, navigation moves into a hamburger-triggered slide-over drawer. On desktop and laptop widths, the month selector and header actions share one row; narrower mobile layouts may use a second row. Wide tables scroll within their own panels. Nonessential transitions honor the operating system's reduced-motion preference.

**Design decisions:** Extend the current dashboard shell instead of introducing separate routes or local-only navigation; conditionally render one selected view in the existing log/Admin components; separate cards from the summary table. These choices preserve current workflows and browser navigation while limiting layout and performance risk.

---

## 🛠️ Tech Stack

* **Framework:** [Next.js](https://nextjs.org/) (App Router, Turbopack)
* **Frontend:** [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/)
* **Backend & Database:** [Firebase Firestore](https://firebase.google.com/docs/firestore)
* **Authentication:** [Firebase Auth](https://firebase.google.com/docs/auth)
* **Deployment:** [Vercel](https://vercel.com/)

---

## 🚀 Getting Started

Follow these steps to set up and run the project locally.

### 📋 Prerequisites

Make sure you have installed:
* **Node.js** (>=20.9.0)
* **npm** or **yarn** / **pnpm**
* A **Firebase Project** with Firestore Database and Google Authentication enabled.

---

### ⚙️ Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/kamrujjaman-git/mess_app.git](https://github.com/kamrujjaman-git/mess_app.git)
   cd mess_app

1. Install Dependencies:
npm install
2. Configure Environment Variables:
Create a .env.local file in the root directory and add your Firebase credentials:
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_ADMIN_EMAIL=your-email-id@gmail.com
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
3. Run Development Server:
npm run dev
4. Open in Browser:
Navigate to http://localhost:3000 to view the application in action.

🖼️ Profile Picture Storage
Profile pictures use the configured Firebase Storage bucket. Make sure the Firebase Admin service account used by the API has permission to write Storage objects, then deploy the per-user Storage rules from the repository root:
```bash
firebase deploy --only storage
```
The bucket must be set in `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`. The profile API also requires the Firebase Admin credentials already used by the server-side API routes.
Set `FIREBASE_PROJECT_ID` if it differs from `NEXT_PUBLIC_FIREBASE_PROJECT_ID`; `FIREBASE_STORAGE_BUCKET` can optionally override `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`. Keep Admin credentials server-only and encode private-key line breaks as `\n` when the deployment provider requires a single-line value.
Use Node.js 22.x for local runs and the Vercel project runtime; `firebase-admin` 14 requires Node.js 22 or newer.

🔒 Firestore Security Rules Setup
Before deploying, connect the Firebase CLI to the correct project and confirm `settings/members` has a valid member roster. On the first successful `/api/auth/session` or `/api/auth/claims` sync, the server reconciles `activeEmails` and `adminEmails` from that roster using normalized lowercase emails. A member can trigger the initial backfill by signing in; no manual array edit is needed. The rules also accept active Firebase custom claims during migration.

Deploy the backfilled rules with:
```bash
firebase deploy --only firestore:rules
```

Legacy records without a status are treated as active. Keep the Super Admin email in `firestore.rules` synchronized with `NEXT_PUBLIC_ADMIN_EMAIL`; the configured Super Admin retains access during migration.

📦 Deployment
This project is optimized for deployment on Vercel:

Push your latest code to your GitHub repository.

Connect your GitHub repository to Vercel.

Add all environment variables from .env.local to the Environment Variables section in Vercel.

Click Deploy.

👤 Author & Maintainer
. Kamrujjaman — Developer & Maintainer

. GitHub: github.com/kamrujjaman-git
