# zipkin-instrumentation-node-redis

[![Node.js CI](https://github.com/harrytwright/zipkin-instrumentation-node-redis/actions/workflows/node.js.yml/badge.svg)](https://github.com/harrytwright/zipkin-instrumentation-node-redis/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/harrytwright/zipkin-instrumentation-node-redis/branch/master/graph/badge.svg?token=1613IK40YF)](https://codecov.io/gh/harrytwright/zipkin-instrumentation-node-redis)

> This is a small experimental re-write of the original [zipkin-instrumentation-redis](https://github.com/openzipkin/zipkin-js/blob/master/packages/zipkin-instrumentation-redis)

This library will wrap the now [redis V4](https://github.com/NodeRedis/node-redis) client

## Installation

For the new promises based `node-redis`

```shell
npm install zipkin-instrumentation-node-redis
```

For the <=v3.1 node-redis

```shell
npm install zipkin-instrumentation-node-redis@legacy
```

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

## Replacing `redis`

> Please note that due the new version is not a straight swap like `@legacy`

1. Replace the imports and `.createClient()` call

```diff
- const redis = require('redis');
- const client = redis.createClient();
+ const createClient = require('zipkin-instrumentation-node-redis')({ tracer })
+ const client = createClient()
```

2. Use the client

```javascript
await client.connect();
...
```

## Benchmark

> Due to the proxying nature of the way zipkin works there is a slight discrepancy with performance.
> 
> In this case zipkin was faster but not by much

Function calling time:

```shell
$ node ./test/benchmark.js
redis             10,457 ops/sec
zipkin/redis      11,532 ops/sec
```

The space in node_modules including sub-dependencies:

> New redis is now exponentially larger than the older version

```shell
$ node ./test/size.js
redis@next                                 2560 KB
zipkin-instrumentation-node-redis          2662.4 KB
zipkin-instrumentation-node-redis@legacy   400 KB
zipkin-instrumentation-redis               724 KB
```

Test configuration:
```shell
$ uname -a
Darwin 2015-MBP 19.6.0 Darwin Kernel Version 19.6.0: <DATE> x86_64
$ node --version
v16.2.0
```
