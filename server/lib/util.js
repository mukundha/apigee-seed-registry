/**
 * Created by siriscac on 16/08/16.
 */

var shelljs = require('shelljs'),
    rimraf = require('rimraf');

function getDeploymentID() {
    function uuid() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return uuid() + uuid() + '-' + uuid() + '-' + uuid() + '-' + uuid() + '-' + uuid() + uuid() + uuid();
}

function removeClonedRepo(appBasePath, basePath) {
    console.log('Removing directory: ' + basePath);
    shelljs.cd(appBasePath);
    rimraf(basePath, function (error) {
        console.log(error)
    });
}

module.exports = {
    getDeploymentID: getDeploymentID,
    removeClonedRepo: removeClonedRepo
};