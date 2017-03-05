
// get the packages we need
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var crypto = require('crypto');
require('dotenv').config();

var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User = require('./app/models/user'); // get our mongoose model

// configuration
app.set('port', (process.env.PORT || 5000));
var port = app.get('port');
mongoose.connect(config.database); // connect to database
app.set('superSecret', config.secret); // secret variable


// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use (bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

// routes
app.get('/', function(req, res) {
	res.send('Hello! The API is at http://localhost:' + port + '/api');
});

app.get('/setup', function(req, res) {
	// create a sample user
	var nick = new User({
		email: 'admin@mail.com',
		password: '123456',
		passwordSalt: '123456',
		admin: true
	});

	// save the sample user
	nick.save(function(err) {
		if (err) throw err;

		console.log('User saved successfully');
		res.json({ success: true });
	});
});

// API routes

// get an instance of the router for api routes
var apiRoutes = express.Router();
var loginController = express.Router();
var coordinateController = express.Router();


// setup crypto things to store passwords in a safe way

/**
 * generates random string of characters i.e salt
 * @function
 * @param {number} length - Length of the random string.
 */
var genRandomString = function(length){
return crypto.randomBytes(Math.ceil(length/2))
						.toString('hex')	/** convert to hexadecimal format */
						.slice(0,length);	/** return required number of characters */
};

/**
 * hash password with sha512.
 * @function
 * @param {string} password - List of required fields.
 * @param {string} salt - Data to be validated.
 */
var sha512 = function(password, salt){
	var hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
	hash.update(password);
	var value = hash.digest('hex');
	return {
		salt:salt,
		passwordHash:value
	};
};

// create new user
loginController.post('/signin', function(req, res) {
	/**
	 * Now lets create a function that will use the above function to generate the hash
	 * that should be stored in the database as user’s password.
	*/
	function saltHashPassword(userpassword) {
		var salt = genRandomString(16); /** Gives us salt of length 16 */
		var passwordData = sha512(userpassword, salt);
		// console.log('UserPassword = '+userpassword);
		// console.log('Passwordhash = '+passwordData.passwordHash);
		// console.log('Salt = '+passwordData.salt);
		return passwordData ;
	}

	// find user if exist
	User.findOne({
		email: req.body.email
	}, function(err, user) {
		if (err) throw err;
		if (user) {
			res.json({ success: false, message: 'Signin failed. User already exists.' });
		} else if (!user) {
			var email = req.body.email;
			var passData = saltHashPassword(req.body.password);

			// create user instance
			var nick = new User({
				email: email,
				password: passData.passwordHash,
				passwordSalt: passData.salt,
				admin: false
			});

			// save the instance
			nick.save(function(err) {
				if (err) throw err;

				console.log('User saved successfully');
				res.json({ success: true });
			});


		} else {
			res.json({ success: false, message: 'Unexpected state. Error code: [tqlpezigmzwhva13jtt9]' });
		}
	});
});

// authenticate existing user
loginController.post('/login', function(req, res) {
	// find the user
	User.findOne({
		email: req.body.email
	}, function(err, user) {
		if (err) throw err;
		if (!user) {
			res.json({ success: false, message: 'Authentication failed. User or password incorrect.' });
		} else if (user) {
			// check if password matches
			var inputPassword = req.body.password;
			var storedHashPassword = user.password;
			var passwordData = sha512(inputPassword, user.passwordSalt);
			var inputHashPassword = passwordData.passwordHash;

			if (inputHashPassword != storedHashPassword) {
				res.json({ success: false, message: 'Authentication failed. User or password incorrect.' });
			} else {
				var token = jwt.sign({ email: user.email}, app.get('superSecret'), { expiresIn: 60*60*24 });

				// return the information including token as JSON
				res.json({
					success: true,
					message: 'Enjoy your token!',
					token: token
				});
			}
		} else {
			res.json({ success: false, message: 'Unexpected state. Error code: [ebwashvalgn1l8mvaemi]' });
		}
	});
});

coordinateController.get('/random', function(req, res) {
	// following variables indetify two points that represent two corner of a rectangle
	// their value were picked manually from google maps and the rectangle cover Milan
	// y - latitude : 45.433153642271390 - 45.50754994308527
	// x - longitude:  9.106121063232422 -  9.26198959350586
	var minX =  9.106121063232422;
	var maxX =  9.261989593505860;
	var minY = 45.433153642271390;
	var maxY = 45.507549943085270;
	var coordX = Math.random() * (minX - maxX) + maxX;
	var coordY = Math.random() * (minY - maxY) + maxY;
	res.json({ success:true, x: coordX, y: coordY });
});

// route middleware to verify a token
apiRoutes.use(function(req, res, next) {
	// check header or url parameters or post parameters for token
	var token = req.body.token || req.query.token || req.headers['x-access-token'];

	// decode token
	if (token) {
		// verifies secret and checks exp
		jwt.verify(token, app.get('superSecret'), function(err, decoded) {
			if (err) {
				return res.json({ success: false, message: 'Failed to authenticate token.' });
			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				next();
			}
		});
	} else {
		// if there is no token return an error
		return res.status(403).send({
			success: false,
			message: 'No token provided.'
		});
	}
});

// route to show a random message (GET http://localhost:8080/api/)
apiRoutes.get('/', function(req, res) {
	res.json({ message: 'welcome to the coolest API on earth!'});
});

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function(req, res) {
	User.find({}, function(err, users) {
		res.json(users);
	});
});

var testController = express.Router();
testController.get('/sandbox', function(req, res) {
	res.json({ value: Math.random() * (0.120 - 0.0200) + 0.0200 });
});

// apply test routes middleware to api routes
apiRoutes.use('/test', testController);
apiRoutes.use('/coord', coordinateController);

// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

// start the server
app.listen(port, function() {
	console.log('Magic happens at http://localhost:', port);
});
