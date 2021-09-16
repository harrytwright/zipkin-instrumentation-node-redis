// A rewrite of https://github.com/openzipkin/zipkin-js/blob/master/packages/zipkin-instrumentation-redis/src/zipkinClient.js
// and mixed w/ node-redis < V4

const { Annotation, InetAddress, Tracer } = require('zipkin')
const redis = require('redis/dist/lib/client')
const multi = require('redis/dist/lib/multi-command')
const { extendWithDefaultCommands } = require('redis/dist/lib/commander')

/**
 * @callback createClient
 *
 * @template M,S
 * @param {RedisClientOptions|undefined} [options]
 * @returns {RedisClient}
 * */

/**
 * @param {Object} data
 * @param {module::zipkin.Tracer} data.tracer -
 * @param {string} [data.remoteServiceName] -
 * @param {string} [data.serviceName] -
 * @param {boolean} [data.listArgs] -
 *
 * @returns {createClient}
 * */
module.exports = function createZipkin ({ tracer, remoteServiceName = 'redis', serviceName = tracer.localEndpoint.serviceName, listArgs = false }) {
  /**
   * @type {createClient}
   * */
  return function createClient(options) {
    const weakMap = new WeakMap([])
    const addCmdImpl = multi.default.prototype.addCommand
    listArgs && (multi.default.prototype.addCommand = function (args, transformReply) {
      // Just so we can get the commands binary
      if (!weakMap.has(this)) { weakMap.set(this, []) }
      weakMap.get(this).push(args[0])

      return addCmdImpl.apply(this, [args, transformReply])
    })

    /**
     * Since the impl is the same make it here and just set a custom rpc function
     *
     * @template {Function} I
     *
     * @param {I} impl - The method to be proxied
     * @param {Function} rpcFn - The function to create the RPC
     * @param {Function} [binaryFn] - Function to add extra binary
     *
     * @return {I}
     * */
    function proxy (impl, rpcFn, binaryFn) {
      const originalId = tracer.id
      return function (...args) {
        const self = this
        return new Promise((resolve, reject) => {
          const id = tracer.createChildId()
          tracer.letId(id, () => {
            commonAnnotations(rpcFn(...args))
            if (listArgs && binaryFn) {
              const [key, value] = binaryFn.apply(this, [...args])
              tracer.recordBinary(key, value)
            }
            // This is for multi
            // if (listArgs && weakMap.has(self)) {
            //   const commands = JSON.stringify(weakMap.get(self).map(el => el.toLowerCase()))
            //   tracer.recordBinary('commands', commands)
            // }
          })

          impl.apply(self, [...args])
            .then((...responses) => {
              tracer.letId(id, () => {
                tracer.recordAnnotation(new Annotation.ClientRecv())
              })
              tracer.letId(originalId, () => {
                return resolve(...responses)
              })
            })
            .catch(err => {
              tracer.letId(id, () => {
                tracer.recordBinary('error', err.message || /* istanbul ignore next */ String(err))
                tracer.recordAnnotation(new Annotation.ClientRecv())
              })

              tracer.letId(originalId, () => {
                return reject(err)
              })
            })
        })
      }
    }

    redis.default.commandsExecutor = proxy(redis.default.commandsExecutor, (command, args) => {
      return command.transformArguments(args)[0].toLowerCase()
    }, (command, args) => ['args',  JSON.stringify(command.transformArguments(args)[1])])

    redis.default.prototype.sendCommand = proxy(redis.default.prototype.sendCommand, (args) => args[0], (args) => {
      return ['args', JSON.stringify(args.splice(1, args.length - 1))]
    })

    multi.default.prototype.exec = proxy(multi.default.prototype.exec, () => 'multi', function () {
      const commands = JSON.stringify(weakMap.get(this).map(el => el.toLowerCase()))
      return ['commands', commands]
    })

    // Pass the new `commandsExecutor` method to commander
    extendWithDefaultCommands(redis.default, redis.default.commandsExecutor)

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
