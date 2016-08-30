/**
 * Created by mukundha on 28/08/16.
 */

var express = require('express');
var git = require('gulp-git');
var fs = require('fs');
var path = require('path');
var markdown = require("markdown").markdown;
var exec = require('child_process').exec;

var constants = require('./constants/constants');
var deployment = require('./lib/deployment');

var baseFolder = path.join('.', 'data');

module.exports = {
    deploy: function (org, env, sample, token, res) {
        var status = constants.STATUS_SUCCESS;
        var cwd = path.join(baseFolder, sample.name, sample.api_folder);
        var cmd = 'gulp deploy --org ' + org + ' --env ' + env + ' --token ' + token;
        var deployProcess = exec(cmd, {cwd: cwd});

        deployProcess.stdout.on('data', function (data) {
            console.log(data);
            res.write(data);
        });

        deployProcess.stderr.on('data', function (data) {
            console.log('stderr: ' + data.toString());
            status = constants.STATUS_FAILURE;
            res.write(data);
        });

        deployProcess.on('exit', function (code) {
            console.log('child process exited with code ' + code.toString());
            deployment.createDeployment(sample, org, env, constants.STATUS_SUCCESS, function (error, entities) {
                res.end("Deployment Completed");
            });
        });
    },

    createEntry: function (app, entity, callback) {
        var samplePath = path.join(baseFolder, entity.name);
        console.log(samplePath);
        git.clone(entity.git_repo, {args: samplePath}, function (gitError) {
            if (!gitError) {
                //TODO: Check for README.md absence
                var readme = path.join(samplePath, 'README.md');
                var content = fs.readFileSync(readme).toString();

                entity.long_description = markdown.toHTML(content);

                var cmd = 'npm install';
                var execPath = path.join(samplePath, entity.api_folder);

                exec(cmd, {cwd: execPath}, function (execError, stdin, stdout) {
                    if (!execError) {
                        console.log('npm install success');
                        var testPath = '/v1/o/:org/e/:env/samples/' + entity.name + '/tests';
                        console.log(testPath);
                        console.log(samplePath + '/test');
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
};
