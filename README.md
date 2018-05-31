This is a work in progress!

# D3 on a modern browser

This is an experiment in running d3 on a (very) modern browser,
taking advantage of all the things that the latest specs
give you.

Specifically:

- Native es6
- es6 modules (as of Chrome 62, which came out in November 2017)
- CSS grids (which means we no longer really need a css framework)

Also it will use immutable.js because as a functional programmer,
I still find es6's native FP a bit limiting; specifically it's
really hard to create a copy of a data structure with minor
mutations, and it's quite hard to efficiently use `reduce` at all.

## Viewing the chart

Sadly es6 modules won't work with `file://` URLs, as they break
CORS.

So to view the chart, you need to run a tiny http server - the easiest way is to use python:

`python -m SimpleHTTPServer 8000`

or if you have python3:

`python3 -m http.server 8000`

And then browse to `http://localhost:8000/docs/index.html`

Or you can view the current chart on github pages:

https://kornysietsma.github.io/d3-modern-demo/

## Approach to data

I largely tinker with stuff like this on the train; also
I dislike having to depend on external services.

As such, I'm mostly going to store data directly in JavaScript
files, and auto-generate them from scripts.

So there'll be a file like `docs/js/data.js` containing:
```
chartData = [
{ "zik": "zak" },
]
```

(with appropriate es6 module stuff) - and the chart will just load this data.  This has the big advantage of meaning we need no ajax,
no complex server, we can just treat the thing as static content.
Changing the content requires re-generating the `data.js` file and
pushing the new data to github.

For this demo I have some git timing data - don't worry too much about
what this means, I'm just using it as it's easier to graph real data than fake,
and I plan to do more with similar data in another project.

## Syntax and other checks with eslint
I have some basic eslint rules included, you'll need to integrate them
with your favourite toolset yourself if you want linting.

This is (currently) the only reason for the node.js `packages.json` file - for simple
editing you can ignore this.
