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

📱 **Sleek & Responsive UX/UI:**
* Compact WhatsApp direct-action buttons for quick member communication.
* Snappy UI toast notifications with smart auto-dismissal and close controls.
* Tab state retention across page reloads.

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
* **Node.js** (v18.x or higher)
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
NEXT_PUBLIC_ADMIN_EMAIL=md.kamrujjaman092@gmail.com
3. Run Development Server:
npm run dev
4. Open in Browser:
Navigate to http://localhost:3000 to view the application in action.

🔒 Firestore Security Rules Setup
To enforce dynamic admin authorization while enabling members to toggle their daily meals safely, paste the following rules into your Firebase Console > Firestore Database > Rules:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isSuperAdmin() {
      return isAuthenticated() && 
        request.auth.token.email.lower() == "md.kamrujjaman092@gmail.com".lower();
    }

    function isAdmin() {
      return isAuthenticated() && (
        isSuperAdmin() ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
    }

    // All authenticated users can read data
    match /{document=**} {
      allow read: if isAuthenticated();
    }

    // Role modification is strictly protected for Super Admin only
    match /users/{userId} {
      allow update: if isSuperAdmin() || (isAdmin() && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']));
      allow create, delete: if isAdmin();
    }

    // Admins can add/edit bazaar and deposit logs
    match /{document=**} {
      allow write: if isAdmin();
    }

    // Authenticated members can manage/toggle their meal entries
    match /{document=**} {
      allow create, update: if isAuthenticated();
    }
  }
}

📦 Deployment
This project is optimized for deployment on Vercel:

Push your latest code to your GitHub repository.

Connect your GitHub repository to Vercel.

Add all environment variables from .env.local to the Environment Variables section in Vercel.

Click Deploy.

👤 Author & Maintainer
Kamrujjaman — Developer & Maintainer

GitHub: @kamrujjaman-git