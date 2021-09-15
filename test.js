const { Tracer, ExplicitContext, ConsoleRecorder } = require('zipkin')

const tracer = new Tracer({
  ctxImpl: new ExplicitContext(), // implicit in-process context
  recorder: new ConsoleRecorder(), // batched http recorder
  localServiceName: 'tester' // name of this application
});


const createZipkin = require('./src/zipkinClient')
const createClient = createZipkin({
  tracer
})

createClient()
