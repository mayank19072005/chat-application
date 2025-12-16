const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require('method-override');
const Chat = require('./models/chat.js');
const Admin = require('./models/admin.js');

const app = express();
const port = process.env.PORT || 8080;

// Connect to MongoDB first
mongoose.connect('mongodb+srv://anviijha60:Mongodb123@cluster0.rqhm7wl.mongodb.net/chatt')
    .then(() => {
        console.log("Connected to the database");
        // Create default admin user if it doesn't exist
        createDefaultAdmin();
    })
    .catch(err => {
        console.error("Database connection error:", err);
    });

// Create default admin user
async function createDefaultAdmin() {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const defaultAdmin = new Admin({
                username: 'admin',
                password: 'admin'
            });
            await defaultAdmin.save();
            console.log('Default admin user created');
        }
    } catch (err) {
        console.error('Error creating default admin:', err);
    }
}

// Configure middleware
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// Session management for admin
const session = {};

// Add token to all adminDashboard renders
app.use((req, res, next) => {
    // Save the original render function
    const originalRender = res.render;
    
    // Override the render function
    res.render = function(view, options, callback) {
        // If it's the admin dashboard view, make sure to include req for token access
        if (view === 'adminDashboard.ejs') {
            options = options || {};
            options.req = req;
        }
        
        // Call the original render function
        originalRender.call(this, view, options, callback);
    };
    
    next();
});

// Simple authentication middleware
const isAuthenticated = (req, res, next) => {
    const sessionToken = req.query.token || '';
    if (session[sessionToken]) {
        req.admin = session[sessionToken];
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// Check if user is admin for edit/delete permissions
const checkAdminForAction = (req, res, next) => {
    const sessionToken = req.query.token || '';
    if (session[sessionToken]) {
        next();
    } else {
        res.status(403).render('error.ejs', { error: 'You do not have permission to perform this action' });
    }
};

// Home route redirect to chats
app.get('/', (req, res) => {
    res.redirect('/chats');
});

// ADMIN ROUTES
// Admin login page
app.get('/admin/login', (req, res) => {
    res.render('adminLogin.ejs', { error: null });
});

// Admin login process
app.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find admin user
        const admin = await Admin.findOne({ username });
        
        if (admin && admin.password === password) {
            // Create session
            const sessionToken = Date.now().toString();
            session[sessionToken] = { username };
            
            // Redirect to admin dashboard
            res.redirect(`/admin/dashboard?token=${sessionToken}`);
        } else {
            res.render('adminLogin.ejs', { error: 'Invalid username or password' });
        }
    } catch (err) {
        console.error(err);
        res.render('adminLogin.ejs', { error: 'Login failed' });
    }
});

// Admin dashboard
app.get('/admin/dashboard', isAuthenticated, async (req, res) => {
    try {
        // Get all messages for admin view
        const messages = await Chat.find().sort({ create_to: -1 });
        res.render('adminDashboard.ejs', { messages });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.ejs', { error: 'Failed to load dashboard' });
    }
});

// Admin add message
app.post('/admin/messages', isAuthenticated, async (req, res) => {
    try {
        const { from, to, message } = req.body;
        
        // Validate required fields
        if (!from || !to || !message) {
            return res.status(400).send('All fields are required');
        }
        
        const chat = new Chat({
            from,
            to,
            message,
            create_to: new Date(),
            isAdmin: true,
            completed: false
        });
        
        await chat.save();
        res.redirect(`/admin/dashboard?token=${req.query.token}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to save message');
    }
});

// Admin logout
app.post('/admin/logout', (req, res) => {
    const sessionToken = req.query.token;
    if (sessionToken && session[sessionToken]) {
        delete session[sessionToken];
    }
    res.redirect('/chats');
});

// CHAT ROUTES
// Toggle message completion status
app.post('/chats/:id/toggle-completed', async (req, res) => {
    try {
        const { id } = req.params;
        const chat = await Chat.findById(id);
        
        if (!chat) {
            return res.status(404).send('Message not found');
        }
        
        // Only allow toggling admin messages
        if (chat.isAdmin) {
            // Toggle completed status
            chat.completed = !chat.completed;
            await chat.save();
        }
        
        // Redirect back to referring URL or default to chats list
        const referer = req.headers.referer || '/chats';
        
        // Preserve admin token if present
        if (req.query.token && referer.includes('admin')) {
            return res.redirect(`${referer.split('?')[0]}?token=${req.query.token}`);
        }
        
        res.redirect(referer);
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to update message status');
    }
});

// Index - Show all chats
app.get('/chats', async (req, res) => {
    try {
        // Check if admin is logged in
        const token = req.query.token || '';
        const isAdmin = !!session[token];

        let chats = await Chat.find().sort({ create_to: -1 });
        res.render('index.ejs', { 
            chats,
            isAdmin,
            token
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.ejs', { error: 'Failed to load chats' });
    }
});

// Search - Find chats by search term
app.get('/chats/search', async (req, res) => {
    try {
        const searchQuery = req.query.q ? req.query.q.trim() : '';
        
        if (!searchQuery) {
            return res.redirect('/chats');
        }
        
        // Check if admin is logged in
        const token = req.query.token || '';
        const isAdmin = !!session[token];
        
        // Create a search regex for case-insensitive search
        const searchRegex = new RegExp(searchQuery, 'i');
        
        // Search in from, to, and message fields
        const chats = await Chat.find({
            $or: [
                { from: searchRegex },
                { to: searchRegex },
                { message: searchRegex }
            ]
        }).sort({ create_to: -1 });
        
        res.render('index.ejs', { 
            chats,
            searchQuery,
            isAdmin,
            token
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.ejs', { error: 'Search failed' });
    }
});

// New - Form to create new chat
app.get('/chats/new', (req, res) => {
    // Check if admin is logged in
    const token = req.query.token || '';
    const isAdmin = !!session[token];
    
    res.render('newchat.ejs', { isAdmin, token });
});

// Create - Add new chat to database
app.post('/chats', async (req, res) => {
    try {
        const { from, to, message } = req.body;
        
        // Validate required fields
        if (!from || !to || !message) {
            return res.status(400).send('All fields are required');
        }
        
        // Check if admin is logged in
        const token = req.query.token || '';
        const isAdmin = !!session[token];
        
        const chat = new Chat({
            from,
            to,
            message,
            create_to: new Date(),
            isAdmin: isAdmin // Mark as admin message if from admin
        });
        
        await chat.save();
        
        // Redirect back, preserving admin token if present
        if (isAdmin) {
            return res.redirect(`/admin/dashboard?token=${token}`);
        }
        
        res.redirect('/chats');
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to save chat');
    }
});

// Edit - Form to edit a chat
app.get('/chats/:id/edit', checkAdminForAction, async (req, res) => {
    try {
        const { id } = req.params;
        const chat = await Chat.findById(id);
        
        if (!chat) {
            return res.status(404).send('Chat not found');
        }
        
        // Check if admin is logged in
        const token = req.query.token || '';
        const isAdmin = !!session[token];
        
        res.render('edit.ejs', { 
            chat,
            isAdmin,
            token
        });
    } catch (err) {
        console.error(err);
        if (err.name === 'CastError') {
            return res.status(400).send('Invalid chat ID');
        }
        res.status(500).send('Server error');
    }
});

// Update - Update a chat
app.put('/chats/:id', checkAdminForAction, async (req, res) => {
    try {
        const { id } = req.params;
        const { message: newMsg } = req.body;
        const token = req.query.token || '';
        
        if (!newMsg) {
            return res.status(400).send('Message cannot be empty');
        }
        
        const chat = await Chat.findById(id);
        
        if (!chat) {
            return res.status(404).send('Chat not found');
        }
        
        chat.message = newMsg;
        await chat.save();
        
        // Redirect back to admin dashboard
        return res.redirect(`/admin/dashboard?token=${token}`);
    } catch (err) {
        console.error(err);
        if (err.name === 'CastError') {
            return res.status(400).send('Invalid chat ID');
        }
        res.status(500).send('Failed to update chat');
    }
});

// Delete - Delete a chat
app.delete('/chats/:id', checkAdminForAction, async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.query.token || '';
        
        const chat = await Chat.findById(id);
        
        if (!chat) {
            return res.status(404).send('Chat not found');
        }
        
        await Chat.findByIdAndDelete(id);
        
        // Redirect back to admin dashboard
        return res.redirect(`/admin/dashboard?token=${token}`);
    } catch (err) {
        console.error(err);
        if (err.name === 'CastError') {
            return res.status(400).send('Invalid chat ID');
        }
        res.status(500).send('Failed to delete chat');
    }
});

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});