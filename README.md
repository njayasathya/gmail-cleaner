# 🧹 Gmail Cleaner (Dockerized)

A modern, desktop-grade Gmail cleaner and newsletter unsubscribe engine packaged into a lightweight Docker container. Free up gigabytes of Google storage, mass-delete or archive emails by sender, and unsubscribe from newsletters with RFC 8058 one-click automation.

![Gmail Cleaner Dashboard](https://images.unsplash.com/photo-1557200134-90327ee9fafa?auto=format&fit=crop&w=1200&q=80)

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| **1-Click Bulk Unsubscribe** | Automatically detects `List-Unsubscribe` headers and dispatches **RFC 8058 One-Click HTTP POST**, automated `mailto:` emails, or direct URLs. |
| **Delete by Sender** | Visualizes who fills your inbox the most; bulk trash or permanently delete thousands of messages grouped by sender. |
| **Bulk Multi-Sender Cleaner** | Select multiple senders at once and perform batch operations simultaneously with real-time SSE progress tracking. |
| **Bulk Mark as Read** | Instantly mark thousands of unread promotional and notification emails as read. |
| **Archive Emails** | Clean your inbox without deleting messages by stripping the `INBOX` label in bulk. |
| **Label Management** | Create custom Gmail labels and bulk-assign or remove them across selected senders. |
| **Mark / Unmark Important** | Bulk-flag high-priority senders or strip the `IMPORTANT` badge from noisy senders. |
| **Email Metadata CSV Export** | Export email metadata (Sender, Subject, Size, Date, Labels, Snippet) as a CSV report. |
| **Smart Filters & Cleanup Recipes** | Visual query builder for date ranges (`older_than:90d`), file size thresholds (`larger:10M`), and categories (`Promotions`, `Social`, `Updates`, `Forums`). |
| **Persistent Local Storage** | Scanned sender metadata and OAuth tokens are cached locally in SQLite on a Docker volume so your inbox loads instantly. |

---

## 🚀 Quick Start with Docker

### 1. Clone & Configure
```bash
git clone https://github.com/your-username/gmail-cleaner.git
cd gmail-cleaner
cp .env.example .env
```

### 2. Launch with Docker Compose
```bash
docker compose up -d
```

Open your browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 🔑 Google Cloud OAuth Setup (5-Minute Guide)

To connect Gmail, create a free OAuth client in the [Google Cloud Console](https://console.cloud.google.com/):

1. **Create a Project:**
   * Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project (e.g., `Gmail-Cleaner`).
2. **Enable the Gmail API:**
   * Navigate to **APIs & Services > Library**.
   * Search for **Gmail API** and click **Enable**.
3. **Configure OAuth Consent Screen:**
   * Navigate to **APIs & Services > OAuth consent screen**.
   * Choose **External** and fill in the required app name and support email.
   * Under **Scopes**, add `https://mail.google.com/`.
   * Under **Test Users**, add your personal Gmail address.
4. **Create OAuth Client ID Credentials:**
   * Navigate to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   * Select **Web application**.
   * Under **Authorized redirect URIs**, add:
     ```text
     http://localhost:8000/api/auth/callback
     ```
5. **Connect in App:**
   * Copy the generated **Client ID** and **Client Secret**.
   * In the Gmail Cleaner web UI, open **Settings** (gear icon) and paste them, or add them to your `.env` file:
     ```env
     GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=your-client-secret
     ```
   * Click **Connect Gmail** and approve the permissions.

> 💡 **Demo / Preview Mode:** Want to test the user interface immediately before setting up Google Cloud? Open the Settings modal and click **Seed Demo Data** to populate realistic sender analytics and newsletter records!

---

## 💻 Local Development Setup (Without Docker)

You can also run both the backend and frontend directly on your local machine:

### Backend (Python FastAPI)
```bash
# In the root directory
python -m venv backend/.venv

# Windows
backend\.venv\Scripts\activate
# macOS/Linux
source backend/.venv/bin/activate

pip install -r backend/requirements.txt
python backend/run.py
```
*Backend API will run at `http://localhost:8000` (docs at `http://localhost:8000/docs`).*

### Frontend (React + Vite + Tailwind CSS)
```bash
cd frontend
npm install
npm run dev
```
*Frontend dev server will run at `http://localhost:5173` with proxying to port 8000.*

---

## 🔒 Security & Privacy

* **100% Self-Hosted & Local:** All email scanning, token storage, and batch actions run entirely inside your own Docker container.
* **No Third-Party Servers:** Your emails and credentials never leave your local environment.
* **Safe vs Permanent Actions:** The default delete action moves messages to Gmail's **Trash** (giving you 30 days to recover them). Permanent deletion (`batchDelete`) requires explicit confirmation.

---

## 🛠️ Architecture

* **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons.
* **Backend:** FastAPI (Python 3.11), SQLAlchemy 2 (asyncio), SQLite via aiosqlite, SSE-Starlette.
* **Google Integration:** Asynchronous batch HTTP requests to the Gmail REST API v1.
