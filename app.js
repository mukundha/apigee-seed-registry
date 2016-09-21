/**
 * Created by siriscac on 16/08/16.
 */

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors');
var jwtDecode = require('jwt-decode');
var fs = require('fs');

var config = require('./config/config');
var sample = require('./server/lib/sample');
var user = require('./server/lib/user');
var deployment = require('./server/lib/task');
var registry = require('./server/registry');
var markdown = require('./server/lib/markdown');
var proxy = require('express-http-proxy');

function isAuthenticated(req, res, next) {
    try {
        var auth = req.header("Authorization");
        if (auth) {
            var token = auth.replace("Bearer ", "");
            var decoded = jwtDecode(token);
            if (decoded) {
                if (decoded.client_id == "apigee-seed") {
                    var user = {};
                    user.username = decoded.user_name;
                    user.user_id = decoded.user_id;
                    user.email = decoded.email;
                    req.user = user;
                    req.token = token;
                    next();
                } else {
                    res.status(401);
                    res.send({
                        status: 401, response: "Invalid token. You are not authorized to perform this operation"
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
    } catch (exception) {
        console.log(exception);
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

//deploy
//pass env variables in body
app.post('/o/:org/e/:env/samples/:sample_id', isAuthenticated, function (req, res) {
    sample.fetchSample(req.params.sample_id, function (error, entities) {
        registry.performTask(req.params.org, req.params.env, entities[0], req.token, req.user, req.body, "deploy", res);
    });
});

app.get('/samples', function (req, res) {
    console.log(req.query.ql)
    sample.fetchSamples(req.query.ql,function (error, entities) {
        if (error) {
            console.log(error);
        }
        res.json(entities);
    })
});


app.get('/samples/:id', function (req, res) {
    console.log(req.params.id);
    sample.fetchSampleByName(req.params.id, function (error, entities) {
        if (error) {
            console.log(error);
        }
        res.json(entities);
    })
});

app.delete('/o/:org/e/:env/samples/:sample_id', isAuthenticated, function (req, res) {
    sample.fetchSample(req.params.sample_id, function (error, entities) {
        registry.performTask(req.params.org, req.params.env, entities[0], req.token, req.user, {}, "clean", res);
    });
});

app.post('/samples', isAuthenticated, function (req, res) {
    var id = req.body.name.toLowerCase().replace(/ /g, "-");
    var ent = {
        name: id,
        display_name: req.body.name,
        description: req.body.description,
        git_repo: req.body.gitURL,
        api_folder: req.body.apiFolder,
        user: req.body.user,
        envVars: req.body.envVars
    };
    registry.createEntry(app, ent,
        function (error, entity) {
            console.log('registry.createEntry done')
            console.log(error)
            if(!error){
                sample.createSample(entity, function (error, entities) {
                    console.log('createSample in baas done')
                    console.log(error)
                    if (error) {
                        res.json({error: true, response: "Application error"});
                    } else {
                        res.json(entity);
                    }
                });
            }else{
                res.json({error: true, response: "Application error"});
            }
        });
});

app.delete('/samples/:sampleid', isAuthenticated, function (req, res) {
    console.log('deleting sample');
    sample.deleteSample(req.params.sampleid, function (error, entities) {
        if (error) {
            console.log('could not delete sample')
            console.log('error')
            res.json({error: true, response: "Application error"});
        } else {
            console.log('sample deleted ' );
            console.log(entities)
            if(entities && entities[0])
            {
                registry.deleteEntry(app, entities[0],
                function (rerror, entity) {
                    if (rerror) {
                        console.log(rerror)
                        res.json({error: true, response: "Application error"});
                    }
                    else {
                        console.log('deleted from registry')
                        res.send(entity)
                    }
                })
            }else{
                res.json({error:true, response:'Sample Deleted, but registry cleanup failed'})
            }

        }
    })
});

app.post('/user', isAuthenticated, function (req, res) {
    user.fetchUser(req.user.email, function (error, en) {
        if (!error && en) {
            if (en.length <= 0) {
                user.createUser(req.user, function (error, entities) {
                    res.json(entities);
                });
            } else {
                user.updateUser(req.user, en[0].uuid, function (error, entities) {
                    res.json(entities);
                });
            }
        }
    });
});

app.get('/user', isAuthenticated, function (req, res) {
    user.fetchUser(req.user.email, function (error, entities) {
        if (!error) {
            res.json(entities);
        }
    });
});

app.get('/tasks', isAuthenticated, function (req, res) {
    var org = req.query.org;
    deployment.getTasks(null, org, function (error, entities) {
        res.json(entities);
    });
});

app.get('/task/:sampleid', isAuthenticated, function (req, res) {
    var org = req.query.org;
    var sample_id = req.query.sampleid;
    deployment.getTasks(sample_id, org, function (error, entities) {
        res.json(entities);
    });
});

app.get('/contribution-guide', function (req, res) {
    fs.readFile('./assets/seed-contribution.md', 'utf8', function (err, data) {
        if (err) throw err;
        res.send(markdown.toHTML(data));
    });
});


registry.init(app)
    .then(function (done) {
        console.log('Registry Initialized');
    }, function (err) {
        console.log('Registry failed to initialize');
    });


app.listen(process.env.PORT);
//TODO: Change to winston
console.log('Listening on port ' + process.env.PORT);
