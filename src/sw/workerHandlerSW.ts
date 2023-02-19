import { del, get, set } from "idb-keyval" // For IndexedDB

// if you have an API running locally with https://github.com/tharunoptimus-pd/simple-server
// uncomment the below line and comment the next line
// let SERVER_API = `http://localhost:3003/api/upload/file` 
let SERVER_API = `https://simple-server-3xmu.onrender.com/api/upload/file`


interface SyncManager {
	getTags(): Promise<string[]>
	register(tag: string): Promise<void>
}

declare global {
	interface ServiceWorkerRegistration {
		readonly sync: SyncManager
	}

	interface SyncEvent extends ExtendableEvent {
		readonly lastChance: boolean
		readonly tag: string
	}

	interface ServiceWorkerGlobalScopeEventMap {
		sync: SyncEvent
	}
}

declare let self: ServiceWorkerGlobalScope // Required for Type Definitions for Service Worker

const CACHE = "content-v1" // Name of the Current Cache - doesn't matter what you name it

const CACHE_ASSETS = ["/"]

// Installation Event - doesn't matter what it does but it is required for
// service worker installation and to claim all pages with the scope
self.addEventListener(
	"install",
	(event: ExtendableEvent): Promise<void> | void => {
		event.waitUntil(
			caches
				.open(CACHE) // Opening the Cache
				.then((cache) => cache.addAll(CACHE_ASSETS)) // Adding the Listed Assets to the Cache
			// .then(self.skipWaiting()) // The Service Worker takes control of the page immediately
		)
		// The Service Worker takes control of the page immediately
		return self.skipWaiting()
	}
)

// The Activate Event is fired when the Service Worker is first installed.
// This is where we can clean up old caches. - does not matter what we do here
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				// Remove caches that are not required anymore
				// This filters the current cache, Image Network Cache and CDN Cache
				return cacheNames.filter((cacheName) => CACHE !== cacheName)
			})
			.then((unusedCaches) => {
				console.log("DESTROYING CACHE", unusedCaches.join(","))
				return Promise.all(
					unusedCaches.map((unusedCache) => {
						return caches.delete(unusedCache)
					})
				)
			})
			.then(() => self.clients.claim()) // The Service Worker takes control of all pages immediately
	)
})


// There is no fetch event here - we don't need it in our use case
// but if you want any fetch events to happen, create a new service worker
// and register it with `/` scope and not with `/serviceworker` scope

// ---------------------------------------- BACKGROUND SYNC ----------------------------------------

// A little helper function that takes care of registering the sync event with a tag name
async function requestBackgroundSync(
	backgroundSyncTagName: string
): Promise<void> {
	try {
		await self.registration.sync.register(backgroundSyncTagName)
	} catch (error) {
		console.log("Unable to REGISTER background sync", error)
		setTimeout(() => requestBackgroundSync(backgroundSyncTagName), 10000)
	}
}

// basic function for sending local push notifications with just a title
async function sendLocalNotification(title: string) {
	await self.registration.showNotification(title)
}

async function sleepInMs(ms: number) {
	await new Promise((resolve) => {
		setTimeout(() => {
			resolve(true)
		}, ms)
	})
}

// This is the actual event listener for the sync event (Background Sync)
/**
 * This is the Handler for Sync Events
 * It may not work all the time and will not work on most browsers
 * 
 * This handler can run only once after it gets connected to the internet and
 * there is a `sync` registration
 * 
 * With `if` condition, we can check if the `sync` event is for the tag name we want
 * and run our function with `event.waitUntil()`
 */
self.addEventListener("sync", (event) => {
	if (event.tag === "retryUpload") {
		console.log(
			"%c EXECUTING BACKGROUND SYNC OF TAGNAME: " + event.tag,
			"color: yellow"
		)
		event.waitUntil(resumeWorkerUpload())
	}
})

// the function that runs with the sync event with tag name "retryUpload"
async function resumeWorkerUpload() {
	// test if worker is alive, set to false and worker will set it to true
	await set("uploadWorkerHeartBeat", false)
	console.log(
		"%c TRYING TO SEND HEARTBEAT REQUEST TO WORKER",
		"color: yellow"
	)
	workerChannel.postMessage({
		type: "heartBeat",
	})

	// wait for 2 seconds to allow worker to get the message, update 
	// `uploadWorkerHeartBeat` to true in the IndexedDB 
	await sleepInMs(2000)

	let status = await get("uploadWorkerHeartBeat")
	if (status) {
		// worker is alive
		console.log(
			"%c WORKER IS ALIVE. IT WILL TAKE CARE",
			"color: yellow"
		)
		// tell worker to resume the upload
		workerChannel.postMessage({
			type: "resumeUpload",
		})
	} else {
		console.log(
			"%c WORKER IS DEAD. RESTARTING THE UPLOAD WITH THE SERVICE WORKER",
			"color: yellow"
		)

		// worker is dead, so we will do the upload with the service worker
		// get the file from IndexedDB
		let file = await get("fileToUpload")

		if (!file) {
			console.log(
				"%c NO FILE TO UPLOAD",
				"color: yellow"
			)
			return
		}

		let formData = new FormData()
		formData.append("file", file)

		// send a Push Notification to the user saying that the upload is starting
		await sendLocalNotification(
			"Uploading the video with BG SYNC in the SERVICE WORKER"
		)


		// XHR is unsupported in Service Workers, so we will use fetch
		try {
			await fetch(SERVER_API, {
				method: "POST",
				body: formData,
			})
			console.log(
				"%c UPLOAD SUCCESSFUL",
				"color: yellow"
			)
			await sendLocalNotification("Upload Successful") 
			await del("fileToUpload") // delete the file from IndexedDB, no longer needed
		} catch (error) {
			console.log(
				"%c UPLOAD FAILED",
				"color: yellow"
			)
			// wait for 5 seconds and queue the sync event again
			await sendLocalNotification("Upload Failed")
			// register the sync event again
			await requestBackgroundSync("retryUpload") 
		}
	}
}

// The main route for all communication
let workerChannel = new BroadcastChannel("workerChannel")

workerChannel.onmessage = async (e: MessageEvent) => {

	// if retry from worker, registers a sync event and tells worker 
	// to show a message to the user that it is retrying
	if (e.data.type == "status") {
		if (e.data.retry == true) {
			requestBackgroundSync("retryUpload")

			console.log(
				"%c REGISTERED SYNC EVENT",
				"color: yellow"
			)
			workerChannel.postMessage({
				type: "status",
				status: "Retrying Upload...",
			})
		}
	}

	// receives a heartbeart from the worker and tells worker
	// to resume the upload
	if (e.data.type == "heartBeat") {
		console.log(
			"%c RECEIVED HEARTBEAT FROM WORKER, WORKER IS ALIVE",
			"color: yellow"
		)
		workerChannel.postMessage({
			type: "resumeUpload",
		})
	}
}

export {} // for typescript
