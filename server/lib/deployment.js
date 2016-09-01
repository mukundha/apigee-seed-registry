/**
 * Created by siriscac on 16/08/16.
 */

var shelljs = require('shelljs');
var rimraf = require('rimraf');
var _util = require('./util');
var fs = require('fs');
var proxy = require('./sample');

var constants = require('./../constants/constants');
var baas = require('./baas');

// function getMakeScript(proxy_name) {
//     return "apigeetool deployproxy -o $org -e $env --api '" + proxy_name + "' -t $token";
// }
//
// function deploy(proxy_id, org, env, appBasePath, token, res) {
//     sample.fetchProxy(proxy_id, function (error, entities) {
//         if (!error) {
//             var sample = entities[0];
//             initiateDeployment(sample, org, env, appBasePath, token, res);
//         }
//     });
// }
//
// function initiateDeployment(sample, org, env, appBasePath, token, res) {
//     var deploymentID = _util.getDeploymentID();
//     var nodeBasePathBuild = path.join('../../public/builds/', deploymentID);
//
//     shelljs.exec("git clone " + sample.git_repo + " " + nodeBasePathBuild, function (code, op) {
//         console.log("Exit:", code);
//         res.write("Code : " + code + "\n");
//         console.log('Program output:', op);
//         res.write(op + "\n");
//         shelljs.cd(nodeBasePathBuild + "/" + sample.api_folder);
//
//         var execStr = ' token=' + token + ' env=' + env + ' org=' + org + ' UUID=' + deploymentID +
//             ' sh -c \'sh ' + getMakeScript(sample.id) + '\'';
//
//         res.write("============= Initiating Deployment =============\n");
//
//         var output = shelljs.exec(execStr, {async: true});
//
//         output.stdout.on('data', function (data) {
//             res.write(data);
//         });
//         output.stdout.on('end', function (code) {
//             console.log(code);
//             res.write('============= Deployment Completed =============\n');
//             setTimeout(_util.removeClonedRepo, 3600000, appBasePath, nodeBasePathBuild);
//             createDeployment(sample, org, env, constants.STATUS_SUCCESS, function (error, entities) {
//                 res.end();
//             });
//         });
//         output.stderr.on('data', function (code) {
//             res.write(code);
//         });
//     });
// }

function buildQuery(user_id, proxy_id) {
    if (user_id != null && proxy_id != null) {
        return "select * where user.user_id='" + user_id + "' and proxy.uuid='" + proxy_id + "'";
    } else if (user_id != null && proxy_id == null) {
        return "select * where user.user_id='" + user_id + "'";
    } else if (user_id == null && proxy_id != null) {
        return "select * where proxy.uuid='" + user_id + "'";
    } else {
        return "";
    }
}

function createDeployment(proxy, org, env, status, user, callback) {
    var data = {
        proxy: proxy,
        org: org,
        env: env,
        status: status,
        user: user
    };

    baas.post(constants.DEPLOYMENTS, data, callback);
}

function getDeployments(user_id, proxy_id, callback) {
    baas.get(constants.DEPLOYMENTS, buildQuery(user_id, proxy_id), callback);
}

module.exports = {
    createDeployment: createDeployment,
    //initiateDeployment: initiateDeployment,
    //deploy: deploy,
    getDeployments: getDeployments
};

