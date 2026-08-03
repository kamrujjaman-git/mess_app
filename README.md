🏢 Mess Management System

A modern, full-stack, real-time **Mess Management Web Application** designed to streamline daily mess operations, meal tracking, bazar management, and automated balance calculations. Built with high performance, role-based security, and a responsive UI.


✨ Key Features

🔐 Authentication & Role-Based Security:
 * Google Sign-In with strict domain/email authentication.
 * Admin Panel: Full control to add, edit, delete entries, and toggle member active/inactive status.
 * Member View: Clean dashboard access with localized privacy controls.

🍽️ Daily Meal & Bazar Tracking:
 * Real-time entry and updates for daily meals and deposit/bazar costs.
 * Automated meal rate and per-member total balance calculation.

🔒 Privacy Control:
 * Dynamic UI rendering to hide sensitive fixed costs (Rent & Bua bills) from regular members while keeping full visibility for the Admin.

⚡ Route & Tab State Retention:
 * Preserves current page/tab position upon browser reloads without resetting navigation.

📱 Fully Responsive UI:
 * Optimized dashboard layout for Desktop, Tablet, and Mobile devices with customizable profile badges.


🛠️ Tech Stack

Framework: [Next.js](https://nextjs.org/) (App Router, Turbopack)
Frontend: [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/)
Backend & Database: [Firebase Firestore](https://firebase.google.com/docs/firestore)
Authentication: [Firebase Auth](https://firebase.google.com/docs/auth)
Deployment: [Vercel](https://vercel.com/)

🚀 Getting Started

Follow these steps to set up and run the project locally on your machine.

📋 Prerequisites

Make sure you have the following installed:
* [Node.js](https://nodejs.org/) (v18.x or higher)
* `npm` or `yarn` / `pnpm`
* A Firebase Project with Firestore and Google Authentication enabled.


⚙️ Installation & Setup

1. Clone the Repository:
   ```bash
   git clone [https://github.com/kamrujjaman-git/mess_app.git](https://github.com/kamrujjaman-git/mess_app.git)
   cd mess_app

2. Install Dependencies:
  npm install

3. Configure Environment Variables:
* Create a .env.local file in the root    directory and add your Firebase  credentials & Admin configuration:
  NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_ADMIN_EMAIL=your_admin_email@gmail.com

4. Run the Development Server:
* npm run dev

5. Open in Browser:
* Navigate to http://localhost:3000 to view the app in action.

🔒 Firestore Security Rules Setup
* ​To enforce strict role-based data security, paste the following security rules into your Firebase Console under Firestore Database > Rules:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 1. Allow read access to authenticated users
    match /{document=**} {
      allow read: if request.auth != null;
    }
    
    // 2. Allow write access ONLY to the designated Admin email
    match /{document=**} {
      allow write: if request.auth != null && 
        request.auth.token.email.lower() == "your-admin-email@gmail.com".lower();
    }
  }
}

📦 Deployment
​This project is optimized for deployment on Vercel.
​Push your latest code to GitHub.
​Connect your GitHub repository to Vercel.
​Add all the variables from .env.local into the Environment Variables section in Vercel settings.
​Deploy! Next.js will build and serve the application automatically.

​👤 Author
* ​Kamrujjaman — Developer & Maintainer
* GitHub: @kamrujjaman-git
