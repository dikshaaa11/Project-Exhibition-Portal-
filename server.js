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
  loginId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
  name: { type: String, required: true },
  areaOfResearch: { type: String }, 
  mustChangePassword: { type: Boolean, default: true },
  projectsReviewed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// FINAL projectSchema with detailed review tracking
const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  abstract: { type: String, required: true, maxlength: 2500 },
  timeline: { type: String, required: true },
  seats: { type: Number, required: true, min: 1 },
  seatsAvailable: { type: Number, required: true, min: 0 },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  assignedReviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reviews: [{
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decision: { type: String, enum: ['approved', 'rejected'], required: true },
    comment: { type: String, maxlength: 2500 },
    reviewedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const applicationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  status: { type: String, enum: ['pending', 'selected', 'rejected'], default: 'pending' },
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
    
    // Robust save method
    const userToUpdate = await User.findById(req.user._id);
    userToUpdate.password = hashedPassword;
    userToUpdate.mustChangePassword = false;
    await userToUpdate.save();

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
    if (role === 'student' && !/^\d{2}[A-Z]{3}\d{5}$/.test(loginId)) {
        return res.status(400).json({ error: 'Invalid format for Registration Number. Use YYBBBNNNNN.' });
    }
    if (role === 'faculty' && !/^\d{6}$/.test(loginId)) {
        return res.status(400).json({ error: 'Invalid format for Login ID. Use 6 digits only.' });
    }
    const existingUser = await User.findOne({ loginId });
    if (existingUser) {
      return res.status(400).json({ error: 'Login ID already exists' });
    }
    let defaultPassword;
    if (role === 'student') {
      const date = new Date(dateOfBirth);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      defaultPassword = `${day}${month}${year}`;
    } else if (role === 'faculty') {
      const areaPrefix = areaOfResearch.replace(/\s+/g, '').substring(0, 4);
      const namePrefix = name.replace(/\s+/g, '').substring(0, 3);
      defaultPassword = areaPrefix + namePrefix;
    }
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const userData = {
      loginId,
      password: hashedPassword,
      role,
      name,
      mustChangePassword: true
    };
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
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('loginId name role areaOfResearch createdAt')
      .sort({ createdAt: -1 });
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
    if (user.role === 'faculty') {
      await Project.deleteMany({ faculty: user._id });
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
    if (user.role === 'faculty') {
      await Project.deleteMany({ faculty: user._id });
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
    if (abstract.length > 2500) {
      return res.status(400).json({ error: 'Abstract cannot exceed 500 words (approx. 2500 characters)' });
    }
    const projectCount = await Project.countDocuments({
      faculty: { $in: await User.find({ areaOfResearch: req.user.areaOfResearch }).distinct('_id') }
    });
    const reviewers = await getNextReviewers(req.user.areaOfResearch, req.user._id, projectCount);
    const overloadedReviewer = reviewers.find(r => r.projectsReviewed >= 7);
    if (overloadedReviewer) {
      return res.status(400).json({ error: 'Project submission temporarily unavailable. High volume of projects currently under review.' });
    }
    const project = new Project({
      title,
      abstract,
      timeline,
      seats,
      seatsAvailable: seats,
      faculty: req.user._id,
      status: 'pending',
      assignedReviewers: reviewers.map(r => r._id)
    });
    await project.save();
    await User.updateMany({ _id: { $in: reviewers.map(r => r._id) } }, { $inc: { projectsReviewed: 1 } });
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
      .populate('reviews.faculty', 'name loginId')
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
    const projects = await Project.find({
      status: 'pending',
      assignedReviewers: req.user._id,
      'reviews.faculty': { $ne: req.user._id }
    })
    .populate('faculty', 'name loginId areaOfResearch')
    .sort({ createdAt: 1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

async function processFinalReview(project) {
  if (project.reviews.length === project.assignedReviewers.length) {
    const hasRejection = project.reviews.some(review => review.decision === 'rejected');
    project.status = hasRejection ? 'rejected' : 'approved';
    await User.updateMany(
        { _id: { $in: project.assignedReviewers } },
        { $inc: { projectsReviewed: -1 } }
    );
  }
  await project.save();
}

app.post('/api/projects/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can approve projects' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project.reviews.push({ faculty: req.user._id, decision: 'approved' });
    await processFinalReview(project);
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
    if (!comment || comment.length > 2500) {
      return res.status(400).json({ error: 'Feedback comment is required and must not exceed 500 words.' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project.reviews.push({ faculty: req.user._id, decision: 'rejected', comment: comment });
    await processFinalReview(project);
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
    const { projectId } = req.body;
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
    if (!project || project.status !== 'approved' || project.seatsAvailable <= 0) {
      return res.status(400).json({ error: 'Cannot apply to this project at this time.' });
    }
    const application = new Application({
      student: req.user._id,
      project: projectId,
      status: 'pending'
    });
    await application.save();
    project.seatsAvailable -= 1;
    await project.save();
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
    const projects = await Project.find({ faculty: req.user._id }).select('_id');
    const projectIds = projects.map(p => p._id);
    const applications = await Application.find({ project: { $in: projectIds } })
      .populate('student', 'name loginId')
      .populate('project', 'title')
      .sort({ appliedAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/applications/:id/select', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can select students' });
    }
    const application = await Application.findById(req.params.id).populate('project');
    if (!application || application.project.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized for this application' });
    }
    const existingSelection = await Application.findOne({
      student: application.student,
      status: 'selected'
    });
    if (existingSelection) {
      return res.status(400).json({ error: 'Student already selected for another project' });
    }
    application.status = 'selected';
    await application.save();
    await Application.updateMany(
      { student: application.student, _id: { $ne: application._id } },
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
    const application = await Application.findById(req.params.id).populate('project');
    if (!application || application.project.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized for this application' });
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
    await User.deleteMany({ role: { $ne: 'admin' } });
    await Project.deleteMany({});
    await Application.deleteMany({});
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
    const facultyUser = new User({
      loginId: '123456',
      password: await bcrypt.hash('CompDr.', 10),
      role: 'faculty',
      name: 'Dr. John Smith',
      areaOfResearch: 'Computer Science',
      mustChangePassword: true
    });
    await facultyUser.save();
    const studentUser = new User({
      loginId: '24CSE12345',
      password: await bcrypt.hash('010100', 10),
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
