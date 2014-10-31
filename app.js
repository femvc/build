var index = require('./routes/index');
var express = require('express');
var app = express();

app.get('/helloworld', function (req, res) {
  res.send('Hello World!')
});

app.get('/', index.index);
app.get('/js', index.js);
app.get('/css', index.css);


var server = app.listen(8010, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);

})