/**
 * Created by siriscac on 16/08/16.
 */

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors');
var jwtDecode = require('jwt-decode');
var marked = require('marked');
var fs = require('fs');
var markdown = require("markdown").markdown;

var config = require('./config/config');
var sample = require('./server/lib/sample');
var user = require('./server/lib/user');
var deployment = require('./server/lib/deployment');
var registry = require('./server/registry');

function isAuthenticated(req, res, next) {
    var auth = req.header("Authorization");
    if (auth) {
        var token = auth.replace("Bearer ", "");
        var decoded = jwtDecode(token);
        if (decoded) {
            if (decoded.client_id == "apigee-seed") {
                req.token = token;
                next();
            } else {
                res.status(401);
                res.send({
                    status: 401, response: "You are not authorized to perform this operation"
                });
            }
        } else {
            res.status(401);
            res.send({
                status: 401, response: "You are not authorized to perform this operation"
            });
        }
    } else {
        res.status(401);
        res.send({
            status: 401, response: "You are not authorized to perform this operation"
        });
    }
}

app.use(cors());
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded
app.use('/node_modules', express.static(__dirname + '/node_modules'));
app.use('/', express.static(__dirname + '/__build__'));

app.get('/handshake', isAuthenticated, function (req, res) {
    res.json({"response": "all_ok"});
});

app.get('/ssoconfig', function (req, res) {
    res.send({"oAuthTokenURL": config.authURL, "oAuthCallbackURL": config.oAuthCallbackURL});
});

app.get('/samples', function (req, res) {
    sample.fetchSamples(function (error, entities) {
        if (error) {
            console.log(error);
        }
        res.json(entities);
    })
});

app.post('/o/:org/e/:env/samples/:sample_id', function (req, res) {
    sample.fetchSample(req.params.sample_id, function (error, entities) {
        registry.deploy(req.params.org, req.params.env, entities[0], req.token, res);
    });
});

app.post('/samples', isAuthenticated, function (req, res) {
    var name = req.body.name;
    var description = req.body.description;
    var gitRepo = req.body.gitURL;
    var apiFolder = req.body.apiFolder;
    var user = req.body.user;
    sample.createSample(name, description, gitRepo, apiFolder, user, function (error, entities) {
        if (error) {
            console.log(error);
            res.json({error: true, response: "Application error"});
        } else {
            registry.createEntry(app, entities[0], function (error, entity) {
                res.json(entity);
            });
        }
    });
});

app.post('/user', isAuthenticated, function (req, res) {
    var name = req.body.name;
    var user_uuid = req.body.user_uuid;
    var email = req.body.email;
    user.fetchUser(email, function (error, entities) {
        if (!error) {
            if (entities.length <= 0) {
                user.createUser(name, user_uuid, email, function (error, entities) {
                    res.json(entities);
                });
            } else {
                user.updateUser(name, user_uuid, email, entities[0].uuid, function (error, entities) {
                    res.json(entities);
                });
            }
        }
    });
});

app.get('/user', function (req, res) {
    var email = req.body.email;
    user.fetchUser(email, function (error, entities) {
        res.json(entities);
    });
});

app.get('/deployments', function (req, res) {
    deployment.getDeployments(function (error, entities) {
        res.json(entities);
    });
});

app.post('/deployments', isAuthenticated, function (req, res) {
    var proxy_id = req.body.proxy_id;
    var org = req.body.org;
    var env = req.body.env;
    var appBasepath = process.cwd();
    var username = req.body.username;
    var pass = req.body.pass;
    deployment.deploy(proxy_id, org, env, appBasepath, username, pass, res);
});

app.get('/contribution-guide', function (req, res) {
    fs.readFile('./assets/seed-contribution.md', 'utf8', function (err, data) {
        if (err) throw err;
        res.send(markdown.toHTML(data));
    });
});

app.listen(process.env.PORT);
//TODO: Change to winston
console.log('Listening on port ' + process.env.PORT);
