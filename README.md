# Project Exhibition Portal

A comprehensive web application that connects faculty and students for academic project collaborations. This platform allows faculty to propose projects, students to apply for projects, and faculty members to peer-review project proposals.

## Features

### For Students
- Browse approved academic projects from faculty
- Apply to up to 3 projects simultaneously
- Track application status in real-time
- View project details including timeline and available seats
- Mandatory password change on first login

### For Faculty
- **Propose Projects:** Create and submit project proposals for peer review
- **Review Projects:** Review project proposals from faculty in the same research area
- **Manage Applications:** Select or reject student applications for approved projects
- **Equal Review Distribution:** System ensures fair distribution of review workload
- **Feedback System:** Provide detailed feedback when rejecting proposals
- Mandatory password change on first login

### For Admin
- **User Management:** Create student and faculty accounts
- **Account Controls:** Delete or reset user accounts
- **Automated Password Generation:** System generates secure default passwords
- **Privacy Protection:** No access to academic project details or applications

## Live Demo

**Live URL:** [https://project-exhibition-portal.onrender.com](https://project-exhibition-portal.onrender.com)

### Demo Accounts
```
Admin Demo:
Login ID: admin123
Password: admin123

Faculty Demo:
Login ID: FAC001
Password: CompDr.

Student Demo:
Registration Number: 24CSE12345
Password: 01-01-00
```

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (MongoDB Atlas)
- **Authentication:** JWT (JSON Web Tokens)
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Deployment:** Render (Backend & Frontend)
- **Database Hosting:** MongoDB Atlas (Free Tier)

## Prerequisites

- Node.js (v18 or higher)
- MongoDB account (Atlas recommended)
- Git

## Project Workflow

### 1. Admin Setup
- Admin creates student accounts (registration number + DOB-based password)
- Admin creates faculty accounts (login ID + research area-based password)

### 2. First Login Process
- Students/Faculty login with default credentials
- **Mandatory password change** required before accessing features
- New password must be different from default

### 3. Faculty Project Workflow
- **Propose Project:** Faculty creates project with 500-word description
- **Peer Review:** System assigns 5 faculty from same research area for review
- **Review Distribution:** Fair rotation ensures equal workload (max 7 reviews per faculty)
- **Approval Process:** Project approved when 3+ faculty approve
- **Rejection Process:** Any faculty can reject with detailed feedback

### 4. Student Application Workflow
- **Browse Projects:** Students see only approved projects
- **Apply:** Students can apply to maximum 3 projects
- **Selection:** Faculty reviews applications and selects students
- **Seat Management:** Available seats decrease with applications

### 5. Review System Features
- **Research Area Matching:** Only faculty in same area can review projects
- **Equal Distribution:** Systematic assignment prevents overload
- **Feedback Mechanism:** Detailed comments for rejected projects
- **Workload Limits:** Maximum 7 pending reviews per faculty member

## Project Structure

```
project-exhibition-portal/
├── server.js              # Main server file with API routes
├── package.json           # Dependencies and scripts
├── public/
│   └── index.html        # Frontend application
├── README.md             # Project documentation
└── .env                  # Environment variables (create this)
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/change-password` - Change password (mandatory on first login)

### Projects
- `GET /api/projects` - Get all approved projects (students) / all projects (faculty)
- `POST /api/projects` - Create new project proposal (faculty only)
- `GET /api/projects/my` - Get faculty's own projects
- `GET /api/projects/review` - Get projects pending review (faculty only)
- `POST /api/projects/:id/approve` - Approve project after review (faculty only)
- `POST /api/projects/:id/reject` - Reject project with feedback (faculty only)

### Applications
- `POST /api/applications` - Apply to project (students only)
- `GET /api/applications/my` - Get student's applications
- `GET /api/applications/faculty` - Get applications for faculty's projects
- `POST /api/applications/:id/select` - Select student (faculty only)
- `POST /api/applications/:id/reject` - Reject application (faculty only)

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `POST /api/admin/create-user` - Create new user account (admin only)
- `DELETE /api/admin/user/:id` - Delete user account (admin only)
- `POST /api/admin/reset-user/:id` - Reset user account (admin only)

### Utility
- `POST /api/init-demo` - Initialize demo data

## Deployment Guide

### Deploy to Render

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Set up MongoDB Atlas:**
   - Create free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create new cluster (M0 Sandbox - Free)
   - Add database user and get connection string

3. **Deploy on Render:**
   - Connect GitHub repository
   - Set environment variables:
     - `MONGODB_URI`: Your MongoDB Atlas connection string
     - `JWT_SECRET`: A secure random string
     - `NODE_ENV`: production

4. **Initialize Data:**
   - Visit your deployed URL
   - Click "Initialize Demo Data" button

## User Management

### Creating New Users (Admin Dashboard)

The admin can create accounts for both students and faculty through the web interface:

#### Creating Student Accounts:
1. **Login as Admin**
2. **Click "Create New User"**
3. **Select "Student" role**
4. **Required Information:**
   - **Registration Number:** Format YYBBBNNNNN 
     - YY = Year (e.g., 24 for 2024)
     - BBB = Branch code (e.g., BCE, CSE, etc.)
     - NNNNN = 5-digit unique number
     - Example: `24BCE10076`
   - **Full Name:** Student's complete name
   - **Phone Number:** 10-digit contact number
   - **Date of Birth:** Used to generate default password
5. **Default Password:** Automatically generated as DD-MM-YY format from DOB
6. **Password Change:** Student must change password on first login

#### Creating Faculty Accounts:
1. **Login as Admin**
2. **Click "Create New User"**
3. **Select "Faculty" role**
4. **Required Information:**
   - **Login ID:** 6-digit unique identifier (e.g., `FAC001`)
   - **Full Name:** Faculty's complete name
   - **Phone Number:** 10-digit contact number
   - **Area of Research:** Research specialization (used for project review assignments)
5. **Default Password:** Automatically generated as:
   - First 4 letters of area of research + first 3 letters of name (no spaces)
   - Example: "Computer Science" + "Dr. John" = "CompDr."
6. **Password Change:** Faculty must change password on first login

### User Account Management

#### Reset User Account:
- **Deletes all user data** (projects, applications, reviews)
- **Resets password** to default
- **Forces password change** on next login

#### Delete User Account:
- **Permanently removes** user and all associated data
- **Cannot be undone**

### User Roles and Data Access

#### Student Account Data:
- Registration number (unique identifier)
- Name and contact information
- Date of birth (for password generation)
- Applied projects and application status

#### Faculty Account Data:
- Login ID (unique identifier)  
- Name and contact information
- Area of research (for review assignment)
- Proposed projects and review history
- Project review workload tracking

#### Admin Account Access:
- **Can access:** User account information, creation/deletion/reset functions
- **Cannot access:** Project details, applications, review comments, academic content

## 🔐 Security Features

- **JWT Authentication:** Secure token-based authentication
- **Password Hashing:** bcrypt for secure password storage  
- **Role-Based Access Control:** Different permissions for students, faculty, and admin
- **Mandatory Password Changes:** Users must change default passwords on first login
- **Input Validation:** Server-side validation for all inputs
- **Privacy Protection:** Admin cannot access academic project details
- **Review Distribution:** Automated fair assignment of project reviews

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MONGODB_URI environment variable
   - Verify MongoDB Atlas network access (allow 0.0.0.0/0)
   - Confirm database user credentials

2. **JWT Token Errors**
   - Verify JWT_SECRET environment variable
   - Check token format in Authorization header

3. **Application Not Loading**
   - Check server logs for errors
   - Verify all dependencies are installed
   - Ensure PORT environment variable is set

### Debug Mode
Set `NODE_ENV=development` for detailed error logs.

## 📊 Database Schema

### User Schema
- `loginId` (String, unique, required) - Registration number for students, Login ID for faculty
- `password` (String, required, hashed)
- `role` (String, enum: 'student', 'faculty', 'admin')
- `name` (String, required)
- `phoneNumber` (String, required)
- `areaOfResearch` (String) - For faculty only, used for review assignment
- `mustChangePassword` (Boolean, default: true)
- `projectsReviewed` (Number, default: 0) - Track review workload for faculty

### Project Schema
- `title` (String, required)
- `abstract` (String, required, max 500 words)
- `timeline` (String, required)
- `seats` (Number, required, min: 1)
- `seatsAvailable` (Number, required, min: 0)
- `faculty` (ObjectId, ref: 'User')
- `status` (String, enum: 'pending', 'approved', 'rejected')
- `reviewedBy` (Array of ObjectIds) - Faculty who approved the project
- `rejectionComments` (Array) - Feedback from reviewing faculty

### Application Schema
- `student` (ObjectId, ref: 'User')
- `project` (ObjectId, ref: 'Project')
- `status` (String, enum: 'pending', 'selected', 'rejected')
- `cgpa` (Number, optional)
- `skills` (String, optional)
- `appliedAt` (Date, default: now)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Developer

**Diksha** - [GitHub Profile](https://github.com/dikshaaa11)

## Acknowledgments

- Express.js for the web framework
- MongoDB for the database solution
- JWT for authentication
- Render for deployment platform

---

For support or questions, please create an issue in the GitHub repository.
