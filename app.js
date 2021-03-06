/**
 * Created by siriscac on 16/08/16.
 */

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors');
var jwtDecode = require('jwt-decode');
var fs = require('fs');
var proxy = require('express-http-proxy');

var config = require('./config/config');
var sample = require('./server/lib/sample');
var user = require('./server/lib/user');
var deployment = require('./server/lib/task');
var registry = require('./server/registry');
var markdown = require('./server/lib/markdown');
var baas = require('./server/lib/baas');
var constants = require('./server/constants/constants');


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

//deploy method
app.post('/o/:org/e/:env/samples/:sample_id', isAuthenticated, function (req, res) {
    if (req.params.sample_id && req.params.sample_id != 'undefined') {
        sample.fetchSample(req.params.sample_id, function (error, entities) {
            if (!error) {
                registry.performTask(req.params.org, req.params.env, entities[0], req.token, req.user, req.body, "deploy", res);
            } else {
                res.end('Sample ' + req.params.sample_id + ' not found');
            }
        });
    } else {
        res.end('Sample is undefined, pls refresh your page');
    }
});

app.get('/samples', function (req, res) {
    sample.fetchSamples(req.query.ql, function (error, entities) {
        if (error) {
            console.log(error);
        }
        res.json(entities);
    })
});


app.get('/samples/:id', function (req, res) {
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
        sample_type: req.body.sample_type,
        user: req.body.user,
        type: req.body.type,
        envVars: req.body.envVars
    };
    registry.createEntry(app, ent,
        function (error, entity) {
            console.log('registry.createEntry done');
            if (!error) {
                sample.createSample(entity, function (error, entities) {
                    console.log('createSample in baas done');
                    if (error) {
                        console.log(error);
                        res.json({error: true, response: "Application error"});
                    } else {
                        res.json(entity);
                    }
                });
            } else {
                console.log(error);
                res.json({error: true, response: "Application error"});
            }
        });
});

app.delete('/samples/:sampleid', isAuthenticated, function (req, res) {
    console.log('Deleting sample');
    sample.deleteSample(req.params.sampleid, function (error, entities) {
        if (error) {
            console.log('Could not delete sample');
            res.json({error: true, response: "Application error"});
        } else {
            console.log('Sample deleted');
            console.log(entities);
            if (entities && entities[0]) {
                registry.deleteEntry(app, entities[0],
                    function (rerror, entity) {
                        if (rerror) {
                            console.log(rerror);
                            res.json({error: true, response: "Application error"});
                        }
                        else {
                            console.log('deleted from registry');
                            res.send(entity)
                        }
                    })
            } else {
                res.json({error: true, response: 'Sample Deleted, but registry cleanup failed'})
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

app.get('/admins', isAuthenticated, function (req, res) {
    baas.get(constants.ADMINS, "", function (error, body) {
        res.json(body);
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

app.use('/deployments/:id/logs',proxy(config.kubectlHost,{
    forwardPath: function(req,res){        
        var path = '/api/v1/namespaces/default/pods/' + req.params.id  + '/log'
        console.log(path)
        return path
    }
}))

registry.init(app)
    .then(function (done) {
        console.log('Registry Initialized');
    }, function (err) {
        console.log('Registry failed to initialize');
    });


app.listen(process.env.PORT);
//TODO: Change to winston
console.log('Listening on port ' + process.env.PORT);
