var request = require('request');
var config = require('../../config/config');

function buildBaseURI(collection, query, id) {
    if (query) {
        return config.baasBaseURL + config.baasOrg + "/" + config.baasApp + "/" + collection + "?client_id=" + config.baasClientID + "&client_secret=" + config.baasClientSecret + "&ql=" + query;
    } else if (id) {
        return config.baasBaseURL + config.baasOrg + "/" + config.baasApp + "/" + collection + "/" + id + "?client_id=" + config.baasClientID + "&client_secret=" + config.baasClientSecret;
    } else {
        return config.baasBaseURL + config.baasOrg + "/" + config.baasApp + "/" + collection + "?client_id=" + config.baasClientID + "&client_secret=" + config.baasClientSecret;
    }
}

module.exports = {

    del: function (collection, id, callback) {
        request({
                method: "DELETE",
                uri: buildBaseURI(collection, null, id)
            },
            function (error, response, body) {
                return callback(error, body != null ? JSON.parse(body).entities : body);
            });
    },

    get: function (collection, query, callback) {
        request({
                method: "GET",
                uri: buildBaseURI(collection, query, null)
            },
            function (error, response, body) {
                return callback(error, body != null ? JSON.parse(body).entities : body);
            });
    },

    post: function (collection, data, callback) {
        request({
                method: "POST",
                uri: buildBaseURI(collection, null, null),
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify(data)
            },
            function (error, response, body) {
                if (response.statusCode != 200)
                    callback(body);
                else
                    callback(null, JSON.parse(body).entities);
            });
    },

    put: function (collection, data, id, callback) {
        request({
                method: "PUT",
                uri: buildBaseURI(collection, null, id),
                headers: {
                    "content-type": "application/json"
                },
                body: data
            },
            function (error, response, body) {
                return callback(error, body != null ? body.entities : body);
            });
    }
};

