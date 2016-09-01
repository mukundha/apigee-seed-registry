/**
 * Created by siriscac on 16/08/16.
 */

var baas = require('./baas');
var constants = require('./../constants/constants');

function createUser(data, callback) {
    baas.post(constants.USERS, data, callback);
}

function fetchUser(email, callback) {
    baas.get(constants.USERS, "select * where email='" + email + "'", callback);
}

function updateUser(data, id, callback) {
    baas.put(constants.USERS, data, id, callback);
}

module.exports = {
    createUser: createUser,
    fetchUser: fetchUser,
    updateUser: updateUser
};
