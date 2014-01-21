var request = require("request");
var express = require("express");
var passport = require("passport");
var LocalStrategy = require("passport-local").Strategy;

var cameras = require("./cameras.json");
console.log(cameras);

var users = [
    { id: 1, username: "bob", password: "secret", email: "bob@example.com" },
    { id: 2, username: "joe", password: "birthday", email: "joe@example.com" }
];

function findById(id, fn) {
  var idx = id - 1;
  if (users[idx]) {
    fn(null, users[idx]);
  } else {
    fn(new Error("User " + id + " does not exist"));
  }
}

function findByUsername(username, fn) {
  for (var i = 0, len = users.length; i < len; i++) {
    var user = users[i];
    if (user.username === username) {
      return fn(null, user);
    }
  }
  return fn(null, null);
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect("/login")
}

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    process.nextTick(function () {
      findByUsername(username, function(err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false, { message: "Unknown user " + username }); }
        if (user.password != password) { return done(null, false, { message: "Invalid password" }); }
        return done(null, user);
      })
    });
  }
));

var app = express();

app.configure(function() {
  app.set("views", __dirname + "/views");
  app.set("view engine", "jade");

  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: "keyboard cat" }));

  app.use(passport.initialize());
  app.use(passport.session());

  app.use(app.router);
  app.use(express.static(__dirname + "/public"));
});


app.get("/", ensureAuthenticated, function(req, res){
  res.render("index", { user: req.user });
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

app.get("/video", ensureAuthenticated, function(req, res) {
  // var user = process.env.SAURON_USER || "";
  // var pwd = process.env.SAURON_PWD || "";
  // request.get("http://192.168.0.111:8080/videostream.cgi?user=" + user + "&pwd=" + pwd).pipe(res);
  res.redirect("http://192.168.0.111:8080/videostream.cgi?user=&pwd=");
});

var port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Express server listening on port " + port);
});
