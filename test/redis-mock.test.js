/**
 * This is for a use-case when using redis-mocked globally, since we work differently to the
 * way the original instrumentation works, we need to know when we're in a mock
 * */

const chai = require('chai')
const sinon = require('sinon')
const proxyquire =  require('proxyquire')

let mock;
try {
  mock = require('redis-mock')
} catch (e) {
  console.warn('No Mock installed exiting')
  return
}

const zipkinClient = proxyquire('../src/zipkinClient', {
  'redis': require('redis-mock')
})

const { createTracer } = require('./utils/tracer')

const expect = chai.expect

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
}

function redis (tracer, options) {
  return zipkinClient({ tracer, ...options })
}

describe('redis-mock', function () {
  let client;

  afterEach((done) => {
    if (!!client) {
      return client.flushdb(() => {
        client.quit(done)
      })
    }
    done()
  })

  it('should add zipkin annotations', function (done) {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer).createClient(redisOptions)
    client.on('connect', () => {
      client.set('test:redis:add.zipkin', 'Hello World', (err, result) => {
        if (err) return expect.fail(err.message)

        expect(result).to.be.equal('OK')
        done()
      })
    })
  });

  it('should handle redis errors', function (done) {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer).createClient(redisOptions)
    client.on('connect', () => {
      client.expire('test:redis:error.zipkin', 'NaN', (err, result) => {
        expect(err).to.not.be.undefined
        done()
      })
    })
  });

  it('should handle multi', function (done) {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)

    client = redis(tracer).createClient(redisOptions)
    client.on('connect', () => {
      const multi = client.multi()
      multi.set('test:redis:multi.zipkin', 'Hello World')
      multi.expire('test:redis:multi.zipkin', (60 * 60 * 24 * 7))
      multi.ttl('test:redis:multi.zipkin')

      multi.exec((err, results) => {
        if (err) return expect.fail(err.message)

        expect(results).to.be.length(3)
        done()
      })
    })
  });
});
