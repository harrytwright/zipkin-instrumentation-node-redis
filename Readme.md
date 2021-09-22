# zipkin-instrumentation-node-redis

[![Node.js CI](https://github.com/harrytwright/zipkin-instrumentation-node-redis/actions/workflows/node.js.yml/badge.svg?branch=releases%2Flegacy)](https://github.com/harrytwright/zipkin-instrumentation-node-redis/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/harrytwright/zipkin-instrumentation-node-redis/branch/releases%2Flegacy/graph/badge.svg?token=1613IK40YF)](https://codecov.io/gh/harrytwright/zipkin-instrumentation-node-redis)

> This is a small experimental re-write of the original [zipkin-instrumentation-redis](https://github.com/openzipkin/zipkin-js/blob/master/packages/zipkin-instrumentation-redis)

This library will wrap the now old [redis < V4](https://github.com/NodeRedis/node-redis/tree/v3.1) not just the client itself

## Install

```shell
npm install zipkin-instrumentation-node-redis@legacy
```

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

## Replacing `redis`

1. Replace the imports and call the `createZipkin` function

```diff
- const redis = require('redis');
+ const redis = require('zipkin-instrumentation-node-redis')({ tracer });
```

2. Call the `createClient` method like before

```javascript
const client = redis.createClient()
```

## Benchmark

Due to the proxying nature of the way zipkin works there is a slight trade-off with performance.

```shell
$ node ./test/benchmark.js
redis             17,805 ops/sec
zipkin/redis      15,980 ops/sec
```

Test configuration:
```shell
$ uname -a
Darwin 2015-MBP 19.6.0 Darwin Kernel Version 19.6.0: <DATE> x86_64
$ node --version
v16.2.0
```
