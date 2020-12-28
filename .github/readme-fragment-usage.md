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
