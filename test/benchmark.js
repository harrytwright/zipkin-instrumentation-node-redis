const redis = require('redis')
const zipkinClient = require('../src/zipkinClient')
const { Tracer, ExplicitContext, ConsoleRecorder } = require('zipkin')

function createTracer () {
  const ctxImpl = new ExplicitContext();
  const recorder = new ConsoleRecorder(() => { });
  const tracer = new Tracer({ ctxImpl, recorder });
  tracer.setId(tracer.createRootId());

  return tracer
}

function formatNumber(number) {
  return String(number)
    .replace(/\d{3}$/, ',$&')
    .replace(/^(\d|\d\d)(\d{3},)/, '$1,$2')
}

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
}

const client = redis.createClient(redisOptions)
const zipkin = zipkinClient({
  tracer: createTracer()
}).createClient(redisOptions)

const { Suite } = require('benchmark')

const suite = new Suite('redis')

suite.add('redis', (deferred) => {
  client.set('key', 'redis', () => { deferred.resolve() })
}, { defer: true }).add('zipkin/redis', (deferred) => {
  zipkin.set('key', 'zipkin', () => { deferred.resolve() })
}, { defer: true }).on('cycle', event => {
  let name = event.target.name.padEnd('zipkin/redis  '.length)
  let hz = formatNumber(event.target.hz.toFixed(0)).padStart(10)
  process.stdout.write(`${name}${hz} ops/sec\n`)
}).on('complete', function() {
  client.quit()
  zipkin.quit()
}).run({ 'async': true });
