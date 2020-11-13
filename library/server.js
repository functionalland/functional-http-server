import { serve, serveTLS } from "https://deno.land/std@0.74.0/http/server.ts";
import { curry, reduce } from "https://x.nest.land/ramda@0.27.0/source/index.js";
import Request from "https://deno.land/x/functional_io@v0.5.0/library/Request.js";

/**
 * ## Simple HTTP server
 *
 * The fastest way to start a HTTP server is to use the `startHTTPServer` function.
 * The function takes two arguments; the first argument is the options, and the second is a unary
 * function that takes a `Request` and return a `Task` of a `Response`.
 *
 * ```js
 * import Task from "https://deno.land/x/functional@v1.1.0/library/Task.js";
 * import Response from "https://deno.land/x/functional_io@v0.5.0/library/Response.js";
 * import startHTTPServer from "./library/server.js";
 *
 * startHTTPServer({ port: 8080 }, request => Task.of(Response.OK({}, request.raw)));
 * ```
 *
 * You can test this simple server by executing it your file
 *
 * ```bash
 * $ deno run --allow-net server.js
 * ```
 *
 * ```bash
 * $ curl localhost:8080 -d "Hello, Hoge!"
 * > Hello, Hoge!
 * ```
 */

const destructureHeaders = headers => reduce(
  (accumulator, [ key, value ]) => Object.defineProperty(accumulator, key, { enumerable: true, value }),
  {},
  headers.entries()
);

// stream :: (Request -> Task Response) -> AsyncIterator -> _|_
export const stream = curry(
  async (unaryFunction, iterator) => {
    for await (const _request of iterator) {
      const { body = new Uint8Array([]), headers, method, url } = _request;

      unaryFunction(Request({ ...destructureHeaders(headers), method, url }, await Deno.readAll(body)))
        .map(response => _request.respond({ ...response.headers, body: response.raw }))
        .run()
        .catch(error => console.error(error));
    }
  }
);

// startServer :: Options -> (Request -> Response) -> _|_
export const startHTTPServer = (options, unaryFunction) => {
  const server = options.certificatePath && options.keyPath
    ? serveTLS(options)
    : serve(options)

  stream(unaryFunction, server);

  return server;
};

export default startHTTPServer;