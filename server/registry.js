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

var constants = require('./constants/constants');
var task = require('./lib/task');
var baas = require('./lib/baas');
var markdown = require('./lib/markdown');

var baseFolder = path.join('.', 'data');

module.exports = {
    deploy: function (org, env, sample, token, user, res) {
        var status = constants.STATUS_IN_PROGRESS;

        task.createTask(sample, org, env, status, user, "Deploy", function (error, entities) {
            if (!error) {
                var status = constants.STATUS_SUCCESS;

                var task_id = entities[0].uuid;
                var cwd = path.join(baseFolder, sample.name, sample.api_folder);
                var cmd = 'gulp deploy --org ' + org + ' --env ' + env + ' --token ' + token;
                var deployProcess = exec(cmd, {cwd: cwd});

                deployProcess.stdout.on('data', function (data) {
                    console.log(data);
                    res.write(data);
                });

                deployProcess.stderr.on('data', function (data) {
                    console.log('ERR: ' + data.toString());
                    status = constants.STATUS_FAILURE;
                    res.write("ERR: " + data.toString());
                });

                deployProcess.on('exit', function (code) {
                    console.log('Child process exited with code ' + code.toString());
                    task.updateTask(sample, org, env, status, user, "Deploy", task_id, function (error, entities) {
                        res.end("Deployment Completed");
                    });
                });

            } else {
                res.end("ERR: Deployment Failed - " + error);
            }
        });
    },

    performTask: function (org, env, sample, token, user, task_cmd, res) {
        var status = constants.STATUS_IN_PROGRESS;

        task.createTask(sample, org, env, status, user, task_cmd.toUpperCase(), function (error, entities) {
            if (!error) {
                var status = constants.STATUS_SUCCESS;

                var task_id = entities[0].uuid;
                var cwd = path.join(baseFolder, sample.name, sample.api_folder);
                var cmd = 'gulp ' + task_cmd + ' --org ' + org + ' --env ' + env + ' --token ' + token;
                var deployProcess = exec(cmd, {cwd: cwd});

                deployProcess.stdout.on('data', function (data) {
                    console.log(data.toString());
                    res.write(data.toString());
                });

                deployProcess.stderr.on('data', function (data) {
                    console.log('ERR: ' + data.toString());
                    status = constants.STATUS_FAILURE;
                    res.write("ERR: " + data.toString());
                });

                deployProcess.on('exit', function (code) {
                    console.log('Task exited with code ' + code.toString());
                    task.updateTask(sample, org, env, status, user, task_cmd.toUpperCase(), task_id, function (error, entities) {
                        res.end("Task - " + task_cmd.toUpperCase() + " Completed");
                    });
                });

            } else {
                res.end("ERR: Task - " + task_cmd.toUpperCase() + " Failed" + error.toString());
            }
        });
    },

    createEntry: function (app, entity, callback) {
        initSample(app, entity, callback);
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
                var content = markdown.toHTML(fs.readFileSync(readme).toString());
                entity.long_description = content;

                var cmd = 'npm install';
                var execPath = samplePath;

                exec(cmd, {cwd: execPath}, function (execError, stdin, stdout) {
                    if (!execError) {
                        console.log('npm install success');
                        var testPath = '/v1/o/:org/e/:env/samples/' + entity.name + '/tests';
                        console.log("Registering " + samplePath + '/test with express router..');
                        app.use(testPath, express.static(samplePath + '/test'));
                        callback(false, entity);
                    }
                    else {
                        console.log(execError);
                        callback(true, execError);
                    }
                });
            } else {
                console.log(gitError);
                callback(true, gitError);
            }
        });
}
