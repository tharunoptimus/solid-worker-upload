import { WorkerMessage } from "../types/WorkerType"

function UploadButton() {
	let pickAndSendFile = () => {
		let fileInput = document.createElement("input")
		fileInput.type = "file"
		fileInput.onchange = async (e) => {
			let file = (e.target as HTMLInputElement).files![0]

			// Run this code only in production because
			// that is the only time the service worker is available
			if (import.meta.env.MODE == "production") {
				await navigator.serviceWorker.register(
					new URL(
						"./serviceworkers/workerHandlerSW.js",
						import.meta.url
					),
					{
						type: "module",
					}
				)
			}

			let worker = new Worker(
				new URL("../worker/upload.ts", import.meta.url),
				{
					type: "module",
				}
			)

			worker.postMessage(file)
		}

		fileInput.click()
	}

	let terminateWorker = () => {
		let workerChannel = new BroadcastChannel("workerChannel")
		let message: WorkerMessage = { type: "terminate" }
		workerChannel.postMessage(message)
		alert("Sent Request to Terminate Worker")
	}

	return (
		<>
			<button
				type="button"
				class="uploadButton"
				onclick={pickAndSendFile}
			>
				Upload a File
			</button>
			<br />
			<button
				type="button"
				class="uploadButton"
				onclick={terminateWorker}
			>
				Terminate Worker (during upload)
			</button>
		</>
	)
}

export default UploadButton
