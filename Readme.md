# zipkin-instrumentation-node-redis

> This is a small experimental re-write of the original [zipkin-instrumentation-redis](https://github.com/openzipkin/zipkin-js/blob/master/packages/zipkin-instrumentation-redis)

This library will wrap the now old [redis < V4](https://github.com/NodeRedis/node-redis/tree/v3.1) not just the client itself

## Usage

```javascript
const { Tracer, ExplicitContext, ConsoleRecorder } = require('zipkin');

const tracer = new Tracer({
  ctxImpl: new ExplicitContext(), // implicit in-process context
  recorder: new ConsoleRecorder(), // batched http recorder
  localServiceName: 'tester' // name of this application
});

// This will work just like the redis object called by `require('redis')`
const redis = require('zipkin-instrumentation-node-redis')({ tracer })

const client = redis.createClient()
client.set('key', 'value', redis.print)
client.set('get', 'value', redis.print)
```
