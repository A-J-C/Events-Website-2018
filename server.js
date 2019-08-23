const express = require("express");																							// requires express
const app = express();																													// launch server
const path = require("path");																										// get the path
const BASE = "/events2017";																											// base url
const bodyParser = require("body-parser");																			// for processing post
const request = require("request");																							// for get request
const moment = require("moment");																								// used for checking date
const sqlite3 = require("sqlite3").verbose();																		// for local db
const href = "https://mxcm21events.eu-gb.mybluemix.net/";												// start url for server
const cfenv = require('cfenv');																									// link to IBM cloud foundry
const appEnv = cfenv.getAppEnv();																								// to make sure it is run on right port

console.log("Server running on "+href+BASE);																		// log that it is running

app.use(express.static(__dirname));																							// static middleware
app.use(bodyParser.json());																											// for processing post requests
app.use(bodyParser.urlencoded({extended: false})); 															// setup body parser

var users = {"mxcm21":"password", "steven":"notAnAccordian"};										// keeps track of users
var auths = {};																																	// keeps track of valid auth tokens

let db = new sqlite3.Database("events_DB.db");
console.log("Connected to local sqlite3 Database: events_DB.db");								// log that database connected

/* GET BASE */
app.get(BASE + '/index', function(req, resp) {																	// when accessing root
	console.log("index.html requested by: "+req.headers['x-client-ip']);					// log request
	resp.status(200).sendFile(BASE + '/index.html');															// serve index page
});

/* GET BASE/admin */
app.get(BASE + '/admin', function(req, resp) {																	// when accessing root
	console.log("admin.html requested by: "+req.headers['x-client-ip']);					// log request
	resp.status(200).sendFile(path.join(__dirname, BASE, 'admin.html'));					// serve admin page
});

/* GET BASE/venues */
app.get(BASE + '/venues', function(req, resp) {
	/* No Paramaters, returns all venues and details */
	console.log("venues requested by: "+req.headers['x-client-ip']);							// log request
	var venDict = {};																															// inner dictionary
	db.all("SELECT * FROM venues", function(err, respDB) {												// query the database

		for (var i = 0; i < respDB.length; i++) {
			var venue = respDB[i];																										// extract venue
			var venID = venue.venue_id;
			delete venue.venue_id;																										// don't want venue id repeated
			venDict[venID] = venue;																										// add to inner dictinoary
		}
		var response = {"venues" : venDict};																				// outer dictionary
		resp.set({"Content-Type": "application/json", 															// define header, stops results being cached
		"Cache-Control": "private,no-cache,no-store,must-revalidate"});
		resp.status(200).send(response);																						// return response as JSON object
	});
});

/* GET BASE/events/search?search=eventName&date=2017-11-20*/
app.get(BASE + '/events/search', function(req, resp) {
	/* Both are optional paramaters, returns al
	l if no paramaters */
	console.log("events search requested by: "+req.headers['x-client-ip']);				// log request
	var search = cleanse(req.query.search);																				// extract search
	var date = cleanse(req.query.date);																						// extract date
	var ext = req.query.ext || true;																							// whether we need to load external events or not

	if (ext == "false")
		ext = false;

	if (date != null) {
		date = date.substr(0,10);																										// cut to just the start of the date
		if (search != null) {
			/* Checks for exact day and if search matches part of Event title, location or venue name */
			db.all("SELECT DISTINCT (e.event_id), e.* FROM events e, venues v WHERE date LIKE '"+date+"%' AND (title "+
				"LIKE '%"+search+"%' OR (e.venue_id = v.venue_id AND (town "+
				"LIKE '%"+search+"%' OR name LIKE '%"+search+"%')));", function(err, respDB) {
					formatEvents(respDB, resp, search, date, ext);												// returns events
				});
		} else
			db.all("SELECT DISTINCT (e.event_id), e.* FROM events e WHERE date LIKE '"+date+"%';", function(err, respDB) {
					formatEvents(respDB, resp, search, date, ext);												// returns events
				});
	} else
		if (search != null)
			db.all("SELECT DISTINCT (e.event_id), e.* FROM events e, venues v WHERE title LIKE '%"+search+"%' OR " +
				"(e.venue_id = v.venue_id AND (town LIKE '%"+search+"%' OR name LIKE " +
				"'%"+search+"%'));", function(err, respDB) {
					formatEvents(respDB, resp, search, date, ext);												// returns events
				});
		else
			db.all("SELECT * FROM events;", function(err, respDB) {
					formatEvents(respDB, resp, search, date, ext);												// returns events
				});
});

/* GET BASE/events/get/:event_id
   GET BASE/events/get/20 */
app.get(BASE + '/events/get/:event_id', function(req, resp) {
	/* One required event_id, returns corresponding event */
	console.log("events get requested by: "+req.headers['x-client-ip']);						// log request
	var eventID = req.params.event_id;																						// extract event id

	resp.set({"Content-Type": "application/json", 																// define header, stops results being cached
		"Cache-Control": "private,no-cache,no-store,must-revalidate"});

	if (eventID != null) {																												// if required param is present
		db.all("SELECT * FROM events WHERE event_id LIKE '"+eventID+"'", function(err, respDB) {
			if (respDB.length == 0)
				resp.status(400).send({"error" : "no such event"});																	// send error if event not found
			 else
				formatEvents(respDB, resp,"","",false);																	// else format and send
		});
	}
});

/* Formats events to be returned in expected format */
function formatEvents(evenDB, resp, name, date, ext) {

	db.all("SELECT * FROM venues", function(err, venDB) {													// query the database
		var events = [];																														// inner list
		var venDict = {};
		for (var i = 0; i < venDB.length; i++) {
			var venue = venDB[i];
			venDict[venue.venue_id] = venue;
		}

		for (var i = 0; i < evenDB.length; i++) {
			var even = evenDB[i];																											// extract event
			var venID = even.venue_id;
			delete even.venue_id;																											// don't want venue id repeated
			even["venue"] = venDict[venID];																						// merge dictionaries
			events.push(even);																												// add to inner dictinoary
		}

		if (date != "" && date != undefined) { 																													// format date for external API
				date = date.split("-");
				var newDate = date[0] + date[1] + date[2] + "00";
				newDate += "-" + newDate;
		}

		var external = "https://api.eventful.com/json/events/search?app_key=7FhszLqrTm4zQcPL&category=music&where=54.7753,1.5849&within=150"; // external API link
		external += (name != undefined) ? "&keywords=" + name : ""; 												// add search params
		external += (newDate != "") ? "&date=" + newDate : "";

		if (ext)
			request.get(external, {dataType: 'jsonp',format: "json"}, function(err, res, respExt) {
					respExt =  JSON.parse(respExt);																				// turn response into a dictonary

					if (respExt.events != null) {																					// check some events are returned
						var extEvents = respExt.events.event;																// external events dictionary
						for (var i = 0; i < extEvents.length; i++) {
								var extEv = {};																									// event dictionary
								var extVen = {};																								// venue dictionary
								var eventItem = extEvents[i];
								var d = eventItem.start_time.split(" ");
								d = d[0]+"T"+d[1]+"Z"; 				 																	// put date in ISO8601 format

								extEv.event_id = eventItem.id;																	// fill dictionaries with correct values
								extEv.title = eventItem.title;
								extEv.blurb = eventItem.description;
								extEv.date = d;
								extEv.url = eventItem.url;
								extEv.external = true;																					// set as external event
								extVen.venue_id = eventItem.venue_id;
								extVen.name = eventItem.venue_name;
								extVen.postcode = eventItem.postal_code;
								extVen.town = eventItem.region_name;
								extVen.url = eventItem.venue_url;
								extVen.icon = (eventItem.image != null) ? eventItem.image.url : null;
								extEv.venue = extVen;

								events.push(extEv);																							// add to event array
						}
					}
					resp.set({"Content-Type": "application/json", 												// define header, stops results being cached
					"Cache-Control": "private,no-cache,no-store,must-revalidate"});
					resp.status(200).send({"events" : events});														// send response back wrapped in dictionary
			});
		else {
			resp.set({"Content-Type": "application/json", 														// define header, stops results being cached
			"Cache-Control": "private,no-cache,no-store,must-revalidate"});
			resp.status(200).send({"events" : events});																// send response back wrapped in dictionary
		}
	});
}

/* POST BASE/venues/add */
app.post(BASE + '/venues/add', function (req, resp) {
	/* two required params and four optional, returns if error */
	resp.set({"Content-Type": "application/json", 																// define header, stops results being cached
		"Cache-Control": "private,no-cache,no-store,must-revalidate"});

	console.log("venues add requested by: "+req.headers['x-client-ip']);						// log request

	var authToken = req.body.auth_token;																					// check if auth is given as query
	if (authToken == undefined && req.headers.cookie != undefined)								// if not get it from cookie
		authToken = (req.headers.cookie).split("=")[1];															// extract auth token from cookie
	console.log(authToken);
	var name = cleanse(req.body.name);
	var postcode = cleanse(req.body.postcode);
	var town = cleanse(req.body.town);
	var url = cleanse(req.body.url);
	var icon = cleanse(req.body.icon);
	var ip = req.headers['x-client-ip'];																					// extract ip

	/* check auth value */
	request.get(href + BASE + "/auth/valid?auth_token="+authToken+"&ip="+ip, {json: true}, function(err, res, authResp) {
		if (authResp.valid == "false")																							// check auth token
			resp.stauts(401).send({"error" : "not authorised, wrong token"});
		else if (name == null)																											// check for required params
			resp.status(400).send({"error" : "no name provided"});
		else	{
			console.log("adding")
			var valNames = "(venue_id,name";																										// specifying the columns to insert
			valNames += (postcode != null) ? ",postcode": "";
			valNames += (town != null) ? ",town": "";
			valNames += (url != null) ? ",url": "";
			valNames += (icon != null) ? ",icon": "";
			valNames += ")";

			var vals = "','"+name+"'";																									// get values in string
			vals += (postcode != null) ? ",'"+postcode+"'":"";
			vals += (town != null) ? ",'"+town+"'":"";
			vals += (url != null) ? ",'"+url+"'":"";
			vals += (icon != null) ? ",'"+icon+"'":"";
			vals += ")";

			db.all("SELECT venue_id FROM venues", function(err, respVen) {
				maxVen = 0;
				for (ven in respVen) {
					var num = parseInt(respVen[ven].venue_id.split("_")[1]);
					if (num > maxVen)
						maxVen = num;
				}

				db.run("INSERT INTO venues "+valNames+" VALUES ('v_"+(maxVen+1)+vals+";", function (err, respDB) {		// insert into event
					resp.status(201).send({"success":"venue successfully inserted"});				// return success
				});
			});
		}
	});
});

/* POST BASE/events/add */
app.post(BASE + '/events/add', function (req, resp) {
	/* four required params two optional */
	console.log("events add requested by: "+req.headers['x-client-ip']);						// log request
	var authToken = req.body.auth_token;																					// check if auth is given as query
	if (authToken == undefined && req.headers.cookie != undefined)								// if not get it from cookie
		authToken = (req.headers.cookie).split("=")[1];															// extract auth token from cookie

	var eventID = cleanse(req.body.event_id);
	var title = cleanse(req.body.title);
	var venueID = cleanse(req.body.venue_id);
	var date = cleanse(req.body.date);
	var url = cleanse(req.body.url);
	var blurb = cleanse(req.body.blurb);
	var ip = req.headers['x-client-ip'];																					// extract ip

	resp.set({"Content-Type": "application/json", 																// define header, stops results being cached
		"Cache-Control": "private,no-cache,no-store,must-revalidate"});
	/* use auth service */
	request.get(href + BASE + "/auth/valid?auth_token="+authToken+"&ip="+ip, {json: true}, function(err, res, authResp) {
		if (authResp.valid == "false")
			resp.status(401).send({"error" : "not authorised, wrong token"});
		else if (eventID == null)
			resp.status(400).send({"error" : "no event_id provided"});
		else if (title == null)
			resp.status(400).send({"error" : "no title provided"});
		else if (venueID == null)
			resp.status(400).send({"error" : "no venue_id provided"});
		else if (!moment(date, moment.ISO_8601, true).isValid())
			resp.status(400).send({"error" : "date not provided or not of correct format (ISO8601)"});
		else {
			/* CHECKS THAT EVENT DOESN'T ALREADY EXIST AND THERE IS A CORRESPONDING VENUE - FAQ SAYS NOT NEEDED SO TAKEN OUT
			con.query("SELECT * FROM events WHERE event_id = '"+eventID+"'", function(err, respDB) {				// check if event_id already in use
				if (err) throw err;
				if (respDB.length != 0)
					resp.status(400).send({"error": 'Event ID already exists, please use another one.'});			// if it is then send error
				else
					con.query("SELECT * FROM venues WHERE venue_id = '"+venueID+"'", function(err, respDB) {		// check if venue_id exists
						if (err) throw err;
						if (respDB.length == 0)
							resp.status(400).send({"error" : "That venue doesn't exist"});							// if it doesn't send error
						else {
			*/
							var valNames = "(event_id,title,";																	// specifying the columns to insert
							valNames += (blurb != null) ? "blurb,date,": "date,";
							valNames += (url != null) ? "url,venue_id)": "venue_id)";

							var vals = "('"+eventID+"','"+title+"','";													// get values in string
							vals += (blurb != null) ? blurb+"','"+date+"','": date+"','";
							vals += (url != null) ? url+"','"+venueID+"')": venueID+"')";

							db.run("REPLACE INTO events "+valNames+" VALUES "+vals+";", function (err, respDB) {	// insert into event and replace if already exists
								resp.status(201).send({"success":"event successfully inserted"});	// return success
							});
			/*
						}
					});
			});
			*/
		}
	});
});

/* POST BASE/venues/del */
app.post(BASE + '/venues/del', function (req, resp) {
	/* four required params two optional */
	console.log("venues delete requested by: "+req.headers['x-client-ip']);				// log request
	var authToken = req.body.auth_token;																					// check if auth is given as query
	if (authToken == undefined && req.headers.cookie != undefined)								// if not get it from cookie
		authToken = (req.headers.cookie).split("=")[1];															// extract auth token from cookie
	var ip = req.headers['x-client-ip'];																					// extract ip
	var venueID = cleanse(req.body.id);

	resp.set({"Content-Type": "application/json", 																// define header, stops results being cached
		"Cache-Control": "private,no-cache,no-store,must-revalidate"});

	request.get(href + BASE + "/auth/valid?auth_token="+authToken+"&ip="+ip, {json: true}, function(err, res, authResp) {
		if (authResp.valid == "false")
			resp.status(401).send({"error" : "not authorised, wrong token"});
		else
			db.run("DELETE FROM events WHERE venue_id = '"+venueID+"';", function (err, respDB) {	// insert into event and replacce if already exists
				db.run("DELETE FROM venues WHERE venue_id = '"+venueID+"';", function (err, respDB) {	// insert into event and replacce if already exists
					resp.status(201).send({"success":"venue successfully deleted"});			// return success
				});
			});
		});
});

/* POST BASE/events/del */
app.post(BASE + '/events/del', function (req, resp) {
	/* four required params two optional */
	console.log("events delete requested by: "+req.headers['x-client-ip']);				// log request
	var authToken = req.body.auth_token;																					// check if auth is given as query
	if (authToken == undefined && req.headers.cookie != undefined)								// if not get it from cookie
		authToken = (req.headers.cookie).split("=")[1];															// extract auth token from cookie
	var ip = req.headers['x-client-ip'];																					// extract ip
	var eventID = cleanse(req.body.id);

	resp.set({"Content-Type": "application/json", 																// define header, stops results being cached
		"Cache-Control": "private,no-cache,no-store,must-revalidate"});

	request.get(href + BASE + "/auth/valid?auth_token="+authToken+"&ip="+ip, {json: true}, function(err, res, authResp) {
		if (authResp.valid == "false")
			resp.status(400).send({"error" : "not authorised, wrong token"});
		else
			db.run("DELETE FROM events WHERE event_id = '"+eventID+"';", function (err, respDB) {	// insert into event and replacce if already exists
				resp.status(201).send({"success":"event successfully deleted"});			// return success
			});
		});
});

/* POST BASE/auth */
app.post(BASE + '/auth', function (req, resp) {
	console.log("auth post by: "+req.headers['x-client-ip']);											// log request
	var user = cleanse(req.body.username);																				// extract post variables
	var pass = cleanse(req.body.password);
	var ip = req.headers['x-client-ip'];																					// extract ip
	var date = new Date();

	resp.set({"Content-Type": "application/json", 																// define header, stops results being cached
		"Cache-Control": "private,no-cache,no-store,must-revalidate"});

	if (!(user in users))
		resp.status(401).send({"authorised":"false", "bad":"user"});
	else if (users[user] != pass)
		resp.status(401).send({"authorised":"false", "bad":"pass"});
	else {
		console.log("sending auth cookie");
		var authToken = new Buffer(user + ip + date + Math.random().toString(36).substr(2,5)).toString('base64').split("=")[0];						// generate auth token using base64 encoding, a time stamp and a random element
		var endDate = date.setHours(date.getHours() + 2);
		auths[authToken] = [ip, endDate];																						// stores currently valid authtokens
		console.log(auths);																													// log current auth tokens
		resp.status(200).cookie('eventsAuthToken', authToken, {maxAge: 7200000, httpOnly: true}).send({"authorised":"true"}); // sends response with cookie
	}
});

/* POST BASE/auth/del */
app.post(BASE + '/auth/del', function (req, resp) {
	console.log("auth del by: "+req.headers['x-client-ip']);												// log request
	var authToken = req.body.auth_token;																					// check if auth is given as query
	if (authToken == undefined && req.headers.cookie != undefined)								// if not get it from cookie
		authToken = (req.headers.cookie).split("=")[1];															// extract auth token from cookie

	delete auths[authToken];																											// delete authToken

	resp.set({"Content-Type": "application/json", 																// define header, stops results being cached
		"Cache-Control": "private,no-cache,no-store,must-revalidate"});
	resp.status(201).send({"success":"auth deleted"}); 														// sends response
});

/* GET BASE/auth/valid?auth_token=token */
app.get(BASE + '/auth/valid', function (req, resp) {
	console.log("auth request by: "+req.headers['x-client-ip']);

	var authToken = req.query.auth_token;																					// check if auth is given as query
	if (authToken == undefined && req.headers.cookie != undefined)								// if not get it from cookie
		authToken = (req.headers.cookie).split("=")[1];															// extract auth token from cookie
	var ip = req.query.ip;																												// extract ip
	console.log("WHY IS THIS NOT WOKRING" + ip);
	if (ip == undefined && req.headers['x-client-ip'] != undefined)
		ip = req.headers['x-client-ip'];																						// extract ip

	console.log(authToken, ip, auths, authToken in auths, ip.startsWith(auths[authToken][0]));
	resp.set({"Content-Type": "application/json", 																// define header, stops results being cached
		"Cache-Control": "private,no-cache,no-store,must-revalidate"});

	if (authToken != undefined && (authToken == "concertina" ||										// auth token either concertina
			(authToken in auths && ip.startsWith(auths[authToken][0]) &&							// or is a valid auth
			auths[authToken][1] > new Date())))																				// and is within the time stamp
		resp.status(200).send({"valid":"true"});																		// return valid
	else
		resp.status(401).send({"valid":"false"});																		// invalid
});

/* serves error page or error JSON requests */
app.use(function(req, resp, next){																							// serves error page
	resp.status(404).sendFile(path.join(__dirname, BASE, 'error.html'));
});

/* takes quotes out of all user input */
function cleanse(input) {
	if (input!= undefined)
		input = input.replace(/"/g, '""').replace(/'/g, "''");
	return input;
}

app.listen(appEnv.port);																												// running on port specified by IBM
