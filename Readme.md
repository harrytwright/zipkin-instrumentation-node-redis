# zipkin-instrumentation-node-redis

[![Node.js CI](https://github.com/harrytwright/zipkin-instrumentation-node-redis/actions/workflows/node.js.yml/badge.svg)](https://github.com/harrytwright/zipkin-instrumentation-node-redis/actions/workflows/node.js.yml)

> This is a small experimental re-write of the original [zipkin-instrumentation-redis](https://github.com/openzipkin/zipkin-js/blob/master/packages/zipkin-instrumentation-redis)

This library will wrap the now [redis V4](https://github.com/NodeRedis/node-redis) client

## Usage

```javascript
(async () => {
  const { Tracer, ExplicitContext, ConsoleRecorder } = require('zipkin')

  const tracer = new Tracer({
    ctxImpl: new ExplicitContext(), // implicit in-process context
    recorder: new ConsoleRecorder(), // batched http recorder
    localServiceName: 'tester' // name of this application
  });
  
  const client = require('zipkin-instrumentation-node-redis')({ tracer })()
  await client.connect();

  const results = await client.set('key', 'value')

  console.log(results) // OK

  await client.quit()
})()


```

### Express

#### PLEASE USE `CLSContext('name', true)` when using w/ express

Please see the express [example](/examples/express.js)
