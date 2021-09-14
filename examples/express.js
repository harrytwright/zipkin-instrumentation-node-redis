const CLSContext = require('zipkin-context-cls')
const { HttpLogger } = require('zipkin-transport-http')
const { expressMiddleware } = require('zipkin-instrumentation-express')
const { Tracer, BatchRecorder, jsonEncoder: { JSON_V2 } } = require('zipkin');

const express = require('express')

const tracer = new Tracer({
  ctxImpl: new CLSContext('zipkin'), // implicit in-process context
  recorder: new BatchRecorder({
    logger: new HttpLogger({
      endpoint: 'http://localhost:9411/api/v2/spans',
      jsonEncoder: JSON_V2
    })
  }), // batched http recorder
  localServiceName: 'tester' // name of this application
});

// This will work just like the redis object called by `require('redis')`
const redis = require('../src/zipkinClient')({ tracer })
const client = redis.createClient()

const app = express()

app.use(expressMiddleware({ tracer, port: 3000 }))

app.get('/:key', (req, res, next) => {
  const key = req.params.key;
  client.get(key, (err, result) => {
    if (err) return next(err);
    Object.defineProperty(req, '__cache_result', { get: () => result })
    next()
  })
}, (req, res, next) => {
  const key = req.params.key;
  const query = req.query.value;

  if (query && query !== req.__cache_result) {
    return client.set(key, query, (err, result) => {
      if (err) return next(err);
      return res.status(200).send(result).end()
    })
  }

  return res.status(200).send(req.__cache_result).end()
})

app.listen(3000, () => console.log('Listening on 3k'))
