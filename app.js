/**
 * surveys (Simple online surveys application)
 *
 * Copyright 2015 IBM Corp. All Rights Reserved
 *
 * Author: Ong Khai Wei
 * Contact: ongkw@sg.ibm.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var express = require('express'),http = require('http'), path = require('path'), fs = require('fs');

var app = express();

var db;

var cloudant;

var fileToUpload;

var dbCredentials = {
	dbName : 'tec_db'
};

var bodyParser = require('body-parser');
// var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
//app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/style', express.static(path.join(__dirname, '/views/style')));

// development only
if ('development' == app.get('env')) {
	app.use(errorHandler());
}

function initDBConnection() {
	
	if(process.env.VCAP_SERVICES) {
		var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
		// Pattern match to find the first instance of a Cloudant service in
		// VCAP_SERVICES. If you know your service key, you can access the
		// service credentials directly by using the vcapServices object.
		for(var vcapService in vcapServices){
			if(vcapService.match(/cloudant/i)){
				dbCredentials.host = vcapServices[vcapService][0].credentials.host;
				dbCredentials.port = vcapServices[vcapService][0].credentials.port;
				dbCredentials.user = vcapServices[vcapService][0].credentials.username;
				dbCredentials.password = vcapServices[vcapService][0].credentials.password;
				dbCredentials.url = vcapServices[vcapService][0].credentials.url;
				
				cloudant = require('cloudant')(dbCredentials.url);
				
				// check if DB exists if not create
				cloudant.db.create(dbCredentials.dbName, function (err, res) {
					if (err) { console.log('could not create db ', err); }
				});
				
				db = cloudant.use(dbCredentials.dbName);
				break;
			}
		}
		if(db==null){
			console.warn('Could not find Cloudant credentials in VCAP_SERVICES environment variable - data will be unavailable to the UI');
		}
	} else{
		console.warn('VCAP_SERVICES environment variable not set - data will be unavailable to the UI');
		// For running this app locally you can get your Cloudant credentials 
		// from Bluemix (VCAP_SERVICES in "cf env" output or the Environment 
		// Variables section for an app in the Bluemix console dashboard).
		// Alternately you could point to a local database here instead of a 
		// Bluemix service.
		
		cloudant = require('cloudant')(dbCredentials.url);
				
		// check if DB exists if not create
		cloudant.db.create(dbCredentials.dbName, function (err, res) {
			if (err) { console.log('could not create db ', err); }
		});
				
		db = cloudant.use(dbCredentials.dbName);

	}
}

initDBConnection();

app.get('/',
  function(req, res) {
    res.render('index.html', { user: req.user });
  });

app.get('/calendar',
  function(req, res) {
    res.render('calendar.html', { user: req.user });
  });

app.get('/calendar2',
  function(req, res) {
    res.render('calendar2.html', { user: req.user });
  });

app.post('/saveevent',
  function(req, res) {
  	var event = {
  		'title': req.body.title_,
  		'venue': req.body.venue_,
  		'start': req.body.start_,
  		'allDay': true,
  		'classmanager': req.body.classmanager_,
  		'businessunit': req.body.businessunit_,
  		'description': req.body.description_,
  		'id': req.body.id_
  	}

  	db = cloudant.use(dbCredentials.dbName);
	
	db.insert(event, '', function(err, doc) {
		if(err) {
			console.log(err);
			res.status(500).send('error');
		} else {
			
			console.log('Event is successfully saved to Cloudant');
		}
	});

    res.status(200).send('ok');
  });

app.get('/calendardata',
  function(req, res) {

  	//onsole.log('11');

  	db = cloudant.use(dbCredentials.dbName);
	var docList = [];
	var i = 0;
	db.list(function(err, body) {
		if (!err) {
			var len = body.rows.length;
			console.log('total # of docs -> '+len);

				body.rows.forEach(function(document) {
					console.log('doc='+document.id);
					db.get(document.id, { revs_info: true }, function(err, doc) {
						if (!err) {
							
							var responseData = doc;
								
							docList.push(responseData);
							i++;
							if(i >= len) {
								res.send(JSON.stringify(docList));
							}
						} else {
							console.log(err);
						}
					});
					
				});
			
		} else {
			console.log(err);
		}
	});
  });


app.get('/',
  function(req, res) {
    res.render('home', { user: req.user });
  });

app.post('/deleteevent', function(request, response) {

	console.log("Event Delete Invoked..");
	var id = request.body.id;

	console.log("Removing document of ID: " + id);
	
	var selector = { "selector":{ "_id":{ "$gt":0 }, "id":{"$eq": id } } }

	db.find(selector, function(er, result) {
	  if (er) {
	    throw er;
	  }

	  console.log('Found %d documents with id', result.docs.length);
	  for (var i = 0; i < result.docs.length; i++) {
	    console.log('  Doc id: %s', result.docs[i]._id);

		console.log('  Doc id: %s', result.docs[i]._rev);

			db.destroy(result.docs[i]._id, result.docs[i]._rev, function (err, res) {
			     // Handle response
				 if(err) {
					 console.log(err);
					 response.sendStatus(500);
				 } else {
					 response.sendStatus(200);
				 }
			});

	  }

	});
});

http.createServer(app).listen(app.get('port'), '0.0.0.0', function() {
	console.log('Express server listening on port ' + app.get('port'));
});

