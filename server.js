// server.js - Backend API Server
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/project-portal';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Database Schemas
const userSchema = new mongoose.Schema({
  loginId: { type: String, required: true, unique: true }, // Registration number for students, LoginId for faculty
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
  name: { type: String, required: true },
  phoneNumber: { type: String }, // No longer required
  areaOfResearch: { type: String }, // For faculty only
  mustChangePassword: { type: Boolean, default: true }, // Force password change on first login
  projectsReviewed: { type: Number, default: 0 }, // Track review count for faculty
  createdAt: { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  abstract: { type: String, required: true, maxlength: 2500 }, // Corresponds to ~500 words
  timeline: { type: String, required: true },
  seats: { type: Number, required: true, min: 1 },
  seatsAvailable: { type: Number, required: true, min: 0 },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Faculty who reviewed
  rejectionComments: [{ // For rejected projects
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comment: { type: String, maxlength: 2500 }, // Corresponds to ~500 words
    reviewedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const applicationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  status: { type: String, enum: ['pending', 'selected', 'rejected'], default: 'pending' },
  cgpa: { type: Number },
  skills: { type: String },
  appliedAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Application = mongoose.model('Application', applicationSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware for authentication
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Helper function to get next faculty for review
const getNextReviewers = async (areaOfResearch, proposingFacultyId, projectCount) => {
  const facultyInArea = await User.find({ 
    role: 'faculty', 
    areaOfResearch: areaOfResearch,
    _id: { $ne: proposingFacultyId }
  }).sort({ loginId: 1 });

  if (facultyInArea.length < 5) {
    throw new Error('Not enough faculty in this area of research for proper review');
  }

  const startIndex = (projectCount * 5) % facultyInArea.length;
  const reviewers = [];
  
  for (let i = 0; i < 5; i++) {
    const index = (startIndex + i) % facultyInArea.length;
    reviewers.push(facultyInArea[index]);
  }

  return reviewers;
};

// API Routes

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;

    const user = await User.findOne({ loginId });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET);
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        loginId: user.loginId, 
        role: user.role, 
        name: user.name,
        mustChangePassword: user.mustChangePassword
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admin cannot change password through this endpoint' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, req.user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(req.user._id, { 
      password: hashedPassword, 
      mustChangePassword: false 
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Admin Routes
app.post('/api/admin/create-user', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can create users' });
    }

    const { loginId, name, role, areaOfResearch, dateOfBirth } = req.body;

    // --- NEW: Input validation for loginId format ---
    if (role === 'student') {
        const studentRegex = /^\d{2}[A-Z]{3}\d{5}$/;
        if (!studentRegex.test(loginId)) {
            return res.status(400).json({ error: 'Invalid format for Registration Number. Use YYBBBNNNNN.' });
        }
    } else if (role === 'faculty') {
        const facultyRegex = /^\d{6}$/;
        if (!facultyRegex.test(loginId)) {
            return res.status(400).json({ error: 'Invalid format for Login ID. Use 6 digits only.' });
        }
    }
    // --- END NEW ---

    const existingUser = await User.findOne({ loginId });
    if (existingUser) {
      return res.status(400).json({ error: 'Login ID already exists' });
    }

    let defaultPassword;
    if (role === 'student') {
      // --- UPDATED: Password format changed to ddmmyy ---
      const date = new Date(dateOfBirth);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      defaultPassword = `${day}${month}${year}`;
      // --- END UPDATE ---
    } else if (role === 'faculty') {
      const areaPrefix = areaOfResearch.replace(/\s+/g, '').substring(0, 4);
      const namePrefix = name.replace(/\s+/g, '').substring(0, 3);
      defaultPassword = areaPrefix + namePrefix;
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    // --- UPDATED: phoneNumber removed ---
    const userData = {
      loginId,
      password: hashedPassword,
      role,
      name,
      mustChangePassword: true
    };
    // --- END UPDATE ---

    if (role === 'faculty') {
      userData.areaOfResearch = areaOfResearch;
    }

    const user = new User(userData);
    await user.save();

    res.status(201).json({ 
      message: 'User created successfully',
      user: { loginId, name, role, defaultPassword } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can view users' });
    }

    // --- UPDATED: phoneNumber removed from select ---
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('loginId name role areaOfResearch createdAt')
      .sort({ createdAt: -1 });
    // --- END UPDATE ---
      
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.delete('/api/admin/user/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can delete users' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete related data
    if (user.role === 'faculty') {
      await Project.deleteMany({ faculty: user._id });
      await Application.deleteMany({ project: { $in: await Project.find({ faculty: user._id }).distinct('_id') } });
    } else if (user.role === 'student') {
      await Application.deleteMany({ student: user._id });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User and related data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/admin/reset-user/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can reset users' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Reset user data
    if (user.role === 'faculty') {
      await Project.deleteMany({ faculty: user._id });
      await Application.deleteMany({ project: { $in: await Project.find({ faculty: user._id }).distinct('_id') } });
      user.projectsReviewed = 0;
    } else if (user.role === 'student') {
      await Application.deleteMany({ student: user._id });
    }

    user.mustChangePassword = true;
    await user.save();

    res.json({ message: 'User data reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Project Routes
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'student') {
      filter = { status: 'approved' };
    }
    
    const projects = await Project.find(filter)
      .populate('faculty', 'name loginId')
      .sort({ createdAt: -1 });
      
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can create projects' });
    }

    const { title, abstract, timeline, seats } = req.body;
    
    // Updated character limit to better reflect word count
    if (abstract.length > 2500) {
      return res.status(400).json({ error: 'Abstract cannot exceed 500 words (approx. 2500 characters)' });
    }

    // Get count of projects in this area for reviewer assignment
    const projectCount = await Project.countDocuments({ 
      faculty: { $in: await User.find({ areaOfResearch: req.user.areaOfResearch }).distinct('_id') }
    });

    const reviewers = await getNextReviewers(req.user.areaOfResearch, req.user._id, projectCount);
    
    // Check if any reviewer has reached the limit
    const overloadedReviewer = reviewers.find(r => r.projectsReviewed >= 7);
    if (overloadedReviewer) {
      return res.status(400).json({ 
        error: 'Project submission temporarily unavailable. High volume of projects currently under review. Please try again later.' 
      });
    }

    const project = new Project({
      title,
      abstract,
      timeline,
      seats,
      seatsAvailable: seats,
      faculty: req.user._id,
      status: 'pending'
    });

    await project.save();
    
    // Update reviewer counts
    await User.updateMany(
      { _id: { $in: reviewers.map(r => r._id) } },
      { $inc: { projectsReviewed: 1 } }
    );

    await project.populate('faculty', 'name loginId');
    
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.get('/api/projects/my', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can access this endpoint' });
    }

    const projects = await Project.find({ faculty: req.user._id })
      .populate('faculty', 'name loginId')
      .populate('rejectionComments.faculty', 'name loginId')
      .sort({ createdAt: -1 });
      
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.get('/api/projects/review', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can review projects' });
    }

    // Find projects from same area of research, excluding own projects and already reviewed
    const projects = await Project.find({ 
      status: 'pending',
      faculty: { $ne: req.user._id },
      reviewedBy: { $ne: req.user._id }
    })
    .populate({
      path: 'faculty',
      match: { areaOfResearch: req.user.areaOfResearch },
      select: 'name loginId areaOfResearch'
    })
    .sort({ createdAt: 1 });

    // Filter out projects where faculty doesn't match area of research
    const reviewableProjects = projects.filter(project => project.faculty !== null);
      
    res.json(reviewableProjects);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/projects/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can approve projects' });
    }

    const project = await Project.findById(req.params.id).populate('faculty');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.faculty.areaOfResearch !== req.user.areaOfResearch) {
      return res.status(403).json({ error: 'Can only review projects in your area of research' });
    }

    project.reviewedBy.push(req.user._id);
    
    // Check if this is the 3rd approval (majority of 5 reviewers)
    if (project.reviewedBy.length >= 3) {
      project.status = 'approved';
    }
    
    project.updatedAt = new Date();
    await project.save();

    res.json({ message: 'Project review submitted successfully', project });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/projects/:id/reject', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can reject projects' });
    }

    const { comment } = req.body;
    // Updated character limit to better reflect word count
    if (!comment || comment.length > 2500) {
      return res.status(400).json({ error: 'Feedback comment is required and must not exceed 500 words (approx. 2500 characters)' });
    }

    const project = await Project.findById(req.params.id).populate('faculty');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.faculty.areaOfResearch !== req.user.areaOfResearch) {
      return res.status(403).json({ error: 'Can only review projects in your area of research' });
    }

    project.rejectionComments.push({
      faculty: req.user._id,
      comment: comment
    });
    
    project.status = 'rejected';
    project.updatedAt = new Date();
    await project.save();

    // Decrease reviewer count for all assigned reviewers
    await User.updateMany(
      { areaOfResearch: req.user.areaOfResearch, role: 'faculty' },
      { $inc: { projectsReviewed: -1 } }
    );

    res.json({ message: 'Project rejected with feedback', project });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Application Routes
app.post('/api/applications', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can apply to projects' });
    }

    const { projectId, cgpa, skills } = req.body;

    const applicationCount = await Application.countDocuments({ student: req.user._id });
    if (applicationCount >= 3) {
      return res.status(400).json({ error: 'Cannot apply to more than 3 projects' });
    }

    const existingApplication = await Application.findOne({ 
      student: req.user._id, 
      project: projectId 
    });
    if (existingApplication) {
      return res.status(400).json({ error: 'Already applied to this project' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.status !== 'approved') {
      return res.status(400).json({ error: 'Project not approved for applications' });
    }
    if (project.seatsAvailable <= 0) {
      return res.status(400).json({ error: 'No seats available' });
    }

    const application = new Application({
      student: req.user._id,
      project: projectId,
      cgpa,
      skills,
      status: 'pending'
    });

    await application.save();

    project.seatsAvailable -= 1;
    await project.save();

    await application.populate(['student', 'project']);
    res.status(201).json(application);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.get('/api/applications/my', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access this endpoint' });
    }

    const applications = await Application.find({ student: req.user._id })
      .populate('project', 'title abstract timeline')
      .sort({ appliedAt: -1 });
      
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.get('/api/applications/faculty', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can access this endpoint' });
    }

    const applications = await Application.find()
      .populate('student', 'name loginId')
      .populate({
        path: 'project',
        match: { faculty: req.user._id },
        select: 'title'
      })
      .sort({ appliedAt: -1 });

    const facultyApplications = applications.filter(app => app.project !== null);
      
    res.json(facultyApplications);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/applications/:id/select', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can select students' });
    }

    const application = await Application.findById(req.params.id)
      .populate('project')
      .populate('student');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.project.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to select for this project' });
    }

    const existingSelection = await Application.findOne({
      student: application.student._id,
      status: 'selected'
    });
    if (existingSelection) {
      return res.status(400).json({ error: 'Student already selected for another project' });
    }

    application.status = 'selected';
    await application.save();

    await Application.updateMany(
      { student: application.student._id, _id: { $ne: application._id } },
      { status: 'rejected' }
    );

    res.json({ message: 'Student selected successfully', application });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/applications/:id/reject', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can reject applications' });
    }

    const application = await Application.findById(req.params.id)
      .populate('project');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.project.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to reject this application' });
    }

    application.status = 'rejected';
    await application.save();

    const project = await Project.findById(application.project._id);
    project.seatsAvailable += 1;
    await project.save();

    res.json({ message: 'Application rejected successfully', application });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Initialize demo data
app.post('/api/init-demo', async (req, res) => {
  try {
    // Clear existing non-admin users, projects, and applications
    await User.deleteMany({ role: { $ne: 'admin' } });
    await Project.deleteMany({});
    await Application.deleteMany({});
    
    // Create or find admin user
    let adminUser = await User.findOne({ loginId: 'admin123' });
    if (!adminUser) {
        adminUser = new User({
            loginId: 'admin123',
            password: await bcrypt.hash('admin123', 10),
            role: 'admin',
            name: 'System Administrator',
            mustChangePassword: false
        });
        await adminUser.save();
    }

    // Create demo faculty
    const facultyUser = new User({
      loginId: '123456', // 6-digit number
      password: await bcrypt.hash('CompDr.', 10), // First 4 of "Computer Science" + first 3 of "Dr. John"
      role: 'faculty',
      name: 'Dr. John Smith',
      areaOfResearch: 'Computer Science',
      mustChangePassword: true
    });
    await facultyUser.save();

    // Create demo student
    const studentUser = new User({
      loginId: '24CSE12345',
      password: await bcrypt.hash('010100', 10), // Demo DOB format ddmmyy
      role: 'student',
      name: 'Jane Doe',
      mustChangePassword: true
    });
    await studentUser.save();

    res.json({ message: 'Demo data initialized successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
