const CLSContext = require('zipkin-context-cls')

const supertest = require('supertest')
const zipkinClient = require('../src/zipkinClient')

const { expectCorrectSpanData, createTracer } = require('./utils/tracer')

const socket = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
}

function redis (tracer, options) {
  return zipkinClient({ tracer, ...options })
}

describe('express', function () {
  let client, server, logSpan

  beforeEach(async () => {
    logSpan = jest.fn()
  })

  afterEach(async () => {
    if (client) {
      await client.flushDb()
      await client.quit()
    }

    if (server) {
      await new Promise((resolve, reject) => {
        server.close(err => {
          if (err) return reject(err)
          return resolve()
        })
      })
    }
  })

  /**
   * This is to prove that when using promises this new will not work w/o CLSContext
   *
   * https://github.com/openzipkin/zipkin-js/tree/master/packages/zipkin-context-cls#a-note-on-cls-context-and-promises
   * */
  it('will not work with explicit', async function () {
    // We have to use cls here or it fails maybe ??
    const tracer = createTracer(logSpan)

    client = redis(tracer, { listArgs: true })({ socket })
    await client.connect()

    const app = require('./utils/express')(tracer, client)
    server = app.listen()

    const request = supertest.agent(server)

    await request.get('/express?value=explicit')
      .expect(200)

    expect(logSpan).toHaveBeenCalled()

    const spans = logSpan.mock.calls.map(arg => arg[0])
    expect(spans).toHaveLength(3)

    // Remove the express one for the test
    const expressSpan = spans.pop()

    // This is hella messy lmao
    //
    // Basically the first span will be correct with the right parent
    // but the subsequent spans will have a random parentId
    //
    // See https://github.com/openzipkin/zipkin-js/tree/master/packages/zipkin-context-cls#a-note-on-cls-context-and-promises
    spans.forEach((span, idx) => expectCorrectSpanData(expect)({
      parentId: expressSpan.traceId,
      toNot: (idx !== 0),
      span
    }))
  })

  it('should work with async cls', async function () {
    // We have to use cls here or it fails maybe ??
    const tracer = createTracer(logSpan, new CLSContext('zipkin', true))

    client = redis(tracer, { listArgs: true })({ socket })
    await client.connect()

    const app = require('./utils/express')(tracer, client)
    server = app.listen()

    const request = supertest.agent(server)

    await request
      .get('/express?value=cls')
      .expect(200)

    expect(logSpan).toHaveBeenCalled()

    const spans = logSpan.mock.calls.map(arg => arg[0])
    expect(spans).toHaveLength(3)

    // Remove the express one for the test
    const expressSpan = spans.pop()

    spans.forEach((span) => expectCorrectSpanData(expect)({
      parentId: expressSpan.traceId,
      span
    }))
  })
})
