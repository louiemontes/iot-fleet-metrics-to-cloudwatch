/*
Log IoT Fleet Indexing Metrics to CloudWatch

Create in AWS Lambda for NodeJS 12.x

Execute every 5 minutes by creating a time-based CloudWatch Event / Amazon EventBridge routine.

Requires IAM roles:
- AWSLambdaBasicExecutionRole
- CloudWatchFullAccess
- AWSIoTFleetHubFederationAccess
*/

var AWS = require("aws-sdk");

const CUSTOM_NAMESPACE = "Custom";

const IOT_API_VERSION = "2015-05-28";
const CLOUDWATCH_API_VERSION = "2010-08-01";

Object.defineProperty(Array.prototype, "chunk", {
  value: function (chunkSize) {
    var that = this;
    return Array(Math.ceil(that.length / chunkSize))
      .fill()
      .map(function (_, i) {
        return that.slice(i * chunkSize, i * chunkSize + chunkSize);
      });
  },
});

exports.handler = async (event) => {
  var data = await searchIndex("connectivity.connected:true");
  var statsOn = await getStatistics("connectivity.connected:true");
  var statsOff = await getStatistics("connectivity.connected:false");

  await storeCloudWatch(statsOn.statistics, statsOff.statistics, data.things);

  //var out = {
  //    stats_online: statsOn.statistics,
  //    stats_offline: statsOff.statistics,
  //    things_online: data.things
  //};

  const response = {
    statusCode: 200,
    //    body: JSON.stringify(out),
  };
  return response;
};

async function storeCloudWatch(statsOn, statsOff, things) {
  var metrics = [];
  const timestamp = new Date();

  Object.entries(statsOn).forEach((entry) => {
    const [key, value] = entry;
    metrics.push({
      MetricName: key,
      Dimensions: [{ Name: "Connectivity", Value: "Connected" }],
      Value: value,
      Unit: "Count",
      StorageResolution: 60, // 1 minute
      Timestamp: timestamp,
    });
  });

  Object.entries(statsOff).forEach((entry) => {
    const [key, value] = entry;
    metrics.push({
      MetricName: key,
      Dimensions: [{ Name: "Connectivity", Value: "Disconnected" }],
      Value: value,
      Unit: "Count",
      StorageResolution: 60, // 1 minute
      Timestamp: timestamp,
    });
  });

  things.forEach(function (thing) {
    metrics.push({
      MetricName: "Alive",
      Dimensions: [{ Name: "Things", Value: thing.thingName }],
      Value: 1,
      Unit: "Count",
      StorageResolution: 60, // 1 minute
      Timestamp: timestamp,
    });
    metrics.push({
      MetricName: "Uptime Days",
      Dimensions: [{ Name: "Things", Value: thing.thingName }],
      Value:
        (new Date().getTime() - thing.connectivity.timestamp) / 86400 / 1000, // diff btw now and connect in days (not millisec)
      Unit: "Count",
      StorageResolution: 60, // 1 minute
      Timestamp: timestamp,
    });
  });

  // CloudWatch only accepts 20 metrics at a time. So be it.
  var metricChunks = metrics.chunk(20);

  const promise = new Promise(function (resolve, reject) {
    var numStarted = 0;
    var numFinished = 0;
    metricChunks.forEach(function (metricChunk) {
      numStarted += 1;
      var params = {
        MetricData: metricChunk,
        Namespace: CUSTOM_NAMESPACE + "/IoT",
      };
      var cloudwatch = new AWS.CloudWatch({
        apiVersion: CLOUDWATCH_API_VERSION,
      });
      var request = cloudwatch.putMetricData(params);
      request
        .on("success", function (response) {
          console.log(response.data);
        })
        .on("error", function (error, response) {
          console.error(error);
        })
        .on("complete", function (response) {
          numFinished += 1;
          if (numFinished == numStarted) {
            resolve(); // done
          }
        })
        .send();
    });
  });

  return promise;
}

async function getStatistics(query) {
  var params = {
    queryString: query,
  };
  const promise = new Promise(function (resolve, reject) {
    var iot = new AWS.Iot({ apiVersion: IOT_API_VERSION });
    var request = iot.getStatistics(params);
    request
      .on("success", function (response) {
        resolve(response.data);
      })
      .on("error", function (error, response) {
        reject(Error(error));
      })
      .send();
  });
  return promise;
}

async function searchIndex(query) {
  var params = {
    queryString: query,
  };
  const promise = new Promise(function (resolve, reject) {
    var iot = new AWS.Iot({ apiVersion: IOT_API_VERSION });
    var request = iot.searchIndex(params);
    request
      .on("success", function (response) {
        resolve(response.data);
      })
      .on("error", function (error, response) {
        reject(Error(error));
      })
      .send();
  });
  return promise;
}
