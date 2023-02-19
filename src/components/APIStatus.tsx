import { createEffect, createSignal } from "solid-js"

// if you have an API running locally with https://github.com/tharunoptimus-pd/simple-server
// uncomment the below line and comment the next line
let SERVER_API = `http://localhost:3003/api/upload/file` 
// let SERVER_API = `https://simple-server-3xmu.onrender.com/api/upload/file`


export default function APIStatus() {

    let [status, setStatus] = createSignal("loading...")

    async function checkEndpointStatus() {
        try {
            await fetch(SERVER_API)
            setStatus("ONLINE")
            
        } catch (error) {
            setStatus("OFFLINE... Retrying...")
            setTimeout(() => {
                checkEndpointStatus()
            }, 1000)
        }
    }

    createEffect(() => {
        checkEndpointStatus()
    })

    return (
        <>
            <h1>API Endpoint Status: {status()}</h1>
        </>
    )

}