//var request = require("request");
var express = require("express");
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

var log4js = require('log4js');
var https = require("https");
var passport = require("passport");
var LocalStrategy = require("passport-local").Strategy;
var mongodb = require("mongodb");
var mongoose = require("mongoose");
var bcrypt = require("bcrypt");
var S = require("string");

var rawCameras = require("./cameras.json");
var cameras = rawCameras.map(function(camera){
  camera.address = process.env[camera.config_key + "_ADDR"];
  camera.users = {
    operator: {
      name: process.env[camera.config_key + "_OPERATOR_USER"],
      pwd: process.env[camera.config_key + "_OPERATOR_PWD"]
    },
    visitor: {
      name: process.env[camera.config_key + "_USER"] || process.env[camera.config_key + "_OPERATOR_USER"],
      pwd: process.env[camera.config_key + "_PWD"] || process.env[camera.config_key + "_OPERATOR_PWD"]
    }
  };
  return camera;
});

mongoose.connect(process.env.MONGOLAB_URI || "mongodb://localhost/test");
var db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function (){
  logger.info("Connected to the DB");
});

var userSchema = mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

var SALT_WORK_FACTOR = 10;

userSchema.pre("save", function(next) {
  var user = this;

  if(!user.isModified("password")) return next();

  bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
    if(err) return next(err);

    bcrypt.hash(user.password, salt, function(err, hash) {
      if(err) return next(err);
      user.password = hash;
      next();
    });
  });
});

userSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if(err) return cb(err);
    cb(null, isMatch);
  });
};

var User = mongoose.model("User", userSchema);
// var user = new User({
//   username: "",
//   email: "",
//   password: ""
// });
// user.save(function (error) {
//   if(error) {
//     logger.error(error);
//   } else {
//     logger.debug("user:" + user.username + " saved.");
//   }
// });

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect("/login")
}

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(new LocalStrategy(function(username, password, done) {
  User.findOne({ username: username, active: true }, function(error, user) {
    if (error) {
      return done(error);
    }
    if(!user) {
      return done(null, false, { message: "Invalid User"});
    }

    user.comparePassword(password, function(error, isMatch) {
      if (error) {
        return done(error);
      }

      return isMatch ? done(null, user) : done(null, false, { message: "Invalid Password"});
    });
  });
}));

var logger = log4js.getLogger('console');
var app = express();

app.set("views", __dirname + "/views");
app.set("view engine", "jade");

app.use(log4js.connectLogger(logger, { level: log4js.levels.INFO }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: "keyboard cat"
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(__dirname + "/public"));


app.get("/", ensureAuthenticated, function(req, res){
  res.render("index", {
    user: req.user,
    cameras: rawCameras
  });
});

app.get("/login", function(req, res){
  res.render("login", { user: req.user, message: req.session.messages });
});
  
app.post("/login", function(req, res, next) {
  passport.authenticate("local", function(err, user, info) {
    if (err) { return next(err) }
    if (!user) {
      req.session.messages =  [info.message];
      return res.redirect("/login")
    }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
      return res.redirect("/");
    });
  })(req, res, next);
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.get("/video/:name", ensureAuthenticated, function(req, res) {
  var name = req.params.name;

  var camera = cameras.filter(function(camera) {
    return camera.name.toLowerCase() === name.toLowerCase();
  }).pop();

  var cameraAddress = "/images/stand-by.jpg";

  if(camera && camera.address) {
    cameraAddress = camera.address + "/videostream.cgi?user=" + camera.users.visitor.name + "&pwd=" + camera.users.visitor.pwd;
  }

  res.redirect(cameraAddress);
});

var commands = [];
commands["up:start"]    = "0";
commands["up:stop"]     = "1";
commands["down:start"]  = "2";
commands["down:stop"]   = "3";
commands["right:start"]  = "4";
commands["right:stop"]   = "5";
commands["left:start"] = "6";
commands["left:stop"]  = "7";

commands["preset:1"]    ="31";
commands["preset:2"]    ="33";
commands["preset:3"]    ="35";
commands["preset:4"]    ="37";
commands["preset:5"]    ="39";
commands["preset:6"]    ="41";
commands["preset:7"]    ="43";
commands["preset:8"]    ="45";

function sendCommand(command, cameraName, callback) {
  var camera = cameras.filter(function(camera) {
    return camera.name.toLowerCase() === cameraName.toLowerCase();
  }).pop();

  if(camera && camera.address) {
    var cameraAddress = camera.address + "/decoder_control.cgi?command=" + command + "&user=" + camera.users.operator.name + "&pwd=" + camera.users.operator.pwd;
    https.request(cameraAddress, function(response){
      if(response.statusCode === 200 && typeof(callback) === 'function') {
        callback.apply(this);
      }
    }).end();
  }
}

app.get("/command/:camera/:command", ensureAuthenticated, function (req, res) {
  var camera = req.params.camera;
  var commandName = req.params.command;
  var command = commands[commandName];

  logger.info("sending command %s to camera %s", commandName, camera);

  sendCommand(command, camera, function(){
    if(S(commandName).endsWith('start')){
      commandName = S(commandName).replace('start', 'stop');
      command = commands[commandName];

      setTimeout(function() {
        logger.info("sending command %s to camera %s", commandName, camera);
        sendCommand(command, camera);
      }, 500);
    }
  });

  res.sendStatus(200);
});

app.get("/keep", ensureAuthenticated, function(req, res) {
  res.sendStatus(200);
});

var port = process.env.PORT || 3000;

app.listen(port, function() {
  logger.info("Express server listening on port " + port);
});
