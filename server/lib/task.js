/**
 * Created by siriscac on 16/08/16.
 */

var proxy = require('./sample');
var baas = require('./baas');
var constants = require('./../constants/constants');

function buildQuery(user_id, org) {
    if (user_id != null && org != null) {
        return "select * where user.user_id='" + user_id + "' and org='" + org + "'";
    } else if (user_id != null && org == null) {
        return "select * where user.user_id='" + user_id + "'";
    } else if (user_id == null && org != null) {
        return "select * where org='" + org + "'";
    } else {
        return "";
    }
}

function createTask(sample, org, env, status, user, type, callback) {
    var data = {
        sample: sample,
        org: org,
        env: env,
        status: status,
        user: user,
        task: type
    };

    baas.post(constants.TASKS, data, callback);
}

function updateTask(sample, org, env, status, user, type, id, callback) {
    var data = {
        sample: sample,
        org: org,
        env: env,
        status: status,
        user: user,
        task: type
    };

    baas.put(constants.TASKS, data, id, callback);
}

function getTasks(user_id, org, callback) {
    baas.get(constants.TASKS, buildQuery(user_id, org), callback);
}

module.exports = {
    createTask: createTask,
    updateTask: updateTask,
    getTasks: getTasks
};

