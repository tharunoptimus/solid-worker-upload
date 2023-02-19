import { del, get, set } from "idb-keyval" // For IndexedDB

declare let self: DedicatedWorkerGlobalScope // for typescript

// if you have an API running locally with https://github.com/tharunoptimus-pd/simple-server
// uncomment the below line and comment the next line
// let SERVER_API = `http://localhost:3003/api/upload/file` 
let SERVER_API = `https://simple-server-3xmu.onrender.com/api/upload/file`

import { WorkerMessage } from "../types/WorkerType"

// worker message channel and not the main route
self.onmessage = async (e: MessageEvent) => {
	let file = e.data
	uploadContent(file)
}

// main route for communication
let workerChannel = new BroadcastChannel("workerChannel")

workerChannel.onmessage = async (e: MessageEvent) => {
	// if it is alive, it will set the `uploadWorkerHeartBeat` to true which
	// was set to false by the service worker moment ago
	if (e.data.type == "heartBeat") {
		console.log(
			"%c RECEIVED heartBeat REQUEST FROM SW, WORKER IS ALIVE",
			"color: #34ace0"
		)
		await set("uploadWorkerHeartBeat", true)
	}
	// if it is a resumeUpload request, it will get the file from indexedDB
	// and upload it
	if (e.data.type == "resumeUpload") {
		let file = await get("fileToUpload")
		await uploadContent(file)
		await del("fileToUpload")
	}
	// if it is a terminate request, it will terminate the worker
	if (e.data.type == "terminate") {
		console.log("%c WORKER TERMINATED", "color: #34ace0")
		self.close()
	}
}

async function uploadContent(file: File) {
	workerChannel.postMessage({
		type: "ready",
		fileName: file.name,
	})

	// You probably won't need this.
	// I'm using this because of the stuff that has to do with `Express` and `Multer`
	let formData = new FormData()
	formData.append("file", file)

	let xhr = new XMLHttpRequest()
	xhr.open("POST", SERVER_API)

	xhr.upload.onprogress = (e) => {
		let messageToSend: WorkerMessage = {
			type: "progress",
			progress: e.loaded / e.total,
		}
		workerChannel.postMessage(messageToSend)
	}

	xhr.onload = () => {
		let messageToSend: WorkerMessage = {
			type: "status",
			status: "Done ✅",
		}
		workerChannel.postMessage(messageToSend)
	}

	// if xhr fails due to network error try to resumable upload
	xhr.onerror = async () => {
		let messageToSend: WorkerMessage = {
			type: "status",
			status: "Failed ❌",
			retry: true,
		}
		workerChannel.postMessage(messageToSend)

		// save file to indexedDB
		await set("fileToUpload", file)

		// try to resume upload
		// resumeUpload(file)
	}

	xhr.send(formData)
}

// a setInterval that checks whether the worker is alive or not
// if it's not alive, it will restart the worker
setInterval(async () => {
	await set("uploadWorkerHeartBeat", true)
}, 500)

export {} // Also for typescript
