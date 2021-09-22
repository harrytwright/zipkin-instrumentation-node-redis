const chai = require('chai')
const sinon = require('sinon')

const zipkinClient = require('../src/zipkinClient')

const { expectCorrectSpanData, createTracer } = require('./utils/tracer')

const expect = chai.expect

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
}

function redis (tracer, options) {
  return zipkinClient({ tracer, ...options })
}

describe('redis', function () {
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

        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(1)
        spans.forEach((span) => expectCorrectSpanData(expect)({
          command: 'set',
          span
        }))

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

        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(1)
        spans.forEach((span) => expectCorrectSpanData(expect)({
          command: 'expire',
          span
        }))

        done()
      })
    })
  });

  it('should handle custom commands', function (done) {
    const logSpan = sinon.spy();

    const tracer = createTracer(logSpan)
    const rds = redis(tracer)

    ;['json.get', 'json.set'].forEach(function (aCmd) {
      rds.addCommand(aCmd)
    })

    client = rds.createClient(redisOptions)
    client.on('connect', () => {
      client.json_set('test:redis:json.zipkin', '.', JSON.stringify({ hello: 'world' }), (err, result) => {
        if (err) return expect.fail(err.message)

        expect(result).to.be.equal('OK')

        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(1)
        spans.forEach((span) => expectCorrectSpanData(expect)({
          command: 'json.set',
          span
        }))

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

        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(1)
        spans.forEach((span) => expectCorrectSpanData(expect)({
          multi: ['set', 'expire', 'ttl'],
          command: 'multi',
          span,
        }))

        done()
      })
    })
  });
});
