# Project Exhibition Portal

A comprehensive web application that connects faculty and students for academic project collaborations. This platform allows faculty to propose projects, students to apply for them, and ensures a fair, peer-review process for project proposals among faculty.

## Features

### For Students
- Browse approved academic projects posted by faculty.
- Apply to a maximum of 3 projects.
- View real-time status of applications (Pending, Selected, Rejected).
- Secure login with mandatory password change on first use.

### For Faculty
- **Propose Projects:** Create and submit project proposals with a 500-word limit abstract for peer review.
- **Peer Review System:** Review project proposals from colleagues in the same research area.
- **Manage Applications:** Review student applications and select candidates for your projects.
- **Fair Workload:** The system ensures an equal distribution of review tasks among faculty, with a limit of 7 pending reviews per person.
- **Constructive Feedback:** Provide detailed feedback (up to 500 words) when a project proposal is rejected.

### For Admin
- **User Management:** Create and manage student and faculty accounts.
- **Account Control:** Securely delete or reset user accounts, clearing all associated data (projects, applications).
- **Automated Passwords:** The system generates secure, predictable default passwords for new users.
- **Data Privacy:** Admins manage accounts but have no access to academic content like project details or student applications.

## Live Demo

**Live URL:** [https://project-exhibition-portal.onrender.com](https://project-exhibition-portal.onrender.com)

### Demo Accounts
- **Faculty:**
  - Login ID: `123456`
  - Password: `CompDr.`
- **Student:**
  - Registration Number: `24CSE12345`
  - Password: `010100`
- **Admin:**
  - Login ID: `admin123`
  - Password: `admin123`

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (with Mongoose)
- **Authentication:** JWT (JSON Web Tokens) & bcrypt.js for hashing
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (single-page application)
- **Deployment:** Render (for backend & frontend hosting)

## Project Workflow

### 1. User Account Creation (Admin)
- The Admin creates accounts for all users.
- **Students:** Created with a **Registration Number** (format `YYBBBNNNNN`, e.g., `24BCE10076`) and Date of Birth. The default password is their DOB in `ddmmyy` format.
- **Faculty:** Created with a 6-digit **Login ID** (format `NNNNNN`, e.g., `123456`) and an assigned Area of Research from a predefined list. The default password is the first 4 letters of their research area + the first 3 letters of their name.

### 2. First Login
- All users (students and faculty) log in with their default credentials.
- They are immediately prompted to change their password to ensure account security.

### 3. Faculty Project Cycle
- A faculty member proposes a new project.
- The system automatically assigns the proposal to 5 other faculty members in the same research area for review. The assignment rotates to ensure fair workload distribution.
- A project is **approved** after receiving 3 approvals.
- A project is **rejected** if any reviewer provides feedback for rejection. The proposing faculty can view the feedback and resubmit later.

### 4. Student Application Cycle
- Students can only browse and apply to **approved** projects.
- A student can apply to a maximum of 3 projects.
- Once a faculty member selects a student for a project, that student's other pending applications are automatically rejected.

## Project Structure

```
/
├── server.js           # Express server, API routes, and logic
├── package.json        # Project dependencies and scripts
├── public/
│   └── index.html      # The single-page frontend (HTML, CSS, JS)
└── README.md           # This file
```

## API Endpoints

A brief overview of the core API endpoints.

#### Authentication
- `POST /api/auth/login`: User login.
- `POST /api/auth/change-password`: Securely change the user's password.

#### Admin
- `POST /api/admin/create-user`: Create a new student or faculty user.
- `GET /api/admin/users`: Fetch a list of all users.
- `DELETE /api/admin/user/:id`: Delete a user and all their associated data.
- `POST /api/admin/reset-user/:id`: Reset a user's account data.

#### Projects (Faculty)
- `POST /api/projects`: Propose a new project.
- `GET /api/projects/my`: View your own proposed projects.
- `GET /api/projects/review`: Get projects assigned to you for review.
- `POST /api/projects/:id/approve`: Approve a project.
- `POST /api/projects/:id/reject`: Reject a project with feedback.

#### Applications (Student/Faculty)
- `POST /api/applications`: Student applies to a project.
- `GET /api/applications/my`: Student views their applications.
- `GET /api/applications/faculty`: Faculty views applications for their projects.
- `POST /api/applications/:id/select`: Faculty selects a student.
- `POST /api/applications/:id/reject`: Faculty rejects an application.

## Deployment

This project is configured for easy deployment on platforms like Render.

1.  **Fork and Clone** the repository.
2.  **Set up MongoDB:** Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas) and get your connection string.
3.  **Deploy on Render:**
    - Create a new "Web Service" and connect your GitHub repository.
    - Set the **Build Command** to `npm install`.
    - Set the **Start Command** to `npm start`.
    - Add the following **Environment Variables**:
      - `MONGODB_URI`: Your MongoDB Atlas connection string.
      - `JWT_SECRET`: A long, random, secret string for signing tokens.
4.  **Initialize Data:** After deployment, visit your site and click the "Initialize Demo Data" button to create the demo accounts.
