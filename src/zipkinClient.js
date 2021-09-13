// A rewrite of https://github.com/openzipkin/zipkin-js/blob/master/packages/zipkin-instrumentation-redis/src/zipkinClient.js
// and mixed w/ node-redis < V4

const { Annotation, InetAddress, Tracer } = require('zipkin')
const redis = require('redis/dist/lib/client')
const multi = require('redis/dist/lib/multi-command')
const { extendWithDefaultCommands } = require('redis/dist/lib/commander')

/**
 * @param {Object} data
 * @param {Tracer} data.tracer
 * @param {string} [data.remoteServiceName]
 * @param {string} [data.serviceName]
 *
 * @returns {Function}
 * */
module.exports = ({ tracer, remoteServiceName = 'redis', serviceName = tracer.localEndpoint.serviceName }) => {
  return function (options) {
    const impl = redis.default.commandsExecutor
    redis.default.commandsExecutor = async function (command, args) {
      const originalId = tracer.id

      return new Promise((resolve, reject) => {
        const id = tracer.createChildId()
        tracer.letId(id, () => {
          // Patchy but works ??
          commonAnnotations(command.transformArguments(args)[0].toLowerCase())
        })

        impl.apply(this,[command, args]).then((...responses) => {
          tracer.letId(id, () => {
            tracer.recordAnnotation(new Annotation.ClientRecv())
          })
          tracer.letId(originalId, () => {
            resolve(...responses)
          })
        }).catch(err => {
          tracer.letId(id, () => {
            tracer.recordBinary('error', err.message || /* istanbul ignore next */ String(err))
            tracer.recordAnnotation(new Annotation.ClientRecv())
          })

          tracer.letId(originalId, () => {
            reject(err)
          })
        })
      })
    }

    const weakMap = new WeakMap([])
    const addCmdImpl = multi.default.prototype.addCommand
    multi.default.prototype.addCommand = function (args, transformReply) {
      // Just so we can get the commands binary
      if (!weakMap.has(this)) { weakMap.set(this, []) }
      weakMap.get(this).push(args[0])

      return addCmdImpl.apply(this, [args, transformReply])
    }

    const multiImpl = multi.default.prototype.exec
    multi.default.prototype.exec = async function(execAsPipeline = false) {
      const originalId = tracer.id

      const self = this;
      return new Promise((resolve, reject) => {
        const id = tracer.createChildId()
        tracer.letId(id, () => {
          // Patchy but works ??
          commonAnnotations('multi')
          tracer.recordBinary('commands', JSON.stringify(weakMap.get(self)))
        })

        multiImpl.apply(this,[execAsPipeline]).then((...responses) => {
          tracer.letId(id, () => {
            tracer.recordAnnotation(new Annotation.ClientRecv())
          })
          tracer.letId(originalId, () => {
            resolve(...responses)
          })
        }).catch(err => {
          tracer.letId(id, () => {
            tracer.recordBinary('error', err.message || /* istanbul ignore next */ String(err))
            tracer.recordAnnotation(new Annotation.ClientRecv())
          })

          tracer.letId(originalId, () => {
            reject(err)
          })
        })
      })
    }

    // Seems to be a way around??
    extendWithDefaultCommands(redis.default, redis.default.commandsExecutor)
    extendWithDefaultCommands(multi.default, multi.default.commandsExecutor)

    function commonAnnotations (rpc) {
      tracer.recordRpc(rpc)
      tracer.recordAnnotation(new Annotation.ServiceName(serviceName))
      tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: remoteServiceName,
        host: new InetAddress(options?.socket?.host || '127.0.0.1'), // This is a guess work
        port: options?.socket?.port || 6379
      }))
      tracer.recordAnnotation(new Annotation.ClientSend())
    }

    return redis.default.create(options)
  }
}
