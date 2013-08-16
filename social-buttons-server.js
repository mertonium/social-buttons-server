// Social Buttons Server

var express = require("express");
var request = require("superagent");
var _ = require("lodash");
var async = require("async");

var app = express();
app.use(express.logger());

var cacheTime = 4; // How many minutes should we cache the results for a given request

app.all('/*', function(req, res, next) {
  // Allow the request to be pulled cross domain
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  // Setup caching headers (works well with cloudfront)
  res.setHeader("Expires", new Date(Date.now() + cacheTime * 60 * 1000).toUTCString());
  next();
});


app.get('/', function(req, res) {

  var networks,url;

  // Check to see if any networks were specified in the query
  if(typeof req.query.networks === 'undefined') {
    res.send({error: 'You have to specify which networks you want stats for (networks=facebook,twitter,googleplus)'});
    return;
  }
  networks = req.query.networks;

  // Check to see if a url was specified in the query else attempt to use the referer url
  if(typeof req.query.url !== 'undefined') {
    url = req.query.url;
  } else {
    url = req.header('Referer');
    if(typeof url === 'undefined') {
      res.send({error: 'You asked for the referring urls stats but there is no referring url, try specify one manually (&url=http://1984day.com)'});
      return;
    }
  }
  // Create an object of callbacks for each of the requested networks
  // It is then passed to the async library to executed in parallel 
  // All results will be sent to the browser on completion.
  var networksToRequest = {};
  _.each(networks.split(','), function(network){
    if(typeof networkCallbacks[network] !== 'undefined') {
      networksToRequest[network] = function (callback) {
        networkCallbacks[network](url, callback);
      }
    }
  });
  async.parallel(networksToRequest, function (err, results) {
    res.send(results);
  });
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

var networkCallbacks = {
  twitter: function(url, callback) {
    // Twitter is nice and easy
    var apiUrl = "http://urls.api.twitter.com/1/urls/count.json?url=" + url;
    request.get(apiUrl)
      .set('Accept', 'application/json')
      .end(function(data){
        var count = data.body.count;
        callback(null, count);
      });
  },
  facebook: function(url, callback){
  // This query string gets the total number of likes, shares and comments to create the final count
  var apiUrl = "https://graph.facebook.com/?id="+url;
  request.get(apiUrl)
    .set('Accept', 'application/json')
    .end(function(data){
      var count;
      if(data.body.shares) {
        count = data.body.shares;
      } else {
        count = 0;
      }
      callback(null, count);
    });
  },
  googleplus: function(url, callback){
    // This is a hacky method found on the internet because google doesn't have an API for google plus counts
    var apiUrl = "https://plusone.google.com/_/+1/fastbutton?url=" + url;
    request.get(apiUrl)
      .end(function(data){
        var reg = /__SSR \= \{c\: (.*?)\.0/g
        var result = reg.exec(data.text);
        var count;
        if(result) {
          count = result[1]*1;
        } else {
          count = 0;
        }
        callback(null, count);
      });
  } 
};