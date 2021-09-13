(async () => {
  const { Tracer, ExplicitContext, ConsoleRecorder } = require('zipkin')

  const tracer = new Tracer({
    ctxImpl: new ExplicitContext(), // implicit in-process context
    recorder: new ConsoleRecorder(), // batched http recorder
    localServiceName: 'tester' // name of this application
  });


  const client = require('./src/zipkinClient')({ tracer })(
    { socket: { port: process.env.REDIS_PORT, host: process.env.REDIS_HOST } }
  )
  await client.connect();

  // const results = await client.multi()
  //   .set('key', 'value')
  //   .get('key')
  //   .exec()

  const results = await client.set('key', 'value')

  console.log(results)

  await client.quit()
})()
