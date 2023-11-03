const express = require("express");
const webpack = require("webpack");
const fs = require("node:fs");
const { Observable, Subject } = require("rxjs");
const { exhaustMap } = require("rxjs/operators");
const path = require("node:path");
const webpackDevMiddleware = require("webpack-dev-middleware");

const app = express();
const config = require("./webpack.config.js");
const compiler = webpack(config);
const storagePath = path.join(process.cwd(), "storage.json");

// Tell express to use the webpack-dev-middleware and use the webpack.config.js
// configuration file as a base.
app.use(
  webpackDevMiddleware(compiler, {
    publicPath: config.output.publicPath,
  })
);
app.use(express.json());

const onUpdate = new Subject();

onUpdate
  .pipe(
    exhaustMap((data) => {
      return writeStorage(data);
    })
  )
  .subscribe();

app.get("/load", (req, res) => {
  readStorage().subscribe((data) => {
    res.json(JSON.parse(data));
  });
});

app.post("/update", (req, res) => {
  onUpdate.next(req.body);
  res.json({ success: true });
});

// Serve the files on port 3000.
app.listen(3000, function () {
  console.log("Example app listening on port 3000!\n");
});

function readStorage() {
  return new Observable((subscriber) => {
    const abortController = new AbortController();
    subscriber.add(() => abortController.abort());
    fs.readFile(
      storagePath,
      { signal: abortController.signal },
      (err, data) => {
        if (err) {
          subscriber.error(err);
        } else {
          subscriber.next(data);
          subscriber.complete();
        }
      }
    );
  });
}

function writeStorage(data) {
  return new Observable((subscriber) => {
    const abortController = new AbortController();
    subscriber.add(() => abortController.abort());
    fs.writeFile(
      storagePath,
      JSON.stringify(data),
      { signal: abortController.signal },
      (err) => {
        if (err) {
          subscriber.error(err);
        } else {
          subscriber.next();
          subscriber.complete();
        }
      }
    );
  });
}
