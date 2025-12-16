const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    from: {
        type: String,
        required: true,  // Fixed 'require' to 'required'
        index: true      // Add index for better search performance
    },
    to: {
        type: String,
        required: true,  // Fixed 'require' to 'required'
        index: true      // Add index for better search performance
    },
    message: {
        type: String,
        required: true   // Fixed 'require' to 'required'
    },
    create_to: {
        type: Date,
        default: Date.now
    },
    completed: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    }
});

// Add text index for better full-text search capabilities
chatSchema.index({ 
    from: 'text',
    to: 'text',
    message: 'text'
});

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
