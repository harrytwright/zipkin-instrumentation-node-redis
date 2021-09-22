const chai = require('chai')
const sinon = require('sinon')
const CLSContext = require('zipkin-context-cls')

const zipkinClient = require('../src/zipkinClient')

const { expectCorrectSpanData, createTracer } = require('./utils/tracer')

const expect = chai.expect

chai.use(require('chai-http'))

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
}

function redis (tracer, options) {
  return zipkinClient({ tracer, ...options })
}

describe('express', function () {

  let client;

  afterEach((done) => {
    if (!!client) {
      return client.flushdb(() => {
        client.quit(done)
      })
    }
    done()
  })

  it('should work with explicit', function (done) {
    const logSpan = sinon.spy();

    // We have to use cls here or it fails maybe ??
    const tracer = createTracer(logSpan)

    client = redis(tracer, { listArgs: true }).createClient(redisOptions)

    const app = require('./utils/express')(tracer, client)

    chai.request(app).get('/express?value=explicit').end( (err, res) => {
      if (err) {
        expect.fail(err.message);
        done()
      }

      expect(res).status(200)

      const spans = logSpan.args.map(arg => arg[0])
      expect(spans).to.have.length(3)

      // Remove the express one for the test
      const expressSpan = spans.pop()

      spans.forEach((span) => expectCorrectSpanData(expect)({
        parentId: expressSpan.traceId,
        span,
      }))

      done()
    })
  });

  it('should work with async cls', function (done) {
    const logSpan = sinon.spy();

    // We have to use cls here or it fails maybe ??
    const tracer = createTracer(logSpan, new CLSContext('zipkin', true))

    client = redis(tracer, { listArgs: true }).createClient(redisOptions)

    const app = require('./utils/express')(tracer, client)

    chai.request(app).get('/express?value=cls').end( (err, res) => {
      if (err) {
        expect.fail(err.message);
        done()
      }

      expect(res).status(200)

      const spans = logSpan.args.map(arg => arg[0])
      expect(spans).to.have.length(3)

      // Remove the express one for the test
      const expressSpan = spans.pop()

      spans.forEach((span) => expectCorrectSpanData(expect)({
        parentId: expressSpan.traceId,
        span,
      }))

      done()
    })
  });
});
