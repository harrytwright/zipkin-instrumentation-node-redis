module.exports = (tracer, client) => {
  const express = require('express')
  const expressMiddleware = require('zipkin-instrumentation-express').expressMiddleware

  const app = express()

  app.use(expressMiddleware({ tracer, port: 3000 }))

  app.get('/:key', async (req, res, next) => {
    const key = req.params.key

    const result = await client.get(key)
    Object.defineProperty(req, '__cache_value', { get: () => result })
    return next()
  }, async (req, res, next) => {
    const key = req.params.key
    const value = req.query.value

    if (value && value !== req.__cache_value) {
      const reply = await client.set(key, value)
      return res.status(200).send(reply).end()
    }

    return res.status(200).send(req.__cache_value).end()
  })

  return app
}
