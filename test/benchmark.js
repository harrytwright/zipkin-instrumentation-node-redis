(async () => {
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

  const socket = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379
  }

  const client = redis.createClient({ socket })
  const zipkin = zipkinClient({
    tracer: createTracer()
  })({ socket })

  await client.connect()
  await zipkin.connect()

  const { Suite } = require('benchmark')

  const suite = new Suite('redis')

  suite.add('redis', (deferred) => {
    client.set('key', 'redis').finally(() => deferred.resolve())
  }, { defer: true }).add('zipkin/redis', (deferred) => {
    zipkin.set('key', 'zipkin').finally(() => deferred.resolve())
  }, { defer: true }).on('cycle', event => {
    let name = event.target.name.padEnd('zipkin/redis  '.length)
    let hz = formatNumber(event.target.hz.toFixed(0)).padStart(10)
    process.stdout.write(`${name}${hz} ops/sec\n`)
  }).on('complete', function() {
    client.quit().finally(() => zipkin.quit())
  }).run({ 'async': true });

})()
