const http = require("http");
const fs = require("fs");
const path = require("path");
require('whatwg-fetch')
const imageSearch = require('image-search-google');
const express = require("express");   /* Accessing express module */
const bodyParser = require("body-parser"); /* To handle post parameters */
const app = express();  /* app is a request handler function */

require("dotenv").config({ path: path.resolve(__dirname, '.env') });

const { MongoClient, ServerApiVersion } = require('mongodb');
const { resourceLimits } = require("worker_threads");
const dbColl = {db: process.env.MONGO_DB_NAME, collection:process.env.MONGO_COLLECTION};
const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const uri = `mongodb+srv://${userName}:${password}@cluster0.ktavfgp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const imageClient = new imageSearch(process.env.SEARCH_ENGINE_ID, process.env.API_KEY);
const options = {page:1};

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + '/'));
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

if (process.argv.length != 3) {
  process.stdout.write(`Usage node taskApp.js PORT_NUMBER_HERE`);
  process.exit(1);
}

const portNumber = process.argv[2];
app.listen(portNumber);
process.stdout.write("Web server started and running at http://localhost:" + String(portNumber) + "\n");

let quotes = JSON.parse(fs.readFileSync("quotes.json"));

function getQuote() {
  let num = Math.floor(Math.random() * quotes.length);
  return quotes[num];
}

app.get("/", async (request, response) => {
  let cursor, result, count;
  try {
    await client.connect();
    cursor = await client.db(dbColl.db)
    .collection(dbColl.collection)
    .find();
    result = await cursor.toArray();
  } catch (e) {
      console.error(e);
  } finally {
      await client.close();
  }

  let htmlStr = "";
  htmlStr = result.reduce((res, elem) => res += `<tr><td><img src="${elem.url}"/></td><td>${elem.description}</td><td>${elem.completeBy}</td></tr>`, htmlStr);
  response.render("index.ejs", {data:htmlStr})
});

app.post("/addingTask", async (request, response) => {
  let {description, completeBy} = request.body;

  // getting image
  let res;
  try {
    res = await imageClient.search(description, options);
  } catch (e) {
    console.log(e);
  }
  
  let [{url}] = res;
  let variables = {
    description: description, 
    completeBy: completeBy,
    url: url
  };
  try {
    await client.connect();
    await insertInfo(client, variables);
  } catch (e) {
      console.error(e);
  } finally {
      await client.close();
  }
  let inspire = getQuote();
  response.render("addingTask.ejs", inspire);
});

async function insertInfo(client, variables) {
  const result = await client.db(dbColl.db).collection(dbColl.collection).insertOne(variables);
}

app.post("/deleteAll", async (request, response) => {
  let result;
  try {
    await client.connect();
    result = await client.db(dbColl.db)
    .collection(dbColl.collection)
    .deleteMany({});
  } catch (e) {
      console.error(e);
  } finally {
      await client.close();
  }
  
  response.render("index.ejs", {data:""});
});


process.stdout.write("Stop to shutdown the server: ");
process.stdin.on("readable", function () {
  let command = process.stdin.read();
  if (command !== null) {
    command = String(command).trim();
    if (command === "stop" || command === "Stop") {
      process.stdout.write("Shutting down the server\n");
      process.exit(0);
    }
    process.stdin.resume();
  }
});