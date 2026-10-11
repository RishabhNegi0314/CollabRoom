# Collabroom — Collaborative Coding Workspace

**Code together. Collaborate in real time. Build faster.**

Collabroom is a full-stack, AI-powered collaborative coding workspace designed to help developers write, execute, and manage code together in real time. It combines live code synchronization, workspace management, version control, multi-language code execution, and AI assistance in a unified development environment.

The platform is designed to support up to **20 concurrent users**, making collaborative programming and team-based development more accessible.

## ✨ Key Features

* **Real-Time Collaboration** — Multiple users can work in a shared coding workspace with synchronized code updates.
* **Multi-User Workspaces** — Create and manage collaborative coding sessions for team development.
* **Live Code Synchronization** — Socket.IO enables real-time, bidirectional communication between connected users.
* **Integrated Code Editor** — Write and edit code in an interactive development environment.
* **Multi-Language Code Execution** — Compile and execute code in four supported programming languages.
* **Live HTML/CSS Preview** — Preview web development changes directly within the workspace.
* **Version Control** — Save and retrieve previous code versions to help manage changes.
* **AI Assistant** — Get AI-powered assistance while working on coding tasks.
* **Persistent Storage** — Firebase and Firestore support persistent workspace and project data.
* **Responsive Interface** — A React-based interface designed for a smooth development experience.

## 🛠️ Tech Stack

| Technology              | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| React.js                | Frontend user interface                          |
| JavaScript              | Application logic                                |
| Node.js                 | Backend runtime                                  |
| Express.js              | Backend server and REST APIs                     |
| Socket.IO               | Real-time communication and code synchronization |
| Firebase Authentication | User authentication                              |
| Cloud Firestore         | Persistent workspace and project data            |
| Firebase Hosting        | Frontend deployment                              |
| Git & GitHub            | Version control and source-code management       |

## 🏗️ System Architecture

Collabroom follows a client-server architecture that combines real-time communication with persistent cloud storage.

```text
                 ┌────────────────────────┐
                 │     React Frontend     │
                 │   Code Editor & UI     │
                 └───────────┬────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
       ┌────────▼────────┐      ┌─────────▼────────┐
       │   Socket.IO     │      │   REST APIs      │
       │ Real-Time Events│      │ Express + Node.js│
       └────────┬────────┘      └─────────┬────────┘
                │                         │
                └────────────┬────────────┘
                             │
                   ┌─────────▼─────────┐
                   │ Firebase /        │
                   │ Cloud Firestore   │
                   └───────────────────┘
```

### How It Works

1. Users access the coding workspace through the React frontend.
2. Socket.IO facilitates real-time communication and broadcasts editing events to connected collaborators.
3. Express.js REST APIs handle supported backend operations.
4. Firebase Authentication manages user sign-in, while Firestore stores persistent workspace and project data.
5. The code execution feature runs supported programming languages, and the HTML/CSS preview helps developers inspect web output.

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

* Node.js and npm
* Git
* A Firebase project with the required services configured

### 1. Clone the Repository

```bash
git clone https://github.com/RishabhNegi0314/Project_Brain.git
cd Project_Brain
```

### 2. Install Dependencies

```bash
npm install
```

If the frontend and backend use separate package manifests, install dependencies in each respective directory as well.

### 3. Configure Environment Variables

Create a `.env` file using the environment variable names required by the application.

Example:

```env
PORT=3000

# Add your Firebase configuration
# Add any required AI or code-execution API credentials
```

Use the actual variable names expected by your source code. Never commit private API keys, service-account credentials, or other secrets to GitHub.

### 4. Start the Application

Use the scripts defined in your `package.json`.

For example, if the project provides these scripts:

```bash
npm run dev
```

Start the backend separately if it has its own development command.

**Note:** The exact startup commands and environment variables depend on the repository's current configuration.

## ☁️ Deployment

Collabroom uses Firebase Hosting for frontend deployment.

After configuring Firebase and creating a production build, deploy with:

```bash
npm run build
firebase deploy --only hosting
```

Ensure Firebase Hosting is configured to serve the generated frontend build directory. If the backend runs separately, deploy it to an appropriate backend hosting service and configure the frontend to use its API URL.

## 🔐 Security Considerations

* Keep API keys and service-account credentials out of source control.
* Use Firebase Security Rules to restrict access to authorized workspace data.
* Validate backend requests and user permissions.
* Apply appropriate execution limits and isolation to code execution features.
* Avoid exposing sensitive environment variables in frontend builds.

## 🎯 Project Goals

Collabroom aims to simplify collaborative programming by bringing real-time editing, project organization, code execution, version management, and AI assistance into one workspace.

The project explores full-stack application development, event-driven communication, cloud data persistence, and collaborative software engineering.

## 👨‍💻 Author

**Rishabh Negi**

* GitHub: [@RishabhNegi0314](https://github.com/RishabhNegi0314)
* LinkedIn: [Rishabh Negi](https://linkedin.com/in/rishabh-negi-209a38289)

---

*Built to make collaborative coding simpler, faster, and more accessible.*
