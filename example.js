const zipkinClient = require('./src/zipkinClient');
const { Tracer, ExplicitContext, ConsoleRecorder } = require('zipkin');

const tracer = new Tracer({
  ctxImpl: new ExplicitContext(), // implicit in-process context
  recorder: new ConsoleRecorder(), // batched http recorder
  localServiceName: 'tester' // name of this application
});

// This will work just like the redis object called by `require('redis')`
const redis = zipkinClient({ tracer })

const client = redis.createClient()
client.set('key', 'value', redis.print)
client.set('get', 'value', redis.print)
