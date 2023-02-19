import { WorkerMessage } from "../types/WorkerType"

function Progress() {
	let workerChannel = new BroadcastChannel("workerChannel")
	let documentTitle = document.title

	workerChannel.onmessage = (e) => {
		let data: WorkerMessage = e.data

		let { type } = data

		if (type === "ready") {
			let fileName = data?.fileName
			selectedFileName!.innerText = `Uploading: ${fileName}`
		}

		if (type === "progress") {
			let progress = data?.progress as number
			progress! *= 100
			progressBar!.value = progress
			document.title = `${progress?.toFixed(2)}% Uploading Video`
		}

		if (type === "status") {
			let status = data?.status as string
			statusSpan!.innerText = status
			document.title = documentTitle
			selectedFileName!.innerText = ""
		}
	}

	let selectedFileName: HTMLSpanElement | undefined
	let progressBar: HTMLProgressElement | undefined
	let statusSpan: HTMLSpanElement | undefined

	return (
		<div class="fileUpload">
			<h2>Upload Progress</h2>
			<span class="selectedFileName" ref={selectedFileName}>
				No File Selected
			</span>
			<br />
			<progress
				class="progress"
				value="0"
				max="100"
				ref={progressBar}
			></progress>
			<br />
			<span class="status" ref={statusSpan}></span>
		</div>
	)
}

export default Progress