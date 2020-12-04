import { assert, assertEquals } from "https://deno.land/std@0.79.0/testing/asserts.ts"
import Task from "https://deno.land/x/functional@v1.2.1/library/Task.js";
import Request from "https://deno.land/x/functional_io@v1.0.0/library/Request.js";
import Response from "https://deno.land/x/functional_io@v1.0.0/library/Response.js";

import { handlers, route } from "./route.js";

Deno.test(
  "handlers.delete",
  () => {
    const [ assertRequest, unaryFunction ] = handlers.delete(
      /\/hoge\/(?<ID>[a-z]+)$/,
      () => Task.of(Response.empty())
    );
    const request = Request({ method: 'DELETE', url: '/hoge/piyo' }, new Uint8Array([]));
    assert(assertRequest(request));
    assert(Task.is(unaryFunction(request)));
  }
);

Deno.test(
  "handlers.get",
  () => {
    const [ assertRequest, unaryFunction ] = handlers.get(
      /\/hoge\/(?<ID>[a-z]+)$/,
      () => Task.of(Response.empty())
    );
    const request = Request({ method: 'GET', url: '/hoge/piyo' }, new Uint8Array([]));
    assert(assertRequest(request));
    assert(Task.is(unaryFunction(request)));
  }
);

Deno.test(
  "handlers.post",
  () => {
    const [ assertRequest, unaryFunction ] = handlers.post(
      /\/hoge\/(?<ID>[a-z]+)$/,
      () => Task.of(Response.empty())
    );
    const request = Request({ method: 'POST', url: '/hoge/piyo' }, new Uint8Array([]));
    assert(assertRequest(request));
    assert(Task.is(unaryFunction(request)));
  }
);

Deno.test(
  "handlers.put",
  () => {
    const [ assertRequest, unaryFunction ] = handlers.put(
      /\/hoge\/(?<ID>[a-z]+)$/,
      () => Task.of(Response.empty())
    );
    const request = Request({ method: 'PUT', url: '/hoge/piyo' }, new Uint8Array([]));
    assert(assertRequest(request));
    assert(Task.is(unaryFunction(request)));
  }
);
