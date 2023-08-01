(async () => {
  const express = require('express')
  const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

  const { HttpLogger } = require('zipkin-transport-http');
  const Context  = require('zipkin-context-cls')

  const { Tracer, BatchRecorder, jsonEncoder: { JSON_V2 } } = require('zipkin')

  const recorder = new BatchRecorder({
    logger: new HttpLogger({
      endpoint: 'http://localhost:9411/api/v2/spans', // Required
      jsonEncoder: JSON_V2
    })
  })

  const tracer = new Tracer({
    ctxImpl: new Context('zipkin', true), // cls context
    recorder: recorder, // batched http recorder
    localServiceName: 'example' // name of this application
  });

  const client = require('../src/zipkinClient')({ tracer, listArgs: true })(
    { socket: { port: process.env.REDIS_PORT, host: process.env.REDIS_HOST } }
  )

  await client.connect();

  const app = express()

  app.use(zipkinMiddleware({ tracer, port: 3000 }))

  const cache = async (req, res, next) => {
    const key = req.params.key;

    const result = await client.get(key)
    Object.defineProperty(req, '__cache_value', { get: () => result });
    return next()
  }

  app.get('/:key', cache, async (req, res, next) => {
    const key = req.params.key;
    const value = req.query.value;

    if (value && value !== req.__cache_value) {
      const reply = await client.set(key, value);
      return res.status(200).send(reply).end()
    }

    return res.status(200).send(req.__cache_value).end()
  })

  app.listen(4050, () => {
    console.log('Starting at 3000')
  })

})()
