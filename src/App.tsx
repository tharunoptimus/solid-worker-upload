import { Component } from "solid-js"
import APIStatus from "./components/APIStatus"
import Info from "./components/Info"
import Progress from "./components/Progress"
import UploadButton from "./components/UploadButton"

const App: Component = () => {
	return (
		<>
			<APIStatus />
			<Info />
			<UploadButton />
			<Progress />
		</>
	)
}

export default App
