// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('User', new Schema({ 
    email: { type: String, required: true, index: { unique: true } },
    password: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    admin: { type: Boolean , required: true }
}));