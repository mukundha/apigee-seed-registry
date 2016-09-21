/**
 * Created by mukundha on 28/08/16.
 */

var express = require('express');
var git = require('gulp-git');
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var q = require('q');
var async = require('async');
var firebase = require("firebase");

var constants = require('./constants/constants');
var task = require('./lib/task');
var baas = require('./lib/baas');
var markdown = require('./lib/markdown');
var firebaseConfig = require('../config/firebase-config.json');

var baseFolder = path.join('.', 'data');
var image_builder = require('./image_builder')

firebase.initializeApp({
    serviceAccount: firebaseConfig,
    databaseURL: "https://apigee-seed.firebaseio.com"
});

var db = firebase.database();
var ref = db.ref("registry");

var tasksRef = ref.child("tasks");

module.exports = {
    deploy: function (org, env, sample, token, user, res) {
        var status = constants.STATUS_IN_PROGRESS;

        task.createTask(sample, org, env, status, user, "Deploy", function (error, entities) {
            if (!error) {
                var status = constants.STATUS_SUCCESS;
                var task_id = entities[0].uuid;
                var stacktrace = "------ Deployment Initiated ------";

                var currTaskRef = tasksRef.child(org + "-" + env);
                currTaskRef.set({
                    status: constants.STATUS_IN_PROGRESS,
                    uuid: task_id,
                    sample_id: sample.uuid,
                    stacktrace: stacktrace
                });

                var cwd = path.join(baseFolder, sample.name, sample.api_folder);
                var cmd = 'gulp deploy --org ' + org + ' --env ' + env + ' --token ' + token;
                var deployProcess = exec(cmd, {cwd: cwd});

                deployProcess.stdout.on('data', function (data) {
                    console.log(data);
                    stacktrace = stacktrace + "\n" + data;
                    currTaskRef.set({
                        stacktrace: stacktrace
                    });
                    res.write(data);
                });

                deployProcess.stderr.on('data', function (data) {
                    console.log('ERR: ' + data.toString());
                    status = constants.STATUS_FAILURE;
                    stacktrace = stacktrace + "\n" + data.toString();
                    currTaskRef.set({
                        status: constants.STATUS_FAILURE,
                        stacktrace: stacktrace
                    });
                    res.write("ERR: " + data.toString());
                });

                deployProcess.on('exit', function (code) {
                    console.log('Child process exited with code ' + code.toString());
                    task.updateTask(sample, org, env, status, user, "Deploy", task_id, function (error, entities) {
                        stacktrace = stacktrace + "\n------ Deployment Completed ------";
                        currTaskRef.set({
                            status: constants.STATUS_SUCCESS,
                            stacktrace: stacktrace
                        });
                        res.end("Deployment Completed");
                    });
                });

            } else {
                res.end("ERR: Deployment Failed - " + error);
            }
        });
    },

    performTask: function (org, env, sample, token, user, body, task_cmd, res) {
        var status = constants.STATUS_IN_PROGRESS;

        task.createTask(sample, org, env, status, user, task_cmd.toUpperCase(), function (error, entities) {
            if (!error) {
                var status = constants.STATUS_SUCCESS;
                var task_id = entities[0].uuid;

                console.log(sample);

                var stacktrace = "------ " + task_cmd + " Initiated ------";

                var currTaskRef = tasksRef.child(org + "-" + env + "/" + task_id);
                currTaskRef.set({
                    desc: "Task " + task_cmd + " initiated",
                    status: constants.STATUS_IN_PROGRESS,
                    sample_id: sample.uuid,
                    sample_name: sample.display_name,
                    stacktrace: stacktrace
                });

                var cwd = path.join(baseFolder, sample.name, sample.api_folder);
                console.log(body)
                body.org = org;
                body.env = env;
                body.token = token;
                image_builder.dockerRun('apigeeseed/' + sample.name ,task_cmd,body, res )
                    .then(function(){
                        console.log('run success')
                        task.updateTask(sample, org, env, status, user, task_cmd.toUpperCase(), task_id, function (error, entities) {
                        stacktrace = stacktrace + "\n------ " + task_cmd + " Completed ------";
                        currTaskRef.set({
                            desc: "Task " + task_cmd + " success",
                            status: constants.STATUS_SUCCESS,
                            sample_id: sample.uuid,
                            sample_name: sample.display_name,
                            stacktrace: stacktrace
                        });
                        res.end("Task - " + task_cmd.toUpperCase() + " Completed");
                        });
                    },function(err){
                        console.log('docker run failed')
                        task.updateTask(sample, org, env, status, user, task_cmd.toUpperCase(), task_id, function (error, entities) {
                        stacktrace = stacktrace + "\n------ " + task_cmd + " Completed ------";
                        currTaskRef.set({
                            desc: "Task " + task_cmd + " success",
                            status: constants.STATUS_FAILURE,
                            sample_id: sample.uuid,
                            sample_name: sample.display_name,
                            stacktrace: stacktrace
                        });
                        res.end("Task - " + task_cmd.toUpperCase() + " Completed");
                        });
                    })
            } else {
                res.end("ERR: Task - " + task_cmd.toUpperCase() + " Failed" + error.toString());
            }
        });
    },

    createEntry: function (app, entity, callback) {                
        var data = { repo: entity.git_repo, name: entity.name }
        image_builder.buildAndAdd(data)
            .then(function(){console.log('All done')},
                function(err){console.log(err)})
        initSample(app,entity,callback)
    },

    deleteEntry: function (app, entity, callback) {
        if (!entity || !entity.name) {
            callback("Entity not found");
            return
        }
        var clonePath = path.join(baseFolder, entity.name);
        console.log(clonePath);
        exec("rm -rf " + clonePath, {}, function (err, stdin, stdout) {
            callback(err)
        })

    },

    init: function (app) {
        var d = q.defer();
        console.log("Removing " + baseFolder + " folder");

        exec("rm -rf " + baseFolder, {}, function (err, stdin, stdout) {
            baas.get(constants.SAMPLES, undefined, function (err, body) {
                if (err) {
                    d.reject(err, body);
                } else {
                    async.eachLimit(body, 5, function (entity, cb) {
                        if (entity.name) {
                            initSample(app, entity, cb)
                        }
                    }, function (err, resp) {
                        if (err) {
                            d.reject(err, resp);
                        }
                        d.resolve();
                    })
                }
            });
        });
        return d.promise;
    }
};

function initSample(app, entity, callback) {
    var clonePath = path.join(baseFolder, entity.name);
    git.clone(entity.git_repo, {args: clonePath},
        function (gitError) {
            if (!gitError) {
                var samplePath = path.join(clonePath, entity.api_folder);
                //TODO: Check for README.md absence
                var readme = path.join(samplePath, 'README.md');
                try {
                    var content = markdown.toHTML(fs.readFileSync(readme).toString().replace(/\!\[(.)+]\((.)+\)/, ""));
                    entity.long_description = content;
                } catch (err) {
                    console.log('readme not found')
                }
                var testPath = '/v1/o/:org/e/:env/samples/' + entity.name + '/tests';
                console.log("Registering " + samplePath + '/test with express router..');
                app.use(testPath, express.static(samplePath + '/test'));
                callback(false, entity);                
            } else {
                console.log(gitError);
                callback(true, gitError);
            }
        });
}
