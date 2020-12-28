<img src="./.github/fl-logo.svg" alt="Functional HTTP Server" width="450" />

A simple HTTP server inspired by Express and in tune with Functional Programming principles in JavaScript for Deno.

[![deno land](http://img.shields.io/badge/available%20on-deno.land/x-lightgrey.svg?logo=deno&labelColor=black)](https://deno.land/x/functional_http_server@v0.3.1)
[![deno version](https://img.shields.io/badge/deno-^1.6.1-lightgrey?logo=deno)](https://github.com/denoland/deno)
[![GitHub release](https://img.shields.io/github/v/release/sebastienfilion/functional-http-server)](https://github.com/sebastienfilion/functional-http-server/releases)
[![GitHub licence](https://img.shields.io/github/license/sebastienfilion/functional-http-server)](https://github.com/sebastienfilion/functional-http-server/blob/v0.3.1/LICENSE)
[![Discord Chat](https://img.shields.io/discord/790708610023555093.svg)](https://discord.gg/)

  * [Simple HTTP server](#simple-http-server)
  * [Routing](#routing)
  * [Server](#server)
  * [Utilities](#utilities)

## Usage

Functional HTTP Server is optimized to write elegant and powerful point-free functions. This example uses the Ramda 
library - for simplification - but you should be able to use any library that implements the Fantasy-land 
specifications.

This example showcase how to create an endpoint handler for `POST /hoge` that writes to a local file and to Redis 
simultaneously the content of the request's body and, replies with `201`.

```js
import Task from "https://deno.land/x/functional@v1.3.2/library/Task.js";
import {
  decodeRaw,
  encodeText,
  evert,
  safeExtract
} from "https://deno.land/x/functional@v1.3.2/library/utilities.js";
import File from "https://deno.land/x/functional_io@v1.1.0/library/File.js";
import Request from "https://deno.land/x/functional_io@v1.1.0/library/Request.js";
import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";
import { fetch } from "https://deno.land/x/functional_io@v1.1.0/library/browser_safe.js";
import { writeFile } from "https://deno.land/x/functional_io@v1.1.0/library/fs.js";
import RedisRequest from "https://deno.land/x/functional_redis@v0.2.0/library/RedisRequest.js";
import { $$rawPlaceholder } from "https://deno.land/x/functional_redis@v0.2.0/library/Symbol.js";
import { executeRedisCommandWithSession } from "https://deno.land/x/functional_redis@v0.2.0/library/client.js";

import { handlers, route } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";
import startHTTPServer from "https://deno.land/x/functional_http_server@v0.3.1/library/server.js";

startHTTPServer(
  { port: 8080 },
  route(
    handlers.post(
      "/hoge",
      compose(
        map(_ => Response.Created({ 'content-type': "text/plain" }, encodeText("Created!"))),
        converge(
          (...tasks) => evert(Task, tasks),
          [
            compose(
              executeRedisCommandWithSession({ port: 6379 }),
              concat(RedisRequest("SET", new Uint8Array([]), [ "hoge", $$rawPlaceholder ]))
            ),
            compose(
              writeFile({}),
              concat(File.fromPath(`${Deno.cwd()}/hoge`))
            )
          ]
        )
      )
    )
  )
);

const container = await fetch(
  Request(
    {
      headers: {
        'accept': 'text/plain',
        'content-type': 'text/plain'
      },
      method: 'POST',
      url: 'http://localhost:8080/hoge'
    },
    encodeText("Hello, Hoge!")
  )
).run()

const response = safeExtract("Failed to unpack the response", container);

assert(Response.Success.is(response));
assertEquals(response.headers.status, 201);

server.close();
```

## Simple HTTP server

The fastest way to start a HTTP server is to use the `startHTTPServer` function.
The function takes two arguments; the first argument is the options, and the second is a unary
function that takes a `Request` and return a `Task` of a `Response`.

```js
import Task from "https://deno.land/x/functional@v1.3.2/library/Task.js";
import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";
import startHTTPServer from "https://deno.land/x/functional_http_server@v0.3.1/library/server.js";

startHTTPServer({ port: 8080 }, request => Task.of(Response.OK({}, request.raw)));
```

You can test this simple server by executing it your file

```bash
$ deno run --allow-net server.js
```

```bash
$ curl localhost:8080 -d "Hello, Hoge!"
> Hello, Hoge!
```

---

## Routing

The main routing tool that comes bundled with this library is conveniently called `route`.
It takes a non-zero number of arguments which are defined by a pair of functions.
The first function of the pair is used to assert whether or not to execute the second function.
The assertion function takes a `Request` and return a `Boolean`, the handling function takes a `Request` and
must return a `Task` of a `Response`.

```js
import Task from "https://deno.land/x/functional@v1.3.2/library/Task.js";
import { encodeText } from "https://deno.land/x/functional@v1.3.2/library/utilities.js";
import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";
import { route } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";

startHTTPServer(
  { port: 8080 },
  route(
    [
      request => request.headers.method === 'GET',
      _ => Task.of(Response.OK({ 'content-type': 'text/plain' }, encodeText("Hello, Hoge!")))
    ]
  );
);
```

### Routing handlers

Because the pattern is common, this library also offers a collection of handler that automatically creates
the assertion function. Each handler takes a `String` or a `RegExp` and a unary function.

```js
import Task from "https://deno.land/x/functional@v1.3.2/library/Task.js";
import { encodeText } from "https://deno.land/x/functional@v1.3.2/library/utilities.js";
import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";
import { handlers, route } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";

startHTTPServer(
  { port: 8080 },
  route(
    handlers.get('/', _ => Task.of(Response.OK({ 'content-type': 'text/plain' }, encodeText("Hello, Hoge!"))))
  )
);
```

#### handlers`.delete`
`String|RegExp → (Request → Task Response) → Task Response`

This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
`Response`. The handler will apply the unary function to a HTTP requests that uses the `DELETE` method if the path
equals or match the first argument.

```js
import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";

startHTTPServer({ port: 8080 }, handlers.delete(/\/hoge\/(?<ID>[a-z]+)$/, handleDestroyHoge));
```

#### handlers`.get`
`String|RegExp → (Request → Task Response) → Task Response`

This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
`Response`. The handler will apply the unary function to a HTTP requests that uses the `GET` method if the path
equals or match the first argument.

```js
import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";

startHTTPServer({ port: 8080 }, handlers.get(/\/hoge\/(?<ID>[a-z]+)$/, handleRetrieveHoge));
```

#### handlers`.patch`
`String|RegExp → (Request → Task Response) → Task Response`

This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
`Response`. The handler will apply the unary function to a HTTP requests that uses the `PATCH` method if the path
equals or match the first argument.

```js
import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";

startHTTPServer({ port: 8080 }, handlers.patch(/\/hoge\/(?<ID>[a-z]+)$/, handleUpdateHoge));
```

#### handlers`.post`
`String|RegExp → (Request → Task Response) → Task Response`

This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
`Response`. The handler will apply the unary function to a HTTP requests that uses the `POST` method if the path
equals or match the first argument.

```js
import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";

startHTTPServer({ port: 8080 }, handlers.post('/hoge', handleCreateHoge));
```

#### handlers`.put`
`String|RegExp → (Request → Task Response) → Task Response`

This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
`Response`. The handler will apply the unary function to a HTTP requests that uses the `PUT` method if the path
equals or match the first argument.

```js
import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";

startHTTPServer({ port: 8080 }, handlers.put(/\/hoge\/(?<ID>[a-z]+)$/, handleUpdateHoge));
```

#### `route`
`([ (Request → Boolean), (Request → Task Response) ],...) → Task Response`

This functions takes an arbitrary amount of array pairs of functions and return a task of a `Response`. The first
function of the pair is a predicate, it takes a `Request` and returns a `Boolean`. The second function of the pair
is a unary function that takes a `Request` and return a task of a `Response`; it will be executed only if the first
function returns `true`.

```js
import { route } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";

startHTTPServer(
  { port: 8080 },
  route(
    [
      request => request.headers.method === "POST" && request.headers.url === "/hoge",
      request => Task.of(Response.Created({}, encodeText("Created")))
    ]
  )
);
```

The handler can be easily composed using the spread operator.

```js
startHTTPServer(
  { port: 8080 },
  route(
    ...hogeRouteHandlers,
    ...piyoRouteHandlers,
    ...fugaRouteHandlers
  )
);
```

The handler will be short-circuited if it's not passed a `Request`. This makes it easy to write a
function to preflight a request.

For example, if you needed to discard any request that doesn't accept `application/json`, you could
do the following.

```js
import { compose } from "https://deno.land/x/ramda@v0.27.2/mod.ts";

startHTTPServer(
  { port: 8080 },
  compose(
    route(...routes),
    request => request.headers.accept !== 'application/json'
      ? Task.of(Response.BadRequest({}, new Uint8Array([])))
      : request
  )
);
```

---

## Server

### `stream`
`(Request → Task Response) → AsyncIterator → _|_`

This function takes a unaryFunction -- which itself takes a
[`Request`](https://github.com/sebastienfilion/functional-io#request) and, returns a Task of a
[`Response`](https://github.com/sebastienfilion/functional-io#Response) -- and, an Async Iterator of a
[Deno HTTP request](https://deno.land/std@0.82.0/http). The function doesn't resolve to a value.

### `startHTTPServer`
`Object → (Request → Response) → Listener`

This function takes an object of options and, a unary function -- which itself takes a
[`Request`](https://github.com/sebastienfilion/functional-io#request) and, returns a Task of a
[`Response`](https://github.com/sebastienfilion/functional-io#Response). The function will return a server instance
that can be closed (`server.close()`). [See the Deno server library](https://deno.land/std@0.82.0/http) for reference.

```js
import Task from "https://deno.land/x/functional@v1.3.2/library/Task.js";
import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";
import startHTTPServer from "https://deno.land/x/functional_http_server@v0.3.1/library/server.js";

startHTTPServer({ port: 8080 }, request => Task.of(Response.OK({}, request.raw)));
```

---

## Utilities

### `parseBody`
`Request → a`

This function takes a `Request` and return the most appropriate parsing of the body;
an object if the content-type of the request is `application/json` or, a string if the content type of the request is
`text/*`.

```js
import { parseBody } from "https://deno.land/x/functional_http_server@v0.3.1/library/utilities.js";

assertEquals(
  parseBody(
    Request({ 'content-type': 'application/json' }, encodeText(JSON.stringify({ piyo: 'piyo' })))
  ),
  { piyo: 'piyo' }
);
```

### `parseQueryString`
`Request → Record`

This function takes a `Request` and return an record of the query string.

```js
import { parseQueryString } from "https://deno.land/x/functional_http_server@v0.3.1/library/utilities.js";

assertEquals(
  parseQueryString(Request({ url: '/?hoge=hoge' }, new Uint8Array([]))),
  { hoge: 'hoge' }
);
```

---

## Contributing

We appreciate your help! Please, [read the guidelines](./CONTRIBUTING.md).

## License

Copyright © 2020 - Sebastien Filion

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.