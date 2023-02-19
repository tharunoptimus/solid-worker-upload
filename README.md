# Delegate Uploads to Web Workers

## What is this?
- This is a simple Solid-TS app that demonstrates how to delegate file uploads to web workers.
- The web app, on clicking "Upload", will create a web worker, and delegate the upload of the file to the worker.
- Just before starting the actual upload, the main thread will register a service worker with the respective scope (in this case, the scope is the `serviceworker/` folder)
- With BroadcastChannel API, the web worker will send messages like progress, success, failure to the main thread to update the UI.
- When it encounters an error(network error), it will request the service worker to register a `sync` event, and the service worker will request the worker to retry the upload once the network is back online. If the network is back online but the worker is not available, the service worker will retry the upload itself with `fetch` API.
- Users get notified about these process (if they leave the page) with `Notification` API.

## How to run
- `npm install`
- `npm run build`
- `npx serve dist -p 3000`

## Note
**The Service Worker works only on production build.**
**It is not possible to register a service worker during development**

This is because the service worker is registered with the scope of the `serviceworker/` folder, and the service worker is not available in the `dist/` folder. And there is no way for Vite/Rollup to find it and compile it to JS and place it in exact same folder structure.

## Rollup/Vite Config at `vite.config.js`
If you look at vite.config.js, you can see that I've use rollupOptions that stores the "workerHandlerSW" in the input and it stores the service worker with the output option. This is a build step. Probably the reason why `workbox` does not work during development.

## What is happening?

**The API endpoint is hosted on `render.com` and it is not available 24/7. So, you might see the API not available message. It also has cold start and could take upto 30 seconds. If you want to change it or work with a local running server. you'll need to change at 3 different positions(I'm bad at solid env variables)**
- `src/components/APIStatus.tsx`
- `src/worker/upload.ts`
- `src/sw/workerHandlerSW.ts`

### Main Thread
- The APIStatus component checks for the status of the API endpoint. If the API is not available, it will show a message to the user. It also asks user to allow notifications.
- The UploadButton component will render the button that says "Upload". When clicked, it opens the explorer for the file and then it will register a service worker (`workerHandlerSW.ts`) and spawns a web worker that will upload the file.
- The Progress components will open a broadcast channel with the tag `workerChannel` and will listen for messages from the worker. It will update the UI accordingly.

### Web Worker `upload.ts`
- The web worker will open a broadcast channel with the tag `workerChannel` and will send messages to the main thread regarding the status of the upload and other things such as failure, success etc.,
- It uses `XHR` because it is the only way to get the progress of the upload. It is not possible to get the progress of the upload with `fetch` API.
- If it fails, with the broadcast channel api, will send a message to the service worker to register a `sync` event.
- The worker will continue to live until the user closes the tab or the browser or the browser decides to kill it.


### Service Worker
Usually service workers are placed at the root, but if we placed this specific service at the root, the XHR request will pass through the `fetch` event handler of the service worker and the usage of `XHR` will be useless. So, we placed it in a different folder and registered it with the scope of that folder. It also comes with its new set of problems. It has the possibility of "stopping" all of a sudden for no apparent reason because there is no clients at `/serviceworker/`. If you wish to not see that happenning, you should register the service worker in the global scope(`/`). But it will not allow worker to show progress because the service worker will handle the upload rather than the worker so it's a tradeoff.
- It opens a broadcast channel with the tag `workerChannel` and will listen for messages from everywhere.
- When it receives a "retry" type message from the `workerChannel` it will register a `sync` event with the tag `retryUpload` and will wait for the network to be back online.
- When the network is back online, it will request the worker to retry the upload with the help of a heartbeat request. If the worker receives it, will change the entry in IndexedDB that the service worker is currently watching. So when it changes, it guesses that the worker is online and will ask it to retry the upload. (This is assuming the user is still on the page or the tab is in the background and the browser did not kill the worker thread)
- If the worker is not available(the browser killed, the user closed the tab or the browser), the service worker will send a notification saying ``"Uploading the video with BG SYNC in the SERVICE WORKER"``
- It will also send "UPLOAD Failed" or "UPLOAD Success" notifications to the user if the upload fails or succeeds respectively.
- While doing so, there is no way for the service worker to show progress of the upload as it does not have access to the XHR object. - Why? The service worker does not have access to XHR object, it only has access to `fetch` but `fetch` does not have a way to get the progress of the upload. 

## Key things to remember
1. Web Workers cannot access DOM
2. Web Workers can access modules installed with npm
3. Web Workers are like separate projects, if you have something like a library or a helper function, it should be available separately to them like the node_modules or something that doesn't involve the DOM. If you have a function that lives in another file that exports it and also have a function that interacts with the DOM, it won't work.
4. Web Workers can communicate with the main thread using `postMessage()` and `onmessage` event listener but it can be limiting, so we can use `BroadcastChannel` API to communicate with the main thread and other web workers.
5. If you want to resolve some problems with TypeScript, you might want to include "WebWorker" in the `lib` array in your `tsconfig.json` file. Like this:
`"lib": ["ESNext", "DOM", "WebWorker"],`

**Switching to "OFFLINE" under Network tab in Dev Tools doesn't work with `web workers`. It works sometimes and sometimes it doesn't. So, if you want to emulate it, play with your wifi LOL**