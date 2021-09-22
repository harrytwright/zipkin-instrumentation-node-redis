module.exports = (tracer, client) => {
  const express = require('express')
  const { expressMiddleware } = require('zipkin-instrumentation-express')

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

  return app
}
