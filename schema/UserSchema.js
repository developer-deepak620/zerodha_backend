const { Schema } = require("mongoose");

const passportLocalMongoose = require("passport-local-mongoose").default || require("passport-local-mongoose");

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
});

// 👇 plugin attach
UserSchema.plugin(passportLocalMongoose);

module.exports = { UserSchema };