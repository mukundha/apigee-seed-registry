/**
 * Created by mukundha on 28/08/16.
 */

var express = require('express');
var proxy = require('express-http-proxy');

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
var config = require('../config/config.js');
var baseFolder = path.join('.', 'data');
var image_builder = require('./image_builder');
var request = require('request');

firebase.initializeApp({
    serviceAccount: firebaseConfig,
    databaseURL: "https://apigee-seed.firebaseio.com"
});

var db = firebase.database();
var ref = db.ref("registry");

var tasksRef = ref.child("tasks");

module.exports = {

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
                    stacktrace: stacktrace,
                    time: new Date().getTime()
                });

                var cwd = path.join(baseFolder, sample.name, sample.api_folder);
                console.log(body);
                body.org = org;
                body.env = env;
                body.token = token;
                image_builder.dockerRun(config.dockerPrefix + sample.name, task_cmd, body, res)
                    .then(function () {
                        console.log('Docker Run Success');
                        task.updateTask(sample, org, env, status, user, task_cmd.toUpperCase(), task_id, function (error, entities) {
                            stacktrace = stacktrace + "\n------ " + task_cmd + " Completed ------";
                            currTaskRef.set({
                                desc: "Task " + task_cmd + " success",
                                status: constants.STATUS_SUCCESS,
                                sample_id: sample.uuid,
                                sample_name: sample.display_name,
                                stacktrace: stacktrace,
                                time: new Date().getTime()
                            });
                            res.end("Task - " + task_cmd.toUpperCase() + " Completed");
                        });
                    }, function (err) {
                        console.log(err);
                        console.log('Docker Run failed');
                        task.updateTask(sample, org, env, status, user, task_cmd.toUpperCase(), task_id, function (error, entities) {
                            stacktrace = stacktrace + "\n------ " + task_cmd + " Completed ------";
                            currTaskRef.set({
                                desc: "Task " + task_cmd + " success",
                                status: constants.STATUS_FAILURE,
                                sample_id: sample.uuid,
                                sample_name: sample.display_name,
                                stacktrace: stacktrace,
                                time: new Date().getTime()
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
        var data = {repo: entity.git_repo, name: entity.name, apifolder: entity.api_folder}
        image_builder.buildAndAdd(data)
            .then(function () {
                    console.log('All done')
                },
                function (err) {
                    console.log(err)
                });
        initSample(app, entity, callback)
    },

    deleteEntry: function (app, entity, callback) {
        if (!entity || !entity.name) {
            callback("Entity not found");
            return
        }
        callback(null)
    },

    init: function (app) {
        var d = q.defer();
        console.log("Removing " + baseFolder + " folder");
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
        return d.promise;
    }
};

function initSample(app, entity, callback) {
    var clonePath = path.join(baseFolder, entity.name);
    var REGEX_REPO_URL = /^(https?):\/\/github\.com\/(.[^\/]+?)\/(.[^\/]+?)\/(?!releases\/)(?:(?:blob|raw)\/)?(.+?\/.+)/i;
    var devDomain = 'rawgit.com';
    var tests_url = entity.git_repo + path.join('/blob/master/', entity.api_folder, '/test');
    var tests_proxyPath = tests_url.replace(REGEX_REPO_URL, '/$2/$3/$4');

    var testPath = '/v1/o/:org/e/:env/samples/' + entity.name + '/tests';
    console.log("Registering " + entity.name + ' tests with express router..');
    app.use(testPath, proxy(devDomain, {
        forwardPath: function (req, res) {
            console.log('Test Request received');
            console.log(tests_proxyPath + req.url);
            return tests_proxyPath + req.url
        }
    }));
    try {
        var readmeurl = entity.git_repo + path.join('/blob/master/', entity.api_folder, 'README.md');
        var readme_newurl = readmeurl.replace(REGEX_REPO_URL, 'https://' + devDomain + '/$2/$3/$4');
        request(readme_newurl, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var content = markdown.toHTML(body);
                entity.long_description = content;
            }
            callback(false, entity);
        })
    } catch (err) {
        console.log('README was not found');
        console.log(err);
        callback(false, entity);
    }
}
