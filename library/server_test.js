import { assert, assertEquals } from "https://deno.land/std@0.79.0/testing/asserts.ts";
import { applyTo, concat, compose, converge, map  } from "https://deno.land/x/ramda@v0.27.2/mod.ts";

import Either from "https://deno.land/x/functional@v1.3.2/library/Either.js";
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

import { handlers, route } from "./route.js";
import { startHTTPServer } from "./server.js";
import { factorizeMiddleware, explodeRequest } from "./utilities.js";

const authorize = factorizeMiddleware(request =>
  request.headers["accept"] === 'application/json'
    ? Task.of({ authorizationToken: "hoge" })
    : Task(_ => Either.Left(Response.BadRequest({}, new Uint8Array([]))))
);

const routeHandlers = [
  handlers.get('/', _ => Task.of(Response.OK({}, new Uint8Array([])))),
  handlers.post('/hoge', request => Task.of(Response.OK({}, request.raw))),
  handlers.get(
    '/hoge',
    explodeRequest(
      ({ status }) =>
        Task.of(Response.OK({}, encodeText(JSON.stringify({ status }))))
    )
  ),
  handlers.get(
    /\/hoge\/(?<ID>.*?)$/,
    explodeRequest(({ ID }) => Task.of(Response.OK({}, encodeText(JSON.stringify({ ID })))))
  ),
  handlers.put(
    '/hoge',
    explodeRequest((meta, body) => Task.of(Response.OK({}, encodeText(JSON.stringify(body)))))
  ),
  handlers.post(
    '/fuga/piyo',
    authorize(
      ({ authorizationToken }) =>
        Task.of(Response.OK({}, encodeText(JSON.stringify({ authorizationToken }))))
    )
  )
];

Deno.test(
  "startHTTPServer: GET /",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(Request.GET('http://localhost:8080/')).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);

    server.close();
  }
);

Deno.test(
  "startHTTPServer: POST /hoge",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(
      Request.POST('http://localhost:8080/hoge', encodeText("Hello, Hoge!"))
    ).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(decodeRaw(response.raw), "Hello, Hoge!");

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: GET /hoge?status=active",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(Request.GET('http://localhost:8080/hoge?status=active')).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(JSON.parse(decodeRaw(response.raw)), { status: "active" });

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: GET /\\/hoge\\/(?<ID>.*?)$/",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(Request.GET('http://localhost:8080/hoge/piyo')).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(JSON.parse(decodeRaw(response.raw)), { ID: "piyo" });

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: PUT /hoge",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(
      Request(
        {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json'
          },
          method: 'PUT',
          url: 'http://localhost:8080/hoge'
        },
        encodeText(JSON.stringify({ username: 'hoge' }))
      )
    ).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(JSON.parse(decodeRaw(response.raw)), { username: 'hoge' });

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: POST /fuga/piyo",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(
      Request(
        {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json'
          },
          method: 'POST',
          url: 'http://localhost:8080/fuga/piyo'
        },
        new Uint8Array([])
      )
    ).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(JSON.parse(decodeRaw(response.raw)), { authorizationToken: 'hoge' });

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: POST /fuga/piyo -- unauthorized",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(
      Request(
        {
          headers: {
            'accept': 'text/plain',
            'content-type': 'application/json'
          },
          method: 'POST',
          url: 'http://localhost:8080/fuga/piyo'
        },
        new Uint8Array([])
      )
    ).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 400);

    server.close();
  }
);

Deno.test(
  "Scenario 1",
  async () => {
    const server = startHTTPServer(
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

    assert(Response.Success.is(response), `Failed with HTTP error (${response.headers.status}): ${decodeRaw(response.raw)}`);
    assertEquals(response.headers.status, 201);

    server.close();

    await createRedisSession(executeRedisCommand(RedisRequest.flushall()))(({ port: 6379 })).run();

    await Deno.remove(`${Deno.cwd()}/hoge`);
  }
);
